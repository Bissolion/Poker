// Faixas 13×13, pelas tabelas modernas (e pelas tabelas de all-in com stack curto)
const GR = 'AKQJT98765432';
function cellOf(r, c) {
  const hi = 12 - Math.min(r, c), lo = 12 - Math.max(r, c);
  const suited = c > r, pair = r === c;
  const c1 = hi * 4, c2 = lo * 4 + (suited ? 0 : 1);
  const name = GR[12 - hi] + GR[12 - lo] + (pair ? '' : suited ? 's' : 'o');
  return { name, s: E.chen(c1, c2), combos: pair ? 6 : suited ? 4 : 12 };
}
const normCombo = s => s.replace(/10/g, 'T');
const RSCN = [['open', tx`Abrir`], ['vsopen', tx`Contra abertura`], ['vs3bet', tx`Contra 3-bet`], ['push', tx`All-in curto`]];
const PRE_ORDER = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
const DEPTHS = [3, 5, 8, 10, 12, 15];
// Monta o que a grade mostra: para cada mão, frequência de "aumentar" (r) e de "pagar" (c)
function gridModel(st) {
  const nAct = st.hu ? 2 : 6;
  if (st.scn === 'push') {
    const callMode = st.pos === 'BB';
    const k = st.hu ? 1 : callMode ? Math.max(1, PRE_ORDER.length - 1 - PRE_ORDER.indexOf(st.opener)) : PRE_ORDER.length - 1 - PRE_ORDER.indexOf(st.pos);
    const tab = callMode ? E.CALL_MAX[k] || {} : E.PUSH_MAX[k] || {};
    const f = n => (tab[n] || 0) >= st.depth ? 1 : 0;
    return { nAct, f: n => callMode ? { r: 0, c: f(n) } : { r: f(n), c: 0 }, labels: { r: 'All-in', c: tx`Pagar o all-in` }, txt: callMode ? tx`Big blind pagando all-in do ${E.POS_LABEL[st.opener] || tx`Botão`} com ${st.depth} BB` : tx`All-in com ${st.depth} BB, ${k} ${k > 1 ? tx`jogadores` : tx`jogador`} por agir`, max: n => tab[n] || 0 };
  }
  const raises = st.scn === 'open' ? 0 : st.scn === 'vsopen' ? 1 : 2;
  const sc = E.rangeScenario(st.pos, nAct, raises, st.scn === 'vsopen' ? st.opener : st.pos, st.scn === 'vs3bet', st.pos === 'BB');
  const verb = raises === 0 ? (st.pos === 'BB' ? tx`Aumentar` : tx`Abrir`) : raises === 1 ? '3-bet' : '4-bet';
  return { nAct, f: n => ({ r: sc.raise[n] || 0, c: sc.call[n] || 0 }), labels: { r: verb, c: tx`Pagar` }, txt: sc.txt };
}
// Posições válidas e quem pode ter aberto antes de cada uma
function gridPositions(st) {
  if (st.hu) return st.scn === 'vsopen' ? ['BB'] : st.scn === 'vs3bet' ? ['BTN'] : st.scn === 'push' ? ['BTN', 'BB'] : ['BTN', 'BB'];
  if (st.scn === 'open') return PRE_ORDER;
  if (st.scn === 'vsopen') return PRE_ORDER.slice(1);
  if (st.scn === 'vs3bet') return PRE_ORDER.slice(0, 5);
  return PRE_ORDER;
}
function renderRanges() {
  const el = $('studyBody'), g = game;
  const st = rangeSt;
  if (st.hu == null) st.hu = g.activeCount() === 2;
  if (!RSCN.some(([k]) => k === st.scn)) st.scn = 'open';
  if (!st.depth) st.depth = 10;
  const positions = gridPositions(st);
  if (!positions.includes(st.pos)) st.pos = positions.includes(g.posOf(0)) ? g.posOf(0) : positions[positions.length > 2 ? 3 : 0];
  const openers = st.hu ? ['BTN'] : PRE_ORDER.slice(0, PRE_ORDER.indexOf(st.pos === 'BB' && st.scn === 'push' ? 'BB' : st.pos)).filter(x => x !== 'BB');
  if ((st.scn === 'vsopen' || (st.scn === 'push' && st.pos === 'BB')) && !openers.includes(st.opener)) st.opener = openers[openers.length - 1];
  const M = gridModel(st);
  const mine = !g.handOver && !g.players[0].folded ? E.classOf(g.players[0].hole[0], g.players[0].hole[1]) : null;
  let rT = 0, cT = 0, cells = '';
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
    const x = cellOf(r, c), f = M.f(x.name);
    rT += f.r * x.combos; cT += f.c * x.combos;
    const pure = f.r === 1 ? 'raise' : f.c === 1 ? 'call' : f.r + f.c === 0 ? 'fold' : 'mix';
    const bg = pure === 'mix' ? ` style="background:linear-gradient(to right, var(--brass) 0 ${f.r * 100}%, var(--call) ${f.r * 100}% ${(f.r + f.c) * 100}%, var(--surface-2) ${(f.r + f.c) * 100}% 100%)"` : '';
    cells += `<button type="button" class="cell ${pure}${x.name === mine ? ' mine' : ''}${x.name === st.sel ? ' sel' : ''}"${bg} data-n="${x.name}" data-s="${x.s}" data-r="${f.r}" data-c="${f.c}">${x.name}</button>`;
  }
  const chips = (key, list, val, label = v => v) => `<div class="seg" role="group">${list.map(v => `<button type="button" class="chip" data-${key}="${v}" aria-pressed="${String(v) === String(val)}">${label(v)}</button>`).join('')}</div>`;
  el.innerHTML = `
    <div class="seg" role="group" aria-label="${tx`[[jogo]]Mesa`}"><button type="button" class="chip" data-hu="0" aria-pressed="${!st.hu}">6 jogadores</button><button type="button" class="chip" data-hu="1" aria-pressed="${st.hu}">Heads-up</button></div>
    ${chips('scn', RSCN.map(x => x[0]), st.scn, v => RSCN.find(x => x[0] === v)[1])}
    <div class="field"><span class="field-label">${st.scn === 'push' && st.pos === 'BB' ? tx`Você (pagando)` : tx`Sua posição`}</span>${chips('pos', positions, st.pos)}</div>
    ${(st.scn === 'vsopen' || (st.scn === 'push' && st.pos === 'BB')) && !st.hu ? `<div class="field"><span class="field-label">${st.scn === 'push' ? tx`Quem foi all-in` : tx`Quem abriu`}</span>${chips('op', openers, st.opener)}</div>` : ''}
    ${st.scn === 'push' ? `<div class="field"><span class="field-label">Stack efetivo</span>${chips('dp', DEPTHS, st.depth, v => v + ' BB')}</div>` : ''}
    <div class="grid13" role="grid" aria-label="Grade de mãos iniciais">${cells}</div>
    <div class="rlegend">${rT ? `<span style="--c:var(--brass)">${M.labels.r} ${pct(rT / 1326)}</span>` : ''}${cT ? `<span style="--c:var(--call)">${M.labels.c} ${pct(cT / 1326)}</span>` : ''}<span style="--c:linear-gradient(to right, var(--brass) 50%, var(--surface-2) 50%)">Mista</span>${mine ? '<span class="mk">sua mão</span>' : ''}</div>
    <div class="cell-info" id="cellInfo">Toque numa mão para ver a decisão. Acima da diagonal: mesmo naipe (s); abaixo: naipes diferentes (o). Células divididas são jogadas mistas.</div>
    <p class="muted">${tx`${M.txt}. Faixas aproximadas de 6 jogadores com 100 BB, no estilo das tabelas de solver; o all-in curto vem do equilíbrio calculado pelo próprio app. São a referência do coach e o ponto de partida dos bots.`}</p>`;
  const info = b => {
    const n = b.dataset.n, r = +b.dataset.r, c = +b.dataset.c, fold = Math.max(0, 1 - r - c);
    const p = [r ? `${M.labels.r.toLowerCase()} ${r < 1 ? pct(r) : ''}`.trim() : '', c ? `${M.labels.c.toLowerCase()} ${c < 1 ? pct(c) : ''}`.trim() : '', fold && (r || c) ? tx`desistir ${pct(fold)}` : ''].filter(Boolean);
    const extra = M.max ? tx` Vale até ${M.max(n) || 0} BB.` : '';
    $('cellInfo').innerHTML = tx`<b>${n}</b> · força de Chen ${b.dataset.s}. ${p.length ? p.join(', ').replace(/^./, x => x.toUpperCase()) : tx`Desistir`}.${extra}`;
  };
  el.querySelectorAll('[data-hu]').forEach(b => b.onclick = () => { st.hu = b.dataset.hu === '1'; renderRanges(); });
  el.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => { st.scn = b.dataset.scn; renderRanges(); });
  el.querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { st.pos = b.dataset.pos; renderRanges(); });
  el.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { st.opener = b.dataset.op; renderRanges(); });
  el.querySelectorAll('[data-dp]').forEach(b => b.onclick = () => { st.depth = +b.dataset.dp; renderRanges(); });
  el.querySelectorAll('.cell').forEach(b => b.onclick = () => {
    st.sel = b.dataset.n;
    el.querySelectorAll('.cell.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    info(b);
  });
  const sel = st.sel && el.querySelector(`.cell[data-n="${normCombo(st.sel)}"]`);
  if (sel) { sel.classList.add('sel'); info(sel); }
}
