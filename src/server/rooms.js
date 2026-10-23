import {getGameModule,applyGameAction} from './game-modules.js';
import {projectGame} from './projections.js';
export {projectGame} from './projections.js';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {createSeries,ensureSeries,recordMatchResult,beginNextGame,publicSeries} from './series.js';
import {tournamentFormat,GROUP_ROTATION,TOUR_ROTATION} from './tournament.js';
import {botPersona} from '../bot-personalities.js';

const GROUP_MODES = new Set(['eight-shift','stack-run','malice-duel','tile-royale','phase-quest','contract-club','crown-circuit','shanghai-nights']);
const MODES = new Set(['stack-run','phase-quest','malice-duel','contract-club','crown-circuit','number-ladder','shanghai-nights','tile-royale','low-glow','eight-shift']);
const validCode = code => /^[A-Z2-9]{6}$/.test(code ?? '');
const hash = value => createHash('sha256').update(value).digest('hex');
const validActionId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{12,90}$/.test(id);
const ACTION_HISTORY_LIMIT = 80;
export const MAX_STREAMS_PER_SEAT = 3;
export const MAX_TV_STREAMS = 8;
export const BOT_TAKEOVER_GRACE_MS = 120_000;
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

/** In-process private room registry; optional snapshot file for restart persistence. */
export class RoomStore {
  constructor({storageFile=null, snapshotStore=null, now=()=>Date.now()}={}) {
    if(storageFile && snapshotStore) throw Error('Configure one room storage backend, not two.');
    this.rooms=new Map(); this.storageFile=storageFile;this.snapshotStore=snapshotStore;this.now=now;
    this.storageKind=snapshotStore?'postgres':storageFile?'filesystem-only':'memory-only';
    this.listeners=new Map();this.pendingWrite=Promise.resolve();this.operationQueue=Promise.resolve();
    this.lastSeen=new Map();this.disconnectedSince=new Map();this.bootedAt=this.now();
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
          record.format=tournamentFormat(record.format);record.startMode??=record.mode;
          if(record.format==='mixed'&&record.maxPlayers>2){
            record.gamePool??=GROUP_ROTATION.slice();
            record.roundLimit??=5;
          }
          ensureSeries(record);record.recentActions??=[];record.rematchVotes??=Array(record.players.length).fill(false);record.paused??=false;record.tvEnabled??=false;this.rooms.set(record.code,record);}
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
  _seatKey(code,seat) {return `${code}:${seat}`;}
  _isSeatConnected(code,seat) {
    return [...(this.listeners.get(code)??[])].some(entry=>entry.seat===seat);
  }
  _canReplaceSeat(room,seat) {
    if(room.status!=='playing'||!room.game||room.game.winner!==null||seat<=0||seat>=room.players.length||room.players[seat].bot)return false;
    if(this._isSeatConnected(room.code,seat))return false;
    const key=this._seatKey(room.code,seat);
    // An HTTP-only player is active too. A reconnect or state request resets the clock.
    // On server restart start the grace period afresh even if stored timestamps are old.
    const since=Math.max(this.bootedAt,room.startedAt??room.created??this.bootedAt,
      this.disconnectedSince.get(key)??0,this.lastSeen.get(key)??0);
    return this.now()-since>=BOT_TAKEOVER_GRACE_MS;
  }
  canSubscribe(code,seat) {
    // At most three streaming tabs per authenticated seat; other players are unaffected.
    const subscribers=this.listeners.get(code);
    return !subscribers || [...subscribers].filter(entry=>entry.seat===seat).length<(seat===-1?MAX_TV_STREAMS:MAX_STREAMS_PER_SEAT);
  }
  subscribe(code,fn,seat=null) {
    if(!this.canSubscribe(code,seat))throw Error('Too many open table connections. Close unused tabs.');
    const subscribers=this.listeners.get(code)??new Set();
    const entry={fn,seat};subscribers.add(entry);this.listeners.set(code,subscribers);
    if(Number.isInteger(seat)&&seat>=0) {
      const key=this._seatKey(code,seat);this.disconnectedSince.delete(key);this.lastSeen.set(key,this.now());
    }
    this.notify(code);
    return ()=>{
      subscribers.delete(entry);
      if(!subscribers.size)this.listeners.delete(code);
      if(Number.isInteger(seat)&&seat>=0&&!this._isSeatConnected(code,seat))
        this.disconnectedSince.set(this._seatKey(code,seat),this.now());
      this.notify(code);
    };
  }
  prune() { // Keep completed and abandoned rooms for seven days, including persisted sessions.
    for(const [code,room] of this.rooms) if(this.now()-room.updated>7*86400e3 && !this.listeners.has(code)) {
      this.rooms.delete(code);
      for(let seat=0;seat<room.players.length;seat++) {
        const key=this._seatKey(code,seat);this.lastSeen.delete(key);this.disconnectedSince.delete(key);
      }
    }
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
    this.lastSeen.set(this._seatKey(code,seat),this.now());
    return {room,seat};
  }
  async create(options) {
    if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid room settings.');
    let {mode,name,avatar,format='single',maxPlayers=2,matchLength='full',gamePool=null,roundLimit=null}=options;
    return this._exclusive(async()=>{
    this.prune();
    if(this.rooms.size>=1000)throw Error('The room service is full. Try again later.');
    if(!MODES.has(mode)) throw Error('Choose one of the available games.');
    if(!['quick','full'].includes(matchLength))throw Error('Choose a full or quick match.');
    if(!['phase-quest','contract-club','crown-circuit','shanghai-nights'].includes(mode))matchLength='full';
    format=tournamentFormat(format);
    if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6)throw Error('Choose between 2 and 6 players.');
    if(maxPlayers>2&&!GROUP_MODES.has(mode))
      throw Error('Group tables support eight selected games; choose a group-compatible game.');
    if(gamePool!==null) {
      if(format!=='mixed'||!Array.isArray(gamePool)||gamePool.length<1||gamePool.length>10||
        new Set(gamePool).size!==gamePool.length||gamePool.some(id=>!MODES.has(id)))
        throw Error('Choose a valid Games Night Mix game pool.');
    }
    if(format==='mixed') {
      gamePool??=(maxPlayers>2?GROUP_ROTATION:TOUR_ROTATION).slice();
      if(maxPlayers>2&&gamePool.some(id=>!GROUP_MODES.has(id)))
        throw Error('Group Games Night Mix supports only six-player-compatible games.');
      if(!gamePool.includes(mode))throw Error('First game must be in the selected Games Night Mix pool.');
      if(roundLimit!==null&&(!Number.isInteger(roundLimit)||roundLimit<3||roundLimit>12))
        throw Error('Choose 3–12 tournament rounds.');
      if(maxPlayers>2)roundLimit??=5;
    } else if(gamePool!==null||roundLimit!==null)throw Error('Custom rounds are only available for Games Night Mix.');
    const player={name:safeName(name),avatar:safeAvatar(avatar)};
    const credential=token();player.tokenHash=hash(credential);
    let code=roomCode();while(this.rooms.has(code))code=roomCode();
    const room={code,mode,startMode:mode,format,maxPlayers,matchLength,gamePool,roundLimit,paused:false,tvEnabled:false,players:[player],status:'waiting',game:null,revision:1,created:this.now(),updated:this.now(),rematchVotes:Array(maxPlayers).fill(false),recentActions:[],gameNumber:1,series:createSeries(1,maxPlayers)};
    this.rooms.set(code,room);await this.save();return {code,token:credential,seat:0,view:this.view(code,credential)};
    });
  }
  createGame(mode,seed,playerCount=2,matchLength='full') {
    return getGameModule(mode).create({mode,seed,playerCount,matchLength});
  }
  /** Run server-controlled AI seats without revealing the room state to a browser bot.
   * The bot engines inspect the current seat and public table only. Each server
   * reshuffle callback uses cryptographic randomness, and the loop is bounded. */
  _advanceBots(room) {
    if(room.status!=='playing'||!room.game)return;
    for(let step=0;step<room.players.length*4;step++) {
      const state=room.game;
      if(state.winner!==null||state.roundWinner!==undefined&&state.roundWinner!==null)break;
      const seat=state.active,player=room.players[seat];
      if(!player?.bot)break;
      const persona=botPersona(player.avatar);
      const selected=player.botLevel??'standard';
      const difficulty=selected==='standard'?(persona.style==='planner'?'expert':
        persona.style==='reckless'?'easy':'standard'):selected;
      const next=getGameModule(room.mode).botMove(state,difficulty,seat,cryptoShuffle);
      if(JSON.stringify(next)===JSON.stringify(state))break;
      room.game=next;
      if(step%3===0)next.log.unshift(`${player.name}: “${persona.taunts[(next.turn??next.round??1)%persona.taunts.length]}”`);
      if(next.log.length>70)next.log.length=70;
      recordMatchResult(room);
    }
  }
  // Called only while a room is waiting. Host can launch a group early once 3 seats are filled.
  _beginRoom(room) {
    const seed=randomBytes(4).readUInt32BE();
    room.game=securelyDeal(this.createGame(room.mode,seed,room.players.length,room.format==='mixed'?'full':room.matchLength));
    room.game.players.forEach((p,i)=>{p.name=room.players[i].name;});
    room.game.log=[`Private table ready: ${room.players.map(p=>p.name).join(', ')}.`];
    room.status='playing';room.startedAt=this.now();room.paused=false;room.rematchVotes=Array(room.players.length).fill(false);
    room.series=createSeries(1,room.players.length);
    if(room.format==='mixed'&&Number.isInteger(room.roundLimit)) {
      room.series.roundLimit=room.roundLimit;
      room.series.points=Array(room.players.length).fill(0);
    }
    this._advanceBots(room);
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
    return {code:room.code,mode:room.mode,matchLength:room.matchLength??'full',status:room.status,paused:Boolean(room.paused),tvEnabled:Boolean(room.tvEnabled),revision:room.revision,seat,maxPlayers:room.maxPlayers??2,rematchVotes:room.rematchVotes??[false,false],series:publicSeries(room),
      players:room.players.map((p,i)=>({name:p.name,avatar:p.avatar,bot:Boolean(p.bot),connected:Boolean(p.bot)||this._isSeatConnected(code,i),takeoverEligible:seat===0?this._canReplaceSeat(room,i):false})),game:projectGame(room.game,seat),
      storage:this.storageKind};
  }
  /** A completely separate, allowlisted projection for TV. Never reuse projectGame here:
   * projectGame intentionally reveals an authenticated player's private hand. */
  spectatorView(code,credential) {
    const room=this._find(code);
    if(!room.tvEnabled||!room.tvTokenHash||typeof credential!=='string'||credential.length<30||credential.length>100||hash(credential)!==room.tvTokenHash)
      throw Error('The TV link is invalid or has been revoked. Ask the host for a new link.');
    const game=room.game;
    const playerPublic=(p,i)=>({
      seat:i,name:room.players[i].name,avatar:room.players[i].avatar,
      connected:Boolean(room.players[i]?.bot)||[...(this.listeners.get(code)??[])].some(entry=>entry.seat===i),
      bot:Boolean(room.players[i]?.bot),
      handCount:Array.isArray(p.hand)?p.hand.length:null,
      rackCount:Array.isArray(p.rack)?p.rack.length:null,
      stockCount:Array.isArray(p.stock)?p.stock.length:null,
      mission:Number.isInteger(p.mission)?p.mission:null,
      score:Number.isFinite(p.score)?p.score:null,
      laidDown:Boolean(p.laidDown),
      // Only card faces marked revealed/cleared by the engine are public.
      ...(game.kind==='low'?{grid:p.grid.map(c=>({revealed:Boolean(c.revealed||c.cleared),cleared:Boolean(c.cleared),value:c.revealed&&!c.cleared?c.value:null}))}:{}),
      ...(game.kind==='sequence'?{discards:p.discards.map(d=>({count:d.length,top:d.at(-1)??null}))}:{})
    });
    return {
      code:room.code,mode:room.mode,status:room.status,paused:Boolean(room.paused),
      revision:room.revision,maxPlayers:room.maxPlayers,series:publicSeries(room),
      players:game?game.players.map(playerPublic):room.players.map((p,i)=>({seat:i,name:p.name,avatar:p.avatar,connected:false})),
      board:game?getGameModule(room.mode).viewForTV(game):null
    };
  }
  async hostAction(code,credential,action) {
    return this._exclusive(async()=>{
      const {room,seat}=this._auth(code,credential);
      if(seat!==0)throw Error('Only the host can manage this table.');
      if(!action||typeof action!=='object'||Array.isArray(action))throw Error('Invalid host action.');
      if(!['pause','resume','tv-create','tv-disable','bot-fill','bot-remove','bot-takeover'].includes(action.type))throw Error('Unknown host action.');
      if(action.revision!==room.revision)throw Error('The table changed before your action. Please try again.');
      let watchKey=null;
      if(action.type==='bot-fill'||action.type==='bot-remove') {
        if(room.status!=='waiting')throw Error('Add or remove bot seats before starting the table.');
        if(action.type==='bot-fill') {
          const level=action.level??'standard';
          if(!['easy','standard','expert'].includes(level))throw Error('Choose a valid bot difficulty.');
          while(room.players.length<room.maxPlayers){
            const used=new Set(room.players.map(p=>p.avatar));
            const avatar=Array.from({length:16},(_,i)=>i+1).find(id=>!used.has(id))??14;
            const persona=botPersona(avatar);
            room.players.push({name:persona.name,avatar,bot:true,botLevel:level,tokenHash:null});
          }
          this._beginRoom(room);
        } else {
          if(room.players.length<=1||!room.players.at(-1).bot)throw Error('The last seat is not a removable bot.');
          room.players.pop();
        }
      } else if(action.type==='bot-takeover') {
        if(!Number.isInteger(action.seat)||!this._canReplaceSeat(room,action.seat))
          throw Error('That seat is still active, or has not been disconnected for two minutes.');
        const target=room.players[action.seat];
        const level=action.level??'standard';
        if(!['easy','standard','expert'].includes(level))throw Error('Choose a valid bot difficulty.');
        const original=target.name;
        // Irreversible within this match: invalidate the former human credential.
        // Never give a host access to the abandoned human's private cards.
        target.tokenHash=null;target.bot=true;target.botLevel=level;
        target.replacedName=original;target.name=`House Bot (${original})`;
        if(room.game?.players[action.seat])room.game.players[action.seat].name=target.name;
        room.game?.log?.unshift(`House Bot has taken over ${original}'s vacant seat.`);
        if(!room.paused)this._advanceBots(room);
      } else if(action.type==='pause'||action.type==='resume') {
        if(room.status!=='playing'||!room.game||room.game.winner!==null)throw Error('Only an active table can be paused or resumed.');
        const paused=action.type==='pause';
        if(room.paused===paused)throw Error(paused?'Table is already paused.':'Table is not paused.');
        room.paused=paused;
      } else if(action.type==='tv-create') {
        // A fresh credential revokes every previously shared TV link.
        watchKey=token();room.tvTokenHash=hash(watchKey);room.tvEnabled=true;
      } else {room.tvEnabled=false;room.tvTokenHash=null;}
      room.updated=this.now();room.revision++;
      await this.save();this.notify(code);
      return {view:this.view(code,credential),...(watchKey?{watchKey}:{})};
    });
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
    if(room.paused)throw Error('The host has paused the table. Please wait for the host to resume.');
    if(!room.game)throw Error('Wait for your friend to join before playing.');
    const game=room.game;
    if(action.type==='rematch-request'||action.type==='rematch-cancel') {
      if(game.winner===null)throw Error('Finish the match before requesting a rematch.');
      recordMatchResult(room); // Backfill completed legacy rooms on their first rematch vote.
      const votes=room.rematchVotes??Array(room.players.length).fill(false);
      const choice=action.type==='rematch-request';
      if(votes[seat]===choice)throw Error(choice?'You have already requested a rematch.':'No rematch request to cancel.');
      votes[seat]=choice;
      // House Bots agree to the next game automatically; no non-human token can vote.
      if(choice)room.players.forEach((player,i)=>{if(player.bot)votes[i]=true;});
      room.rematchVotes=votes;
      if(votes.every(Boolean)) {
        beginNextGame(room);
        room.game=securelyDeal(this.createGame(room.mode,randomBytes(4).readUInt32BE(),room.players.length,room.format==='mixed'?'full':room.matchLength));
        room.game.players.forEach((p,i)=>p.name=room.players[i].name);
        room.game.log=[`Rematch started: ${room.players.map(p=>p.name).join(', ')}.`];
        this._advanceBots(room);
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
      } else if(game.active!==seat&&kind!=='contract-buy')throw Error('It is your opponent’s turn.');
      const outcome=applyGameAction(game,action,{seat,reshuffle:cryptoShuffle,secureDeal:securelyDeal});
      if(outcome?.error)throw Error(outcome.error);
      room.game=outcome.state;
      recordMatchResult(room);
      this._advanceBots(room);
    }
    acknowledge();room.revision++;room.updated=this.now();
    await this.save();this.notify(code);
    return this.view(code,credential);
    });
  }
}
