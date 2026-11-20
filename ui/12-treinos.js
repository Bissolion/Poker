// Treinos: 10 decisões do mesmo tipo seguidas, com nota no fim
let drill = null; // { type, i, res: [], cur: { d, fb, picked }, streak }
const DRILL_N = 10;
function drillView(g) {
  const seats = g.players.map((p, i) => ({
    name: p.name, label: p.profile ? p.profile.label : '', pos: g.posOf(i), stack: p.stack, bet: p.bet, folded: p.folded, allIn: p.allIn, out: false,
    tag: p.lastAction, hole: p.hole, mode: i === 0 ? 'up' : p.folded ? 'none' : 'back', turn: g.toAct === i, win: false, eq: null,
  }));
  return { seats, board: g.board, pot: g.potCollected(), street: E.STREET_LABEL[g.street], hl: new Set(), newFrom: null, made: null };
}
function drillLevel() { return Math.min(2, Math.floor((drill.streak || 0) / 3)); }
function nextDrill() { drill.cur = { d: E.makeDrill(drill.type, drillLevel()), fb: null, picked: null }; }
function renderDrills() {
  const el = $('studyBody');
  if (!drill) {
    const L = E.findLeaks(reg.decs, reg.hands), sug = L.length ? E.LEAK_DRILL[L[0].id] : null;
    el.innerHTML = `${tx`<p class="muted">Séries de ${DRILL_N} decisões do mesmo tipo, montadas direto no ponto da decisão. A cada 3 acertos seguidos, as mãos ficam mais perto da borda das faixas, onde a dúvida é real.</p>`}
      ${sug ? tx`<p class="muted">Sugerido para você: <b style="color:var(--ink)">${E.DRILLS[sug].name}</b>, pelo seu maior vazamento (${L[0].title.toLowerCase()}).</p>` : ''}
      <div class="dlist">${Object.entries(E.DRILLS).map(([k, v]) => { const st = stats.drills[k]; return `<button class="drow${k === sug ? ' sug' : ''}" type="button" data-dr="${k}"><b>${v.name}</b><span>${v.desc}</span><span class="best">${st ? st.best + '/' + DRILL_N : '–'}<small>${st ? 'recorde' : 'novo'}</small></span></button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-dr]').forEach(b => b.onclick = () => { drill = { type: b.dataset.dr, i: 0, res: [], streak: 0 }; nextDrill(); renderDrills(); });
    return;
  }
  if (drill.i >= DRILL_N) return renderDrillEnd();
  const { d, fb, picked } = drill.cur, g = d.g, L = g.legal(0), pre = g.street === 'preflop';
  const push = d.type === 'pushfold';
  const prog = Array.from({ length: DRILL_N }, (_, k) => `<i class="${drill.res[k] || (k === drill.i ? 'cur' : '')}"></i>`).join('');
  const callTxt = L.canCheck ? tx`Passar` : `Pagar<small>${L.toCall}</small>`;
  const raiseTxt = push || !L.canRaise ? 'All-in' : pre ? (g.raises ? '3-bet' : tx`Aumentar`) : L.isBet ? tx`Apostar` : tx`Aumentar`;
  const ctx = pre ? '' : tx`<p class="muted">Pote ${g.pot()}${L.toCall ? tx`, para pagar ${L.toCall} (precisa de ${pct(L.toCall / (g.pot() + L.toCall))} de equity)` : ''}. Sua mão: <b style="color:var(--ink)">${E.madeHand(g.players[0].hole, g.board).name}</b>${E.heroDraws(g.players[0].hole, g.board) ? ' + ' + E.heroDraws(g.players[0].hole, g.board).name : ''}.</p>`;
  const stackLine = push ? tx`<p class="muted">Seu stack: <b style="color:var(--ink)">${Math.round(E.effBB(g, 0) * 10) / 10} BB</b> efetivos.</p>` : '';
  el.innerHTML = `
    <div class="dhead"><button class="ghost" id="drBack" type="button">← Treinos</button><span><b>${E.DRILLS[drill.type].name}</b> · ${drill.i + 1}/${DRILL_N}</span></div>
    <div class="dprog" aria-hidden="true">${prog}</div>
    <div class="table mini">${tableHTML(drillView(g), 'md')}</div>
    ${stackLine}${ctx}
    ${fb ? `${fbHTML(fb)}${fb.tips ? tipsHTML(fb.tips) : ''}<button class="primary" id="drNext" type="button">${drill.i + 1 < DRILL_N ? tx`Próxima` : tx`Ver resultado`}</button>`
      : `<div class="btns"><button type="button" class="act fold" data-da="fold">Desistir</button><button type="button" class="act" data-da="call">${callTxt}</button><button type="button" class="act raise" data-da="raise" ${L.canRaise || push ? '' : 'disabled'}>${raiseTxt}</button></div>`}`;
  $('drBack').onclick = () => { drill = null; renderDrills(); };
  el.querySelectorAll('[data-da]').forEach(b => b.onclick = () => {
    let a = b.dataset.da; if (a === 'call' && L.canCheck) a = 'check';
    const r = E.gradeDrill(d, a);
    const names = { fold: tx`desistiu`, check: tx`passou`, call: tx`pagou`, raise: push ? 'all-in' : tx`aumentou` };
    drill.cur.fb = Object.assign({ street: E.STREET_LABEL[g.street], act: names[a] }, r);
    drill.res[drill.i] = r.grade;
    drill.streak = r.grade === 'good' ? (drill.streak || 0) + 1 : 0;
    r.grade === 'good' ? sfx.chip() : sfx.fold();
    renderDrills();
    const n = $('drNext'); if (n) n.focus();
  });
  const n = $('drNext'); if (n) n.onclick = () => { drill.i++; if (drill.i < DRILL_N) nextDrill(); renderDrills(); };
}
function renderDrillEnd() {
  const el = $('studyBody'), good = drill.res.filter(x => x === 'good').length, ok = drill.res.filter(x => x === 'ok').length;
  const score = good + Math.floor(ok / 2), st = stats.drills[drill.type] || { best: 0, played: 0 };
  if (!drill.saved) { st.played++; st.best = Math.max(st.best, score); stats.drills[drill.type] = st; save(); drill.saved = true; }
  el.innerHTML = `
    <div class="dhead"><button class="ghost" id="drBack" type="button">← Treinos</button><span><b>${E.DRILLS[drill.type].name}</b></span></div>
    <div class="result"><div class="big huge">${score}/${DRILL_N}</div><div class="sub">${tx`${good} boas, ${ok} ok e ${DRILL_N - good - ok} erros. Recorde: <b>${st.best}/${DRILL_N}</b>.`}</div></div>
    <div class="dprog" aria-hidden="true">${drill.res.map(r => `<i class="${r}"></i>`).join('')}</div>
    <button class="primary" id="drAgain" type="button">Treinar de novo</button>`;
  $('drBack').onclick = () => { drill = null; renderDrills(); };
  $('drAgain').onclick = () => { drill = { type: drill.type, i: 0, res: [], streak: drill.streak }; nextDrill(); renderDrills(); };
}
