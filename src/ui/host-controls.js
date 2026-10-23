/** Presentational-only host controls: no credentials or hidden cards enter this renderer. */
export function renderHostControls(view, escapeHtml) {
  if (!view || view.seat !== 0) return '';
  const canPause=view.status==='playing' && view.game?.winner===null;
  const vacant=view.status==='playing' ? (view.players??[]).flatMap((player,seat)=>
    seat!==0&&!player.bot&&!player.connected&&view.game?.winner===null ? [
      `<button class="btn btn-outline" data-action="host-bot-takeover" data-seat="${seat}">Replace ${escapeHtml(player.name)} with a bot</button>`
    ] : []) : [];
  return `<section class="host-controls" aria-label="Host controls"><div class="eyebrow">HOST CONTROLS · GAMES NIGHT</div>
 <div class="host-buttons"><button class="btn btn-outline" data-action="host-tv-create">${view.tvEnabled?'Replace TV link':'Create TV display link'}</button>
 ${view.tvEnabled?'<button class="btn btn-ghost" data-action="host-tv-disable">Disable TV link</button>':''}
 ${canPause?`<button class="btn btn-outline" data-action="host-${view.paused?'resume':'pause'}">${view.paused?'▶ Resume table':'Ⅱ Pause table'}</button>`:''}${vacant.join('')}</div>
 <p class="host-help">TV displays show scores, turns and shared cards only — never private hands. Replacing or disabling a TV link revokes the previous one. Replacing a player requires two minutes without a connection, cannot be undone within this match and cancels their saved access.</p></section>`;
}
