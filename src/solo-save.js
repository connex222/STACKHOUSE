// Local-only solo match snapshots. Private online sessions stay server-authoritative.
export const SOLO_SAVE_KEY = 'stackhouse.solo.v1';
export const SOLO_SAVE_VERSION = 1;
const KINDS = Object.freeze({
  'stack-run':'sequence','phase-quest':'contract','malice-duel':'sequence',
  'contract-club':'contract','crown-circuit':'contract','number-ladder':'rack',
  'shanghai-nights':'contract','tile-royale':'tiles','low-glow':'low','eight-shift':'eights'
});
const MAX_SNAPSHOT_LENGTH = 250_000;

export function encodeSoloSave({mode,game,handOrders={},matchId=null}) {
  if(!Object.hasOwn(KINDS,mode)||!game||game.mode!==mode||game.kind!==KINDS[mode]||
     !Array.isArray(game.players)||game.players.length!==2)throw Error('Cannot save an invalid solo match.');
  const payload={version:SOLO_SAVE_VERSION,mode,game,handOrders};
  if(matchId!==null){if(typeof matchId!=='string'||!/^[-a-zA-Z0-9_]{12,90}$/.test(matchId))throw Error('Invalid solo match ID.');payload.matchId=matchId;}
  const encoded=JSON.stringify(payload);
  if(encoded.length>MAX_SNAPSHOT_LENGTH)throw Error('Solo save is too large.');
  return encoded;
}
export function decodeSoloSave(raw) {
  if(typeof raw!=='string'||!raw||raw.length>MAX_SNAPSHOT_LENGTH)return null;
  try {
    const data=JSON.parse(raw);
    if(!data||data.version!==SOLO_SAVE_VERSION||!Object.hasOwn(KINDS,data.mode)||
       !data.game||data.game.mode!==data.mode||data.game.kind!==KINDS[data.mode]||
       !Array.isArray(data.game.players)||data.game.players.length!==2||
       !Number.isInteger(data.game.active)||data.game.active<0||data.game.active>1||
       !Array.isArray(data.game.log)||!data.handOrders||
       typeof data.handOrders!=='object'||Array.isArray(data.handOrders))return null;
    const handOrders={};
    for(const [zone,tokens] of Object.entries(data.handOrders)) {
      if(!['sequence','contract','tiles','eights'].includes(zone))continue;
      if(Array.isArray(tokens)&&tokens.length<=100&&tokens.every(t=>typeof t==='string'&&t.length<=120))handOrders[zone]=tokens;
    }
    return {mode:data.mode,game:data.game,handOrders,...(typeof data.matchId==='string'&&/^[-a-zA-Z0-9_]{12,90}$/.test(data.matchId)?{matchId:data.matchId}:{})};
  }catch{return null;}
}
