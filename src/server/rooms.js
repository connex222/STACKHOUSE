import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createSequenceGame, playSequenceCard, discardSequenceCard, passSequenceTurn, canPassSequenceTurn, replenishSequenceHand, canReplenishSequenceHand } from '../engine/sequence.js';
import { createContractGame, drawContractCard, discardContractCard, layContract, nextContractRound } from '../engine/contracts.js';
import { createRackGame, rackDraw, rackReplace, rackDiscard } from '../engine/rack.js';
import { createTileGame, tileLay, tileEndTurn } from '../engine/tiles.js';
import { createLowGame, lowDraw, lowReplace, lowFlip, lowNextRound } from '../engine/lowcard.js';
import { createEightGame, eightPlay, eightDraw, eightPass } from '../engine/eights.js';
import {createSeries,ensureSeries,recordMatchResult,beginNextGame,publicSeries} from './series.js';
import {tournamentFormat} from './tournament.js';

const GROUP_MODES = new Set(['eight-shift','stack-run','malice-duel','tile-royale','phase-quest','contract-club','crown-circuit','shanghai-nights']);
const MODES = new Set(['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift']);
const validCode = code => /^[A-Z2-9]{6}$/.test(code ?? '');
const hash = value => createHash('sha256').update(value).digest('hex');
const validActionId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{12,90}$/.test(id);
const ACTION_HISTORY_LIMIT = 80;
export const MAX_STREAMS_PER_SEAT = 3;
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
  const order=[seat,...game.players.map((_,i)=>i).filter(i=>i!==seat)];
  const relative=index=>index===null||index===undefined||index===-1?index:order.indexOf(index);
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
  const shared = {kind:game.kind,mode:game.mode,active:relative(game.active),
    winner:relative(game.winner),
    roundWinner:relative(game.roundWinner),
    players:order.map(i=>adapt(game.players[i],i===seat)),
    log:game.log.slice(0,12)};
  if(game.kind==='tiles')return {...shared,groups:game.groups,turn:game.turn,playedThisTurn:game.playedThisTurn,draw:{length:game.draw.length}};
  if(game.kind==='low')return {...shared,round:game.round,step:game.step,held:game.active===seat?game.held:null,drawnFrom:game.active===seat?game.drawnFrom:null,closingSeat:game.closingSeat===null?null:(game.closingSeat===seat?0:1),draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='eights')return {...shared,turn:game.turn,drew:game.drew,activeSuit:game.activeSuit,draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  if(game.kind==='sequence') return {...shared, rules:game.rules,turn:game.turn,builds:game.builds,stalemate:Boolean(game.stalemate),canPass:canPassSequenceTurn(game,seat),canRefill:canReplenishSequenceHand(game,seat)};
  if(game.kind==='rack') return {...shared,step:game.step,turn:game.turn,held:game.active===seat?game.held:null,
    draw:{length:game.draw.length},discard:game.discard.slice(-1)};
  return {...shared,round:game.round,step:game.step,draw:{length:game.draw.length},
    discard:game.discard,laid:game.laid};
}

