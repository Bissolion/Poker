// Faixas 13×13
const GR = 'AKQJT98765432';
const ACT_LABEL = { 0: { raise: 'Abrir', call: 'Pagar', check: 'Passar', fold: 'Desistir' }, 1: { raise: '3-bet', call: 'Pagar', check: 'Passar', fold: 'Desistir' }, 2: { raise: '4-bet', call: 'Pagar', check: 'Passar', fold: 'Desistir' } };
const SCN = ['Ninguém aumentou', 'Contra aumento', 'Contra re-aumento'];
function cellOf(r, c) {
  const hi = 12 - Math.min(r, c), lo = 12 - Math.max(r, c);
  const suited = c > r, pair = r === c;
  const c1 = hi * 4, c2 = lo * 4 + (suited ? 0 : 1);
  const name = GR[12 - hi] + GR[12 - lo] + (pair ? '' : suited ? 's' : 'o');
  return { name, s: E.chen(c1, c2), combos: pair ? 6 : suited ? 4 : 12 };
}
const normCombo = s => s.replace(/10/g, 'T');
function renderRanges() {
  const el = $('studyBody'), g = game;
  if (rangeSt.hu == null) rangeSt.hu = g.activeCount() === 2;
  const hu = rangeSt.hu, nAct = hu ? 2 : 6, positions = hu ? ['BTN', 'BB'] : ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
  if (!rangeSt.pos || !positions.includes(rangeSt.pos)) rangeSt.pos = g.players[0].folded || !positions.includes(g.posOf(0)) ? 'BTN' : g.posOf(0);
  const { pos, scn } = rangeSt;
  const mine = !g.handOver && !g.players[0].folded ? normCombo(E.comboName(g.players[0].hole[0], g.players[0].hole[1])) : null;
  const canCheck = scn === 0 && pos === 'BB';
  const tally = { raise: 0, call: 0, check: 0, fold: 0 };
  let cells = '';
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
    const x = cellOf(r, c), rule = E.preflopRule(x.s, pos, scn, canCheck, nAct);
    tally[rule.rec] += x.combos;
    cells += `<button type="button" class="cell ${rule.rec}${x.name === mine ? ' mine' : ''}${x.name === rangeSt.sel ? ' sel' : ''}" data-n="${x.name}" data-s="${x.s}" data-a="${rule.rec}" data-t="${rule.t}" data-rr="${rule.rr}">${x.name}</button>`;
  }
  const L = ACT_LABEL[scn];
  const order = canCheck ? ['raise', 'check'] : ['raise', 'call', 'fold'].filter(k => k !== 'call' || scn > 0);
  const colors = { raise: 'var(--brass)', call: 'var(--call)', check: 'var(--check)', fold: 'var(--surface-2)' };
  el.innerHTML = `
    <div class="seg" role="group" aria-label="Mesa"><button type="button" class="chip" data-hu="0" aria-pressed="${!hu}">6 jogadores</button><button type="button" class="chip" data-hu="1" aria-pressed="${hu}">Heads-up</button></div>
    <div class="seg" role="group" aria-label="Situação">${SCN.map((t, k) => `<button type="button" class="chip" data-scn="${k}" aria-pressed="${k === scn}">${t}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Posição">${positions.map(p => `<button type="button" class="chip" data-pos="${p}" aria-pressed="${p === pos}">${p}</button>`).join('')}</div>
    <div class="grid13" role="grid" aria-label="Grade de mãos iniciais">${cells}</div>
    <div class="rlegend">${order.map(k => `<span style="--c:${colors[k]}">${L[k]} ${pct(tally[k] / 1326)}</span>`).join('')}${mine ? '<span class="mk">sua mão</span>' : ''}</div>
    <div class="cell-info" id="cellInfo">Toque numa mão para ver a força e a decisão. Acima da diagonal: mesmo naipe (s); abaixo: naipes diferentes (o).</div>
    <p class="muted">${E.POS_LABEL[pos]}${hu ? ' no heads-up' : ''}, ${SCN[scn].toLowerCase()}. Esta é a mesma regra que o coach usa nas dicas: um ponto de partida simples, não uma estratégia ótima. Com 12 BB ou menos, o coach troca para all-in ou desistir.</p>`;
  const info = (n, s, a, t, rr) => {
    const why = scn === 0 ? (canCheck ? `aumente com ${t}+, senão passe de graça` : `abra com ${t}+`) : scn === 1 ? `pague com ${t}+, 3-bet com ${rr}+` : `pague com ${t}+, 4-bet com ${rr}+`;
    $('cellInfo').innerHTML = `<b>${n}</b> · força ${s}. No ${E.POS_LABEL[pos]}: <b>${L[a].toLowerCase()}</b> (regra: ${why}).`;
  };
  el.querySelectorAll('[data-hu]').forEach(b => b.onclick = () => { rangeSt.hu = b.dataset.hu === '1'; renderRanges(); });
  el.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => { rangeSt.scn = +b.dataset.scn; renderRanges(); });
  el.querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { rangeSt.pos = b.dataset.pos; renderRanges(); });
  el.querySelectorAll('.cell').forEach(b => b.onclick = () => {
    rangeSt.sel = b.dataset.n;
    el.querySelectorAll('.cell.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    info(b.dataset.n, b.dataset.s, b.dataset.a, b.dataset.t, b.dataset.rr);
  });
  const sel = rangeSt.sel && el.querySelector(`.cell[data-n="${normCombo(rangeSt.sel)}"]`);
  if (sel) { sel.classList.add('sel'); info(sel.dataset.n, sel.dataset.s, sel.dataset.a, sel.dataset.t, sel.dataset.rr); }
}

