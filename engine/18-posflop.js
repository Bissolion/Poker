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
// Qual tabela usar: o pote de abertura Botão x BB (POSFLOP) ou um dos cenários extras (SPOTS)
const SPOT_PT = { srp_btn: tx`botão x big blind`, srp_co: tx`cutoff x big blind`, srp_sb: tx`small blind x big blind`, '3bet_bb': tx`pote de 3-bet`, curto: tx`stack curto` };
function spotTable(g) {
  const S = typeof SPOTS !== 'undefined' ? SPOTS : {};
  if ((g.pfRaises || 0) >= 2) return S['3bet_bb'] ? { name: '3bet_bb', T: S['3bet_bb'] } : null;
  if (g.flopStack && g.flopStack / g.bb <= 40 && S.curto) return { name: 'curto', T: S.curto };
  const pos = g.posOf(g.pfAgg);
  if (pos === 'CO' && S.srp_co) return { name: 'srp_co', T: S.srp_co };
  if (pos === 'SB' && g.players.length > 2 && S.srp_sb) return { name: 'srp_sb', T: S.srp_sb };
  return typeof POSFLOP !== 'undefined' ? { name: 'srp_btn', T: POSFLOP } : null;
}
// tipo da carta do turn em relação ao flop
const TURN_PT = { baixa: tx`baixo`, alta: tx`com carta mais alta que o flop`, naipe: tx`que traz o terceiro do naipe`, par: tx`que forma par na mesa` };
function turnTypeOf(flop, t) {
  const fr = flop.map(rankOf), fs = flop.map(suitOf);
  if (fr.includes(rankOf(t))) return 'par';
  if (fs.filter(s => s === suitOf(t)).length >= 2) return 'naipe';
  if (rankOf(t) > Math.max(...fr)) return 'alta';
  return 'baixa';
}
// Situação coberta pelas tabelas: { node, freq, cat, ... } ou null
//  node 'cbet': quem aumentou antes do flop, sem aposta à frente (rival passou ou ainda vai agir)
//  node 'defesa': quem pagou antes do flop, diante de uma aposta de quem aumentou
//  node 'barrel': no turn, quem apostou no flop e levou call decide se aposta de novo
function solverSpot(g, seat) {
  const p = g.players[seat], rivals = g.players.filter(q => q !== p && !q.folded);
  if (rivals.length !== 1 || g.pfAgg < 0) return null;
  const L = g.legal(seat);
  if (g.street === 'turn') {
    const S = typeof SPOTS !== 'undefined' && SPOTS.srp_btn && SPOTS.srp_btn.turn;
    if (!S || g.pfAgg !== seat || L.toCall !== 0 || (g.pfRaises || 0) > 1 || (g.flopStack && g.flopStack / g.bb <= 40)) return null;
    const bet = (p.reads || []).some(r => r.st === 'flop' && r.lv >= 2 && !r.raise), called = (rivals[0].reads || []).some(r => r.st === 'flop' && r.lv === 1);
    if (!bet || !called) return null;
    const tt = turnTypeOf(g.board.slice(0, 3), g.board[3]), cat = flopCat(p.hole, g.board);
    return S[tt] && S[tt][cat] ? { node: 'barrel', cat, tt, freq: S[tt][cat], all: S[tt], spot: 'srp_btn' } : null;
  }
  if (g.street !== 'flop') return null;
  const st = spotTable(g); if (!st) return null;
  // cenário extra sem esta textura resolvida: usa a média dele
  const T = st.T.tex[flopTexKey(g.board)] || (st.name !== 'srp_btn' ? st.T.geral : null);
  if (!T) return null;
  const cat = flopCat(p.hole, g.board), pot = g.pot();
  if (g.pfAgg === seat && L.toCall === 0) return { node: 'cbet', cat, freq: T.cbet[cat], all: T.cbet, tex: flopTexKey(g.board), spot: st.name, total: T.total };
  const agg = rivals[0];
  if (g.pfAgg === agg.seat && L.toCall > 0 && g.raises <= 1) {
    const before = pot - L.toCall, frac = L.toCall / Math.max(1, before);
    const k = frac < 0.5 ? 'pequena' : 'grande';
    return { node: 'defesa', cat, size: k, frac, freq: T.defesa[k][cat], all: T.defesa[k], tex: flopTexKey(g.board), spot: st.name };
  }
  return null;
}
// Escolhe uma ação pelas frequências do solver, com o desvio do estilo do bot
function solverAction(g, seat, sp, pr, sk, rng) {
  const L = g.legal(seat), pot = g.pot(), f = sp.node === 'barrel' ? { check: sp.freq.check, big: sp.freq.bet } : { ...sp.freq };
  const dv = pr.post || {};
  if (sp.node === 'cbet' || sp.node === 'barrel') {
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
