// ---------- Coach pós-flop: o porquê de cada jogada ----------
// Sorteia mãos do rival pela faixa estimada (ação pré-flop + apostas depois do flop), como a equity faz
function sampleRange(hole, board, o, n = 600, rng = Math.random) {
  const used = new Set([...hole, ...board]), pool = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) pool.push(c);
  const cons = (o.reads || []).filter(r => r.n <= board.length).map(r => { const bp = board.slice(0, r.n); return { bp, lv: r.lv, bc: catOf(evalHand(bp)) }; });
  const out = [];
  for (let it = 0; it < n; it++) {
    let a, b, tries = 0;
    for (;;) {
      const i = Math.floor(rng() * pool.length); let j = Math.floor(rng() * (pool.length - 1)); if (j >= i) j++;
      a = pool[i]; b = pool[j];
      if (tries++ > 40) break;
      if (o.minChen && chen(a, b) < o.minChen) continue;
      if (cons.length && rng() >= BLUFF_ALLOW && cons.some(r => handLevel(a, b, r.bp, r.bc) < r.lv)) continue;
      break;
    }
    out.push([a, b]);
  }
  return out;
}
// Divide a faixa do rival em categorias que o jogador entende
const RANGE_CATS = [tx`Sequência, flush ou melhor`, tx`Trinca ou dois pares`, tx`Top pair ou overpair`, tx`Outro par`, tx`Projeto`, tx`Nada (blefe)`];
function rangeBreakdown(hole, board, o, rng = Math.random) {
  const hands = sampleRange(hole, board, o, 600, rng), cnt = RANGE_CATS.map(() => 0);
  const bc = catOf(evalHand(board)), top = Math.max(...board.map(rankOf));
  for (const [a, b] of hands) {
    const sc = evalHand([a, b, ...board]), cat = catOf(sc);
    let k;
    if (cat >= 4 && cat > bc) k = 0;
    else if ((cat === 3 || cat === 2) && cat > bc) k = 1;
    else if (cat === 1 && cat > bc) {
      const pr = kOf(sc, 0);
      k = pr >= top ? 2 : 3;
    } else k = board.length < 5 && drawsOf([a, b], board).length ? 4 : 5;
    cnt[k]++;
  }
  return RANGE_CATS.map((name, i) => ({ name, p: cnt[i] / hands.length })).filter(x => x.p >= 0.02);
}
// Dicas do coach depois do flop. Devolve frases curtas, na ordem em que importam.
function postflopTips(g, seat, info, rng = Math.random) {
  const p = g.players[seat], L = g.legal(seat), tips = [];
  const board = g.board, rd = boardRead(board, p.hole), label = rd.label;
  const pot = g.pot(), aggressor = g.pfAgg === seat, multi = info.nOpp >= 2;
  const P = x => Math.round(x * 100) + '%';
  const rivals = g.players.filter(q => q !== p && !q.folded);
  // 1. continuation bet
  if (g.street === 'flop' && L.toCall === 0 && aggressor) {
    if (multi) tips.push({ k: 'cbet', rec: info.st >= 0.6 ? 'raise' : 'check', text: tx`Você aumentou antes do flop, mas contra ${info.nOpp} rivais a continuation bet funciona menos: aposte só com mão boa ou projeto forte.` });
    else if (label === tx`Seca`) tips.push({ k: 'cbet', rec: 'raise', size: 0.33, text: tx`Você aumentou antes do flop e a mesa é seca: aposte pequeno (cerca de 1/3 do pote) com quase toda a sua faixa. O rival erra o flop na maior parte das vezes.` });
    else tips.push({ k: 'cbet', rec: info.st >= 0.55 || (info.draws || []).length ? 'raise' : 'check', size: 0.66, text: tx`Você aumentou antes do flop, mas a mesa é ${label.toLowerCase()}: aposte maior (cerca de 2/3 do pote) com mão boa ou projeto, e passe com o resto.` });
  }
  // 2. tamanho pela textura (quando vai apostar)
  if (L.toCall === 0 && info.st >= 0.62 && !tips.some(t => t.k === 'cbet')) {
    const size = label === tx`Seca` ? 0.33 : 0.66;
    tips.push({ k: 'size', rec: 'raise', size, text: label === tx`Seca` ? tx`Mesa seca: uma aposta de 1/3 do pote já cobra das mãos piores sem afastá-las.` : tx`Mesa ${label.toLowerCase()}: aposte 2/3 a 3/4 do pote para cobrar caro de quem quer completar um projeto.` });
  }
  // 3. odds implícitas e reversas
  const hd = heroDraws(p.hole, board);
  if (hd && L.toCall > 0 && info.eq < info.need) {
    const next = hd.outs / (52 - 2 - board.length);
    const needFuture = Math.max(0, Math.round(L.toCall / next - (pot + L.toCall)));
    const behind = Math.min(p.stack - L.toCall, Math.max(0, ...rivals.map(q => q.stack)));
    tips.push({ k: 'implied', text: tx`Odds implícitas: só pelo pote, pagar não compensa. Para valer, você precisa ganhar mais cerca de ${needFuture} fichas quando completar (${hd.outs} outs, ${P(next)} na próxima carta). ${behind >= needFuture * 1.3 ? tx`Ainda há ${behind} fichas atrás: dá, se o rival costuma pagar.` : tx`Só há ${behind} fichas atrás: não dá.`}` });
  }
  if (hd && hd.flush) {
    const fs = suitOf(heroDrawSuit(p.hole, board));
    const myHigh = Math.max(...p.hole.filter(c => suitOf(c) === fs).map(rankOf));
    if (myHigh < 10) tips.push({ k: 'reverse', text: tx`Cuidado com odds implícitas reversas: seu flush seria baixo (${RANK_CH[myHigh]} alto). Quando completar, quem tem flush maior ganha muito de você.` });
  }
  // 4. o que a aposta do rival representa
  if (L.toCall > 0) {
    const bettor = rivals.find(q => q.bet === g.currentBet) || rivals[0];
    if (bettor) {
      const br = rangeBreakdown(p.hole, board, { minChen: bettor.minChen, reads: bettor.reads }, rng);
      tips.push({ k: 'range', text: tx`O que a aposta de ${bettor.name} representa (estimativa pela ação dele):`, breakdown: br });
    }
  }
  // 5. defesa mínima no river
  if (g.street === 'river' && L.toCall > 0) {
    const before = pot - L.toCall, mdf = before / (before + L.toCall);
    tips.push({ k: 'mdf', text: tx`Defesa mínima: contra essa aposta, quem paga com menos de ${P(mdf)} da própria faixa deixa o rival lucrar blefando com qualquer coisa. Pague com as melhores mãos da sua faixa até mais ou menos essa fração.` });
  }
  // 6. valor ou blefe no river
  if (g.street === 'river' && L.toCall === 0) {
    tips.push({ k: 'river', rec: info.st >= 0.65 ? 'raise' : 'check', text: info.st >= 0.65 ? tx`River: aposte por valor. Sua mão ganha da maior parte das que pagariam.` : info.eq < 0.15 ? tx`River: com quase nada, passe ou blefe raramente. Um blefe só funciona se a história das suas apostas fizer sentido (por exemplo, a carta que completou um projeto possível).` : tx`River: com mão média, passe. Quem paga sua aposta costuma ter mão melhor, e quem tem mão pior desiste.` });
  }
  return tips;
}
// Naipe do projeto de flush do jogador (uma das cartas dele)
function heroDrawSuit(hole, board) {
  const sc = [0, 0, 0, 0]; [...hole, ...board].forEach(c => sc[suitOf(c)]++);
  const s = sc.findIndex((n, k) => n === 4 && hole.some(c => suitOf(c) === k));
  return hole.find(c => suitOf(c) === s) ?? hole[0];
}
