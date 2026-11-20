// ---------- Estratégia de flop vinda do solver ----------
// As tabelas (POSFLOP, em 19-posflop-dados.js) saem de tools/gerar-posflop.js: o postflop-solver
// resolveu flops representativos do pote de abertura Botão x Big blind (100 BB, faixas do app),
// e tools/resumir-posflop.js agrupou o resultado por textura da mesa e tipo de mão.
// Uso no jogo: qualquer pote mano a mano no flop, com quem aumentou antes do flop contra quem pagou
// (os tamanhos e as posições são aproximados para os outros casos).
const FLOP_CATS = ['forte', 'top', 'medio', 'fraco', 'projeto', 'gutshot', 'altas', 'nada'];
const FLOP_CAT_PT = { forte: tx`dois pares ou melhor`, top: tx`top pair ou overpair`, medio: tx`par médio`, fraco: tx`par fraco`, projeto: tx`projeto forte`, gutshot: tx`gutshot`, altas: tx`cartas altas sem par`, nada: tx`nada` };
// Textura no formato das tabelas: naipes (mono/two/rain), par na mesa, carta mais alta
function flopTexKey(board) {
  const r = board.slice(0, 3).map(rankOf).sort((a, b) => b - a), s = new Set(board.slice(0, 3).map(suitOf)).size;
  const suits = s === 1 ? 'mono' : s === 2 ? 'two' : 'rain';
  const paired = r[0] === r[1] || r[1] === r[2] ? 'par' : 'sem';
  const high = r[0] === 12 ? 'A' : r[0] >= 10 ? 'KQ' : r[0] >= 8 ? 'JT' : 'low';
  return `${suits}-${paired}-${high}`;
}
// Tipo da mão no flop, do jeito que um jogador pensa
function flopCat(hole, board) {
  const b = board.map(rankOf).sort((x, y) => y - x), h = hole.map(rankOf);
  const cat = catOf(evalHand([...hole, ...board])), bc = catOf(evalHand(board));
  const boardPaired = b[0] === b[1] || b[1] === b[2];
  const pp = h[0] === h[1];
  if (cat >= 3 && cat > bc) return 'forte';
  if (cat === 2 && !boardPaired) return 'forte';
  const hit = h.filter(x => b.includes(x));
  if (pp || hit.length) {
    const pr = pp ? h[0] : Math.max(...hit);
    if (pr >= b[0]) return 'top';
    if (pr >= b[1] || (pp && pr > b[2])) return 'medio';
    return 'fraco';
  }
  const outs = drawsOf(hole, board).reduce((a, d) => a + d.outs, 0);
  if (outs >= 8) return 'projeto';
  if (outs >= 4) return 'gutshot';
  if (h.some(x => x === 12) || Math.min(...h) > b[0]) return 'altas';
  return 'nada';
}
// Situação de flop coberta pelas tabelas: { node, freq, cat, sizes } ou null
//  node 'cbet': quem aumentou antes do flop, sem aposta à frente (rival passou ou ainda vai agir)
//  node 'defesa': quem pagou antes do flop, diante de uma aposta de quem aumentou
function solverSpot(g, seat) {
  if (typeof POSFLOP === 'undefined' || g.street !== 'flop') return null;
  const p = g.players[seat], rivals = g.players.filter(q => q !== p && !q.folded);
  if (rivals.length !== 1 || g.pfAgg < 0) return null;
  const T = POSFLOP.tex[flopTexKey(g.board)];
  if (!T) return null;
  const cat = flopCat(p.hole, g.board), L = g.legal(seat), pot = g.pot();
  if (g.pfAgg === seat && L.toCall === 0) return { node: 'cbet', cat, freq: T.cbet[cat], all: T.cbet, tex: flopTexKey(g.board) };
  const agg = rivals[0];
  if (g.pfAgg === agg.seat && L.toCall > 0 && g.raises <= 1) {
    const before = pot - L.toCall, frac = L.toCall / Math.max(1, before);
    const k = frac < 0.5 ? 'pequena' : 'grande';
    return { node: 'defesa', cat, size: k, frac, freq: T.defesa[k][cat], all: T.defesa[k], tex: flopTexKey(g.board) };
  }
  return null;
}
// Escolhe uma ação pelas frequências do solver, com o desvio do estilo do bot
function solverAction(g, seat, sp, pr, sk, rng) {
  const L = g.legal(seat), pot = g.pot(), f = { ...sp.freq };
  const dv = pr.post || {};
  if (sp.node === 'cbet') {
    // agressivo aposta mais (principalmente sem mão), cauteloso aposta menos sem mão
    const weak = ['fraco', 'gutshot', 'altas', 'nada'].includes(sp.cat);
    const m = 1 + (dv.cbet || 0) * (weak ? 1.5 : 0.5);
    f.small *= m; f.big *= m;
  } else {
    // "paga tudo" larga menos, cautelosa larga mais
    f.fold *= 1 + (dv.fold || 0); f.raise *= 1 + (dv.raise || 0);
  }
  // iniciante: mistura com jogo aleatório
  const noise = sk.noise > 2 ? 0.35 : sk.noise > 0.8 ? 0.08 : 0;
  const keys = Object.keys(f), tot = keys.reduce((a, k) => a + Math.max(0, f[k]), 0) || 1;
  let x = rng(), pick = keys[keys.length - 1];
  for (const k of keys) { const w = (1 - noise) * Math.max(0, f[k]) / tot + noise / keys.length; if (x < w) { pick = k; break; } x -= w; }
  if (pick === 'check') return { type: 'check' };
  if (pick === 'fold') return L.canCheck ? { type: 'check' } : { type: 'fold' };
  if (pick === 'call') return { type: 'call' };
  if (!L.canRaise) return L.toCall ? { type: 'call' } : { type: 'check' };
  if (pick === 'small') return sizeRaise(g, g.players[seat], L, pot * 0.33);
  if (pick === 'big') return sizeRaise(g, g.players[seat], L, pot * 0.75);
  return sizeRaise(g, g.players[seat], L, g.currentBet * 3); // raise
}
