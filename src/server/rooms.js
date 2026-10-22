import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createSequenceGame, playSequenceCard, discardSequenceCard } from '../engine/sequence.js';
import { createContractGame, drawContractCard, discardContractCard, layContract, nextContractRound } from '../engine/contracts.js';
import { createRackGame, rackDraw, rackReplace, rackDiscard } from '../engine/rack.js';
import { createTileGame, tileLay, tileEndTurn } from '../engine/tiles.js';
import { createLowGame, lowDraw, lowReplace, lowFlip, lowNextRound } from '../engine/lowcard.js';
import { createEightGame, eightPlay, eightDraw, eightPass } from '../engine/eights.js';

const MODES = new Set(['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift']);
const validCode = code => /^[A-Z2-9]{6}$/.test(code ?? '');
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const roomCode = () => Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');

// Use Node's cryptographic RNG for online shuffling. The deterministic game engines
// retain seeded RNG for repeatable local demos/tests, not for concealing online hands.
function cryptoShuffle(cards) {
  const deck=[...cards];
  for(let i=deck.length-1;i>0;i--) {
    const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}
function securelyDeal(game) {
  // Preserve zone sizes and turn state while replacing the deterministic shuffle.
  const zones=game.kind==='tiles' ? [game.draw,...game.players.map(p=>p.rack)]
    : game.kind==='low' ? [game.draw,game.discard,...game.players.map(p=>p.grid)]
    : game.kind==='eights' ? [game.draw,game.discard,...game.players.map(p=>p.hand)]
    : game.kind==='sequence'
    ? [game.draw,...game.players.flatMap(p=>[p.stock,p.hand])]
    : game.kind==='rack' ? [game.draw,game.discard,...game.players.map(p=>p.rack)]
    : [game.draw,game.discard,...game.players.map(p=>p.hand)];
  const cards=cryptoShuffle(zones.flat());
  let offset=0;
  for(const zone of zones) {
    const count=zone.length;zone.splice(0,count,...cards.slice(offset,offset+count));offset+=count;
  }
  if(game.kind==='low')for(const p of game.players)p.grid.forEach((c,i)=>{c.revealed=i===0||i===11;c.cleared=false;});
  if(game.kind==='eights')game.activeSuit=game.discard.at(-1).suit;
  return game;
}
const safeName = value => {
  if(typeof value !== 'string') throw Error('Enter a player name.');
  const name=value.trim().replace(/\s+/g,' ');
  if(name.length < 2 || name.length > 24 || /[<>\x00-\x1f]/.test(name)) throw Error('Name must have 2–24 characters without markup.');
  return name;
};
const safeAvatar = n => {
  if(!Number.isInteger(n) || n < 1 || n > 16) throw Error('Choose one of the 16 avatars.');
  return n;
};
const restrictedIndex = (x,max=999) => Number.isInteger(x)&&x>=0&&x<=max;
const copyPile = (cards, showTop) => cards.length ? [...Array(cards.length-1).fill(null),showTop?cards.at(-1):null]:[];

/** Project one seat's view. No opponent hand, hidden stock or draw card identities are sent. */
export function projectGame(game, seat) {
  if(!game) return null;
  const other = 1-seat;
  const adapt = (player, owned) => game.kind==='tiles' ? ({name:player.name,rack:owned?player.rack:Array(player.rack.length).fill(null)})
    : game.kind==='low' ? ({name:player.name,score:player.score,grid:player.grid.map(c=>c.revealed||c.cleared?{id:c.id,value:c.cleared?null:c.value,revealed:true,cleared:c.cleared}:{id:null,value:null,revealed:false,cleared:false})})
    : game.kind==='eights' ? ({name:player.name,hand:owned?player.hand:Array(player.hand.length).fill(null)})
    : game.kind==='rack' ? ({name:player.name,rack:owned?player.rack:Array(player.rack.length).fill(null)}) : game.kind==='sequence' ? ({
    name:player.name,
    stock:copyPile(player.stock,owned),
    hand:owned ? player.hand : Array(player.hand.length).fill(null),
    discards:player.discards.map(p=>copyPile(p,true))
  }) : ({name:player.name, mission:player.mission,score:player.score,
    hand:owned ? player.hand : Array(player.hand.length).fill(null)});
  const shared = {kind:game.kind,mode:game.mode,active:game.active===seat?0:1,
    winner:game.winner===null?null:game.winner===-1?-1:(game.winner===seat?0:1),
    roundWinner:game.roundWinner===undefined?undefined:game.roundWinner===null?null:game.roundWinner===-1?-1:(game.roundWinner===seat?0:1),
    players:[adapt(game.players[seat],true),adapt(game.players[other],false)],
    log:game.log.slice(0,12)};
  if(game.kind==='tiles')return {...shared,groups:game.groups,turn:game.turn,playedThisTurn:game.playedThisTurn,draw:{length:game.draw.length}};
  if(game.kind==='low')return {...shared,round:game.round,step:game.step,held:game.active===seat?game.held:null,drawnFrom:game.active===seat?game.drawnFrom:null,closingSeat:game.closingSeat===null?null:(game.closingSeat===seat?0:1),draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='eights')return {...shared,turn:game.turn,drew:game.drew,activeSuit:game.activeSuit,draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='sequence') return {...shared, rules:game.rules,turn:game.turn,builds:game.builds};
  if(game.kind==='rack') return {...shared,step:game.step,turn:game.turn,held:game.active===seat?game.held:null,
    draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  return {...shared,round:game.round,step:game.step,draw:{length:game.draw.length},
    discard:game.discard,laid:game.laid};
}

/** In-process private room registry; optional snapshot file for restart persistence. */
export class RoomStore {
  constructor({storageFile=null, now=()=>Date.now()}={}) {
    this.rooms=new Map(); this.storageFile=storageFile;this.now=now;
    this.listeners=new Map();this.pendingWrite=Promise.resolve();
  }
  async load() {
    if(!this.storageFile) return;
    try {
      const parsed=JSON.parse(await readFile(this.storageFile,'utf8'));
      for(const record of parsed.rooms ?? []) {
        if(validCode(record.code) && MODES.has(record.mode) && Array.isArray(record.players) && record.players.length<=2 && this.now()-record.updated<7*86400e3) this.rooms.set(record.code,record);
      }
    } catch(err) { if(err.code!=='ENOENT') throw err; }
  }
  save() {
    if(!this.storageFile) return Promise.resolve();
    const snapshot=JSON.stringify({version:2,rooms:[...this.rooms.values()]});
    this.pendingWrite=this.pendingWrite.catch(()=>{}).then(async()=>{
      await mkdir(dirname(this.storageFile),{recursive:true});
      const temp=`${this.storageFile}.${process.pid}.tmp`;
      await writeFile(temp,snapshot,{mode:0o600});
      await rename(temp,this.storageFile);
    });
    return this.pendingWrite;
  }
  notify(code) {for(const entry of this.listeners.get(code)??[]) {try {entry.fn();} catch { /* closed connections */ }}}
  subscribe(code,fn,seat=null) {
    const subscribers=this.listeners.get(code)??new Set();
    const entry={fn,seat};subscribers.add(entry);this.listeners.set(code,subscribers);this.notify(code);
    return ()=>{subscribers.delete(entry);if(!subscribers.size)this.listeners.delete(code);this.notify(code);};
  }
  prune() { // Keep completed and abandoned rooms for seven days, including persisted sessions.
    for(const [code,room] of this.rooms) if(this.now()-room.updated>7*86400e3 && !this.listeners.has(code))this.rooms.delete(code);
  }
  _find(code) {
    if(!validCode(code)) throw Error('Invalid room code.');
    const room=this.rooms.get(code);
    if(!room)throw Error('Room not found. Check the invite code.');
    return room;
  }
  _auth(code,credential) {
    const room=this._find(code);
    if(typeof credential!=='string'||credential.length<30||credential.length>100)throw Error('Access denied. Rejoin using your saved player session.');
    const seat=room.players.findIndex(player=>player.tokenHash===hash(credential));
    if(seat<0)throw Error('Access denied. That session does not belong to this room.');
    return {room,seat};
  }
  async create({mode,name,avatar}) {
    this.prune();
    if(this.rooms.size>=1000)throw Error('The room service is full. Try again later.');
    if(!MODES.has(mode)) throw Error('Choose one of the available games.');
    const player={name:safeName(name),avatar:safeAvatar(avatar)};
    const credential=token();player.tokenHash=hash(credential);
    let code=roomCode();while(this.rooms.has(code))code=roomCode();
    const room={code,mode,players:[player],status:'waiting',game:null,revision:1,created:this.now(),updated:this.now()};
    this.rooms.set(code,room);await this.save();return {code,token:credential,seat:0,view:this.view(code,credential)};
  }
  createGame(mode,seed) {
    if(mode==='tile-royale')return createTileGame({mode,seed});
    if(mode==='low-glow')return createLowGame({mode,seed});
    if(mode==='eight-shift')return createEightGame({mode,seed});
    if(mode==='stack-run'||mode==='malice-duel')return createSequenceGame({mode,seed});
    if(mode==='number-ladder')return createRackGame({mode,seed});
    return createContractGame({mode,seed});
  }
  async join(code,{name,avatar}) {
    const room=this._find(code);
    if(room.status!=='waiting'||room.players.length!==1)throw Error('This room is not accepting players.');
    const player={name:safeName(name),avatar:safeAvatar(avatar)};
    const credential=token();player.tokenHash=hash(credential);
    room.players.push(player);room.status='playing';room.updated=this.now();room.revision++;
    const seed=randomBytes(4).readUInt32BE();
    room.game=securelyDeal(this.createGame(room.mode,seed));
    room.game.players[0].name=room.players[0].name;
    room.game.players[1].name=room.players[1].name;
    room.game.log=[`Private table ready: ${room.players[0].name} versus ${room.players[1].name}.`];
    await this.save();this.notify(code);
    return {code,token:credential,seat:1,view:this.view(code,credential)};
  }
  view(code,credential) {
    const {room,seat}=this._auth(code,credential);
    return {code:room.code,mode:room.mode,status:room.status,revision:room.revision,seat,
      players:room.players.map((p,i)=>({name:p.name,avatar:p.avatar,connected:[...(this.listeners.get(code)??[])].some(s=>s.seat===i)})),game:projectGame(room.game,seat),
      storage:this.storageFile?'configured':'memory-only'};
  }
  async move(code,credential,action) {
    const {room,seat}=this._auth(code,credential);
    if(!action || typeof action!=='object'||Array.isArray(action))throw Error('Invalid action.');
    if(action.revision!==room.revision)throw Error('The table changed before your move. Please try again.');
    if(action.type==='profile-avatar') {
      room.players[seat].avatar=safeAvatar(action.avatar);
      room.revision++;room.updated=this.now();await this.save();this.notify(code);
      return this.view(code,credential);
    }
    if(!room.game)throw Error('Wait for your friend to join before playing.');
    const game=room.game;
    const kind=action.type;
    if(kind==='restart') {
      if(seat!==0||game.winner===null)throw Error('Only the host can restart a completed match.');
      const seed=randomBytes(4).readUInt32BE();
      room.game=securelyDeal(this.createGame(room.mode,seed));
      room.game.players.forEach((p,i)=>p.name=room.players[i].name);
    } else {
      if(kind==='next-round') {
        if(!['contract','low'].includes(game.kind)||game.roundWinner===null||game.winner!==null)throw Error('The next round is not yet available.');
        // Either player may continue a completed round.
      } else if(game.active!==seat)throw Error('It is your opponent’s turn.');
      let outcome;
      switch(kind) {
        case 'tile-lay':
          if(game.kind!=='tiles'||!Array.isArray(action.indices)||action.indices.length>13||!action.indices.every(x=>restrictedIndex(x,99))||(action.target!==null&&action.target!==undefined&&!restrictedIndex(action.target,999)))throw Error('Invalid tile selection.');
          outcome=tileLay(game,action.indices,action.target??null);break;
        case 'tile-end':
          if(game.kind!=='tiles'||typeof action.draw!=='boolean')throw Error('Invalid tile turn action.');
          outcome=tileEndTurn(game,action.draw);break;
        case 'low-draw':
          if(game.kind!=='low'||!['deck','discard'].includes(action.from))throw Error('Invalid low-card draw.');
          if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1){const shuffled=structuredClone(game),top=shuffled.discard.pop();shuffled.draw=cryptoShuffle(shuffled.discard);shuffled.discard=[top];outcome=lowDraw(shuffled,'deck');}else outcome=lowDraw(game,action.from);break;
        case 'low-replace':
          if(game.kind!=='low'||!restrictedIndex(action.index,11))throw Error('Invalid grid position.');
          outcome=lowReplace(game,action.index);break;
        case 'low-flip':
          if(game.kind!=='low'||!restrictedIndex(action.index,11))throw Error('Invalid grid position.');
          outcome=lowFlip(game,action.index);break;
        case 'eight-play':
          if(game.kind!=='eights'||!restrictedIndex(action.index,60)||(action.suit!==null&&action.suit!==undefined&&!['hearts','diamonds','clubs','spades'].includes(action.suit)))throw Error('Invalid eight-card play.');
          outcome=eightPlay(game,action.index,action.suit??null);break;
        case 'eight-draw':
          if(game.kind!=='eights')throw Error('Invalid game action.');
          if(!game.draw.length&&game.discard.length>1){const shuffled=structuredClone(game),top=shuffled.discard.pop();shuffled.draw=cryptoShuffle(shuffled.discard);shuffled.discard=[top];outcome=eightDraw(shuffled);}else outcome=eightDraw(game);break;
        case 'eight-pass':
          if(game.kind!=='eights')throw Error('Invalid game action.');outcome=eightPass(game);break;
        case 'sequence-play':
          if(game.kind!=='sequence'||!['stock','hand','discard'].includes(action.sourceType)||!restrictedIndex(action.sourceIndex,100)||!restrictedIndex(action.pileIndex,3))throw Error('Invalid card action.');
          outcome=playSequenceCard(game,action.sourceType,action.sourceIndex,action.pileIndex);break;
        case 'sequence-discard':
          if(game.kind!=='sequence'||!restrictedIndex(action.handIndex,100)||!restrictedIndex(action.discardIndex,3))throw Error('Invalid discard action.');
          outcome=discardSequenceCard(game,action.handIndex,action.discardIndex);break;
        case 'rack-draw':
          if(game.kind!=='rack'||!['deck','discard'].includes(action.from))throw Error('Invalid rack draw.');
          if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1) {
            const shuffled=structuredClone(game);
            const top=shuffled.discard.pop();
            shuffled.draw=cryptoShuffle(shuffled.discard);
            shuffled.discard=[top];
            outcome=rackDraw(shuffled,action.from);
          } else outcome=rackDraw(game,action.from);
          break;
        case 'rack-replace':
          if(game.kind!=='rack'||!restrictedIndex(action.index,9))throw Error('Invalid rack position.');
          outcome=rackReplace(game,action.index);break;
        case 'rack-discard':
          if(game.kind!=='rack')throw Error('Invalid rack discard.');
          outcome=rackDiscard(game);break;
        case 'contract-draw':
          if(game.kind!=='contract'||!['deck','discard'].includes(action.from))throw Error('Invalid draw action.');
          if(action.from==='deck'&&game.draw.length===0&&game.discard.length>1) {
            const shuffled=structuredClone(game);
            const top=shuffled.discard.pop();
            shuffled.draw=cryptoShuffle(shuffled.discard);
            shuffled.discard=[top];
            outcome=drawContractCard(shuffled,action.from);
          } else outcome=drawContractCard(game,action.from);
          break;
        case 'contract-discard':
          if(game.kind!=='contract'||!restrictedIndex(action.handIndex,100))throw Error('Invalid discard action.');
          outcome=discardContractCard(game,action.handIndex);break;
        case 'contract-lay':
          if(game.kind!=='contract')throw Error('Invalid contract action.');
          outcome=layContract(game);break;
        case 'next-round':outcome=game.kind==='low'?lowNextRound(game):nextContractRound(game);
          if(outcome.state)outcome.state=securelyDeal(outcome.state);break;
        default:throw Error('Unknown game action.');
      }
      if(outcome?.error)throw Error(outcome.error);
      room.game=outcome.state;
    }
    room.revision++;room.updated=this.now();
    await this.save();this.notify(code);
    return this.view(code,credential);
  }
}