/** In-process private room registry; optional snapshot file for restart persistence. */
export class RoomStore {
  constructor({storageFile=null, snapshotStore=null, now=()=>Date.now()}={}) {
    if(storageFile && snapshotStore) throw Error('Configure one room storage backend, not two.');
    this.rooms=new Map(); this.storageFile=storageFile;this.snapshotStore=snapshotStore;this.now=now;
    this.storageKind=snapshotStore?'postgres':storageFile?'filesystem-only':'memory-only';
    this.listeners=new Map();this.pendingWrite=Promise.resolve();this.operationQueue=Promise.resolve();
  }
  async load() {
    if(!this.storageFile && !this.snapshotStore) return;
    try {
      const stored=this.snapshotStore ? await this.snapshotStore.load() : JSON.parse(await readFile(this.storageFile,'utf8'));
      if(!stored) return;
      const parsed=stored;
      for(const record of parsed.rooms ?? []) {
        if(validCode(record.code) && MODES.has(record.mode) && Array.isArray(record.players) && record.players.length<=(record.maxPlayers??2) && this.now()-record.updated<7*86400e3) {record.maxPlayers??=2;
          if(record.maxPlayers!==2&&(!GROUP_MODES.has(record.mode)||record.format==='mixed'||record.maxPlayers>6))continue;
          record.format=tournamentFormat(record.format);record.startMode??=record.mode;ensureSeries(record);record.recentActions??=[];record.rematchVotes??=Array(record.players.length).fill(false);this.rooms.set(record.code,record);}
      }
    } catch(err) { if(err.code!=='ENOENT') throw err; }
  }
  save() {
    if(!this.storageFile && !this.snapshotStore) return Promise.resolve();
    const snapshot={version:3,rooms:[...this.rooms.values()]};
    // A persistence failure MUST reject the action rather than silently claiming it was saved.
    this.pendingWrite=this.pendingWrite.catch(()=>{}).then(async()=>{
      if(this.snapshotStore) return this.snapshotStore.save(snapshot);
      await mkdir(dirname(this.storageFile),{recursive:true});
      const temp=`${this.storageFile}.${process.pid}.tmp`;
      await writeFile(temp,JSON.stringify(snapshot),{mode:0o600});
      await rename(temp,this.storageFile);
    });
    return this.pendingWrite.catch(error=>{
      console.error('Room snapshot write failed:',error.message);
      throw Error('Room storage is temporarily unavailable. Please try again.');
    });
  }
  async _exclusive(operation) {
    // Serialise every room mutation, including joins and rematch votes. Two simultaneous
    // moves based on the same revision cannot both be accepted.
    const previous=this.operationQueue;
    let release;
    this.operationQueue=new Promise(resolve=>{release=resolve;});
    await previous;
    const before=structuredClone([...this.rooms.entries()]);
    try{return await operation();}
    catch(error){
      // A failed database/file write cannot leave the in-memory state advanced.
      // Preserve object identity on invalid/no-op commands so an engine reference
      // held by an active spectator is not needlessly detached.
      if(JSON.stringify([...this.rooms.entries()])!==JSON.stringify(before))this.rooms=new Map(before);
      throw error;
    }finally{release();}
  }
  notify(code) {for(const entry of this.listeners.get(code)??[]) {try {entry.fn();} catch { /* closed connections */ }}}
  canSubscribe(code,seat) {
    // At most three streaming tabs per authenticated seat; other players are unaffected.
    const subscribers=this.listeners.get(code);
    return !subscribers || [...subscribers].filter(entry=>entry.seat===seat).length<MAX_STREAMS_PER_SEAT;
  }
  subscribe(code,fn,seat=null) {
    if(!this.canSubscribe(code,seat))throw Error('Too many open table connections. Close unused tabs.');
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
  async create(options) {
    if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid room settings.');
    let {mode,name,avatar,format='single',maxPlayers=2}=options;
    return this._exclusive(async()=>{
    this.prune();
    if(this.rooms.size>=1000)throw Error('The room service is full. Try again later.');
    if(!MODES.has(mode)) throw Error('Choose one of the available games.');
    format=tournamentFormat(format);
    if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6)throw Error('Choose between 2 and 6 players.');
    if(maxPlayers>2&&(!GROUP_MODES.has(mode)||format!=='single'))throw Error('Group tables support eight selected games in single-game mode; Games Night Mix is for two players.');
    const player={name:safeName(name),avatar:safeAvatar(avatar)};
    const credential=token();player.tokenHash=hash(credential);
    let code=roomCode();while(this.rooms.has(code))code=roomCode();
    const room={code,mode,startMode:mode,format,maxPlayers,players:[player],status:'waiting',game:null,revision:1,created:this.now(),updated:this.now(),rematchVotes:Array(maxPlayers).fill(false),recentActions:[],gameNumber:1,series:createSeries(1,maxPlayers)};
    this.rooms.set(code,room);await this.save();return {code,token:credential,seat:0,view:this.view(code,credential)};
    });
  }
  createGame(mode,seed,playerCount=2) {
    if(mode==='tile-royale')return createTileGame({mode,seed,playerCount});
    if(mode==='low-glow')return createLowGame({mode,seed});
    if(mode==='eight-shift')return createEightGame({mode,seed,playerCount});
    if(mode==='stack-run'||mode==='malice-duel')return createSequenceGame({mode,seed,playerCount});
    if(mode==='number-ladder')return createRackGame({mode,seed});
    return createContractGame({mode,seed,playerCount});
  }
  // Called only while a room is waiting. Host can launch a group early once 3 seats are filled.
  _beginRoom(room) {
    const seed=randomBytes(4).readUInt32BE();
    room.game=securelyDeal(this.createGame(room.mode,seed,room.players.length));
    room.game.players.forEach((p,i)=>{p.name=room.players[i].name;});
    room.game.log=[`Private table ready: ${room.players.map(p=>p.name).join(', ')}.`];
    room.status='playing';room.rematchVotes=Array(room.players.length).fill(false);
    room.series=createSeries(1,room.players.length);
  }
  async join(code,details) {
    if(!details||typeof details!=='object'||Array.isArray(details))throw Error('Enter a player name and avatar.');
    const {name,avatar}=details;
    return this._exclusive(async()=>{
      const room=this._find(code);
      if(room.status!=='waiting'||room.players.length>=room.maxPlayers)throw Error('This room is not accepting players.');
      const player={name:safeName(name),avatar:safeAvatar(avatar)};
      const credential=token();player.tokenHash=hash(credential);
      const seat=room.players.length;room.players.push(player);
      if(room.players.length===room.maxPlayers)this._beginRoom(room);
      room.updated=this.now();room.revision++;
      await this.save();this.notify(code);
      return {code,token:credential,seat,view:this.view(code,credential)};
    });
  }
  async start(code,credential) {
    return this._exclusive(async()=>{
      const {room,seat}=this._auth(code,credential);
      if(seat!==0)throw Error('Only the host can start the table.');
      if(room.status!=='waiting'||room.maxPlayers===2||room.players.length<3)throw Error('Wait for at least three players before starting.');
      this._beginRoom(room);room.revision++;room.updated=this.now();
      await this.save();this.notify(code);
      return this.view(code,credential);
    });
  }
  view(code,credential) {
    const {room,seat}=this._auth(code,credential);
    return {code:room.code,mode:room.mode,status:room.status,revision:room.revision,seat,maxPlayers:room.maxPlayers??2,rematchVotes:room.rematchVotes??[false,false],series:publicSeries(room),
      players:room.players.map((p,i)=>({name:p.name,avatar:p.avatar,connected:[...(this.listeners.get(code)??[])].some(s=>s.seat===i)})),game:projectGame(room.game,seat),
      storage:this.storageKind};
  }
  async move(code,credential,action) {
    return this._exclusive(async()=>{
    const {room,seat}=this._auth(code,credential);
    if(!action || typeof action!=='object'||Array.isArray(action))throw Error('Invalid action.');
    // A retry with the same action ID is acknowledged but never played again, even after a
    // reconnection or a subsequent turn. A reused ID with different content is rejected.
    if(action.actionId!==undefined && !validActionId(action.actionId))throw Error('Invalid action ID.');
    const digest=hash(JSON.stringify(Object.fromEntries(Object.entries(action).filter(([key])=>key!=='actionId'))));
    const existing=action.actionId && room.recentActions?.find(entry=>entry.seat===seat&&entry.id===action.actionId);
    if(existing) {
      if(existing.digest!==digest)throw Error('Action ID was already used for a different move.');
      return this.view(code,credential);
    }
    if(action.revision!==room.revision)throw Error('The table changed before your move. Please try again.');
    const acknowledge=()=>{
      if(!action.actionId)return;
      room.recentActions??=[];
      room.recentActions.push({seat,id:action.actionId,digest});
      if(room.recentActions.length>ACTION_HISTORY_LIMIT)room.recentActions.splice(0,room.recentActions.length-ACTION_HISTORY_LIMIT);
    };
    if(action.type==='profile-avatar') {
      room.players[seat].avatar=safeAvatar(action.avatar);
      acknowledge();room.revision++;room.updated=this.now();await this.save();this.notify(code);
      return this.view(code,credential);
    }
    if(!room.game)throw Error('Wait for your friend to join before playing.');
    const game=room.game;
    if(action.type==='rematch-request'||action.type==='rematch-cancel') {
      if(game.winner===null)throw Error('Finish the match before requesting a rematch.');
      recordMatchResult(room); // Backfill completed legacy rooms on their first rematch vote.
      const votes=room.rematchVotes??Array(room.players.length).fill(false);
      const choice=action.type==='rematch-request';
      if(votes[seat]===choice)throw Error(choice?'You have already requested a rematch.':'No rematch request to cancel.');
      votes[seat]=choice;room.rematchVotes=votes;
      if(votes.every(Boolean)) {
        beginNextGame(room);
        room.game=securelyDeal(this.createGame(room.mode,randomBytes(4).readUInt32BE(),room.players.length));
        room.game.players.forEach((p,i)=>p.name=room.players[i].name);
        room.game.log=[`Rematch started: ${room.players.map(p=>p.name).join(', ')}.`];
        room.rematchVotes=Array(room.players.length).fill(false);
      }
      acknowledge();room.revision++;room.updated=this.now();await this.save();this.notify(code);
      return this.view(code,credential);
    }
    const kind=action.type;
    if(kind==='restart') {throw Error('Both players must agree before a new match.');
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
        case 'sequence-refill':
          if(game.kind!=='sequence')throw Error('Invalid sequence turn action.');
          outcome=replenishSequenceHand(game);break;
        case 'sequence-pass':
          if(game.kind!=='sequence')throw Error('Invalid sequence turn action.');
          outcome=passSequenceTurn(game);break;
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
      recordMatchResult(room);
    }
    acknowledge();room.revision++;room.updated=this.now();
    await this.save();this.notify(code);
    return this.view(code,credential);
    });
  }
}
