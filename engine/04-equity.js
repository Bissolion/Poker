// ---------- Leitura de faixas depois do flop ----------
// Nível da mão num board parcial: 1 = ás/overcards, 1.5 = gutshot, 2 = par médio ou projeto forte,
// 2.5 = top pair/overpair, 3 = dois pares ou melhor (usando carta própria)
function handLevel(a, b, board, boardCat) {
  const cat = catOf(evalHand([a, b, ...board]));
  const top = Math.max(...board.map(rankOf)), ra = rankOf(a), rb = rankOf(b);
  let s = 0;
  if (cat > boardCat) {
    if (cat >= 2) s = 3;
    else {
      const pr = ra === rb ? ra : board.some(c => rankOf(c) === ra) ? ra : rb;
      s = pr >= top ? 2.5 : 2;
    }
  }
  if (s < 2 && board.length < 5) {
    const d = drawsOf([a, b], board);
    if (d.some(x => x.outs >= 8)) s = Math.max(s, 2); else if (d.length) s = Math.max(s, 1.5);
  }
  if (s < 1 && (ra === 12 || rb === 12 || (ra > top && rb > top))) s = 1;
  return s;
}
const BLUFF_ALLOW = 0.15; // fração das mãos que podem ser blefe/jogada fora da faixa

// ---------- Equity por Monte Carlo ----------
// opps: [{minChen, reads}] — faixa estimada pela ação pré-flop e pelas apostas/calls depois do flop
function equity(hole, board, opps, iters = 1000, rng = Math.random) {
  const used = new Set([...hole, ...board]);
  const pool = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) pool.push(c);
  const arr = pool.slice();
  let total = 0;
  const need = 5 - board.length;
  const cons = opps.map(o => (o.reads || []).filter(r => r.n <= board.length).map(r => {
    const bp = board.slice(0, r.n);
    return { bp, lv: r.lv, bc: catOf(evalHand(bp)) };
  }));
  for (let it = 0; it < iters; it++) {
    let end = arr.length;
    const draw = () => { const i = Math.floor(rng() * end); const c = arr[i]; arr[i] = arr[end - 1]; arr[end - 1] = c; end--; return c; };
    const oh = [];
    for (let k = 0; k < opps.length; k++) {
      const o = opps[k], cs = cons[k];
      let a, b, tries = 0;
      for (;;) {
        a = draw(); b = draw();
        if (tries++ > 30) break;
        if (o.minChen && chen(a, b) < o.minChen) { end += 2; continue; }
        if (cs.length && rng() >= BLUFF_ALLOW && cs.some(r => handLevel(a, b, r.bp, r.bc) < r.lv)) { end += 2; continue; }
        break;
      }
      oh.push([a, b]);
    }
    const full = board.slice();
    for (let k = 0; k < need; k++) full.push(draw());
    const me = evalHand([...hole, ...full]);
    let best = -1, ties = 0;
    for (const h of oh) {
      const s = evalHand([...h, ...full]);
      if (s > best) { best = s; ties = 1; } else if (s === best) ties++;
    }
    if (me > best) total += 1; else if (me === best) total += 1 / (ties + 1);
  }
  return total / iters;
}
