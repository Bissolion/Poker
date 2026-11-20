// ---------- Treinos: situações montadas direto no ponto da decisão ----------
const DRILLS = {
  abrir: { name: 'Abrir ou desistir', desc: 'Todos desistiram até você. Abre ou larga?' },
  defesa: { name: 'Defender o big blind', desc: 'Alguém abriu e você está no big blind.' },
  pushfold: { name: 'All-in ou desistir', desc: 'Stack curto: vai all-in, paga ou larga?' },
  projetos: { name: 'Jogar projetos', desc: 'Você tem um projeto e o rival apostou.' },
  cbet: { name: 'Continuation bet', desc: 'Você abriu, levou call e o rival passou no flop.' },
  river: { name: 'Pagar no river', desc: 'O rival apostou no river. Paga ou larga?' },
};
const SEATS6 = [0, 1, 2, 3, 4, 5];
const drillRng = rng => (a, b) => a + Math.floor(rng() * (b - a + 1));
function drillGame(rng, stack = 1000) {
  const g = new Game(SEATS6.map(i => i === 0 ? { name: 'Você', isHuman: true } : { name: ['', 'Marta', 'Diego', 'Seu Zé', 'Helena', 'Rafa'][i], profile: PROFILES[['', 'tag', 'lag', 'station', 'nit', 'bal'][i]] }), { stack, rng });
  return g;
}
// Põe o botão de forma que o jogador (lugar 0) caia na posição pedida
function seatButtonFor(g, pos) {
  for (let b = 0; b < 6; b++) { g.button = b; if (g.posOf(0) === pos) { g.button = (b + 5) % 6; return; } }
}
// Escolhe a mão do jogador: perto da borda da faixa com mais frequência conforme o nível
function pickHole(g, rng, wantClass) {
  const all = []; for (let c = 0; c < 52; c++) all.push(c);
  for (let t = 0; t < 4000; t++) {
    const a = all[Math.floor(rng() * 52)], b = all[Math.floor(rng() * 52)];
    if (a === b) continue;
    if (!wantClass || wantClass(classOf(a, b))) return [a, b];
  }
  return [0, 4];
}
// Refaz o baralho para que as cartas dadas saiam primeiro (mãos e board)
function rigDeck(g, holes, board) {
  const used = new Set([...holes.flat(), ...board]);
  const rest = shuffle([...Array(52).keys()].filter(c => !used.has(c)), g.rng);
  g.deck = [...rest, ...board.slice().reverse()];
  holes.forEach((h, s) => { if (h) g.players[s].hole = h.slice(); });
  // as outras mãos saem do resto do baralho
  for (const p of g.players) if (!holes[p.seat]) p.hole = [g.deck.shift(), g.deck.shift()];
}
const nearEdge = (sc, level) => cls => {
  const size = rangePct({ ...sc.call, ...sc.raise });
  const d = Math.abs(HAND_POS[cls] - size);
  return d < 0.12 - level * 0.03;
};
function makeDrill(type, level = 0, rng = Math.random) {
  const R = drillRng(rng), edge = rng() < 0.35 + level * 0.2;
  if (type === 'abrir') {
    const g = drillGame(rng), pos = ['UTG', 'MP', 'CO', 'BTN', 'SB'][R(0, 4)];
    seatButtonFor(g, pos); g.startHand();
    const sc = rangeScenario(pos, 6, 0, null, false, false);
    rigDeck(g, [pickHole(g, rng, edge ? nearEdge(sc, level) : null)], []);
    while (g.toAct !== 0) g.act(g.toAct, { type: 'fold' });
    return { g, type };
  }
  if (type === 'defesa') {
    const g = drillGame(rng); seatButtonFor(g, 'BB'); g.startHand();
    const opener = ['UTG', 'MP', 'CO', 'BTN', 'SB'][R(0, 4)];
    const sc = rangeScenario('BB', 6, 1, opener, false, false);
    rigDeck(g, [pickHole(g, rng, edge ? nearEdge(sc, level) : null)], []);
    while (g.toAct !== 0) { const s = g.toAct; g.act(s, g.posOf(s) === opener ? { type: 'raise', to: g.bb * (opener === 'SB' ? 3 : [2.5, 3][R(0, 1)]) } : { type: 'fold' }); }
    return { g, type };
  }
  if (type === 'pushfold') {
    const depth = R(3, 14), g = drillGame(rng), facing = rng() < 0.35;
    const pos = facing ? 'BB' : ['UTG', 'MP', 'CO', 'BTN', 'SB'][R(0, 4)];
    seatButtonFor(g, pos);
    g.players.forEach(p => { p.stack = p.seat === 0 ? depth * 10 : R(depth, 25) * 10; });
    g.startHand();
    rigDeck(g, [pickHole(g, rng, null)], []);
    const shover = facing ? ['CO', 'BTN', 'SB'][R(0, 2)] : null;
    while (g.toAct !== 0) { const s = g.toAct; g.act(s, facing && g.posOf(s) === shover ? { type: 'raise', to: g.players[s].stack + g.players[s].bet } : { type: 'fold' }); }
    return { g, type };
  }
  // pós-flop: você abre do botão ou cutoff, o big blind paga, o flop sai como pedido
  const g = drillGame(rng), pos = ['CO', 'BTN'][R(0, 1)];
  seatButtonFor(g, pos); g.startHand();
  const bbSeat = SEATS6.find(s => g.posOf(s) === 'BB');
  let hole, board;
  for (let t = 0; t < 3000; t++) {
    const d = shuffle([...Array(52).keys()], rng);
    hole = [d[0], d[1]];
    const n = type === 'river' ? 5 : type === 'projetos' ? (rng() < 0.6 ? 3 : 4) : 3;
    board = d.slice(4, 4 + n);
    if (type === 'projetos') { const hd = heroDraws(hole, board); if (!hd || catOf(evalHand([...hole, ...board])) >= 1 && rng() < 0.7) continue; }
    if (type === 'river') { const c = catOf(evalHand([...hole, ...board])); if (c < 1 || c > 2) continue; } // par ou dois pares: a decisão difícil
    if (type === 'cbet') { const c = catOf(evalHand([...hole, ...board])); if (c > 2) continue; }
    break;
  }
  const holes = []; holes[0] = hole;
  rigDeck(g, holes, board);
  // pré-flop: abrir e o BB pagar
  while (g.street === 'preflop' && !g.handOver) {
    const s = g.toAct;
    if (s === 0) g.act(0, { type: 'raise', to: g.bb * 2.5 });
    else if (s === bbSeat) g.act(s, { type: 'call' });
    else g.act(s, { type: 'fold' });
  }
  // completa o board pelas ruas pedidas
  const playStreet = (bbBets) => {
    if (bbBets) { const pot = g.pot(); g.act(bbSeat, { type: 'raise', to: Math.max(g.bb, Math.round(pot * [0.5, 0.66, 0.75, 1][R(0, 3)] / 5) * 5) }); }
    else g.act(bbSeat, { type: 'check' });
  };
  const target = board.length;
  // ruas intermediárias: os dois passam (o baralho já traz o board sorteado, na ordem)
  while (g.board.length < target) { playStreet(false); g.act(0, { type: 'check' }); }
  if (type === 'cbet') playStreet(false);
  else playStreet(true);
  return { g, type };
}
// Avalia a resposta do treino com o mesmo coach do jogo
function gradeDrill(d, action, rng = Math.random) {
  const g = d.g, L = g.legal(0);
  if (g.street === 'preflop') {
    const adv = preflopAdvice(g, 0);
    return { ...gradePreflop(adv, action, L), rec: adv.rec, push: adv.push };
  }
  const info = postflopInfo(g, 0, 900);
  const tips = postflopTips(g, 0, info, rng);
  let rec = postflopRec(info);
  const cb = tips.find(x => x.k === 'cbet' || x.k === 'river');
  if (cb && cb.rec && L.toCall === 0) rec = cb.rec;
  let fb = gradePostflop(info, action, L, g.street);
  if (cb && cb.k === 'cbet' && cb.rec === 'raise' && action === 'check') fb = { grade: 'ok', title: 'Faltou a continuation bet', text: cb.text };
  if (cb && cb.k === 'cbet' && cb.rec === 'check' && action === 'raise' && fb.grade === 'good') fb = { grade: 'ok', title: 'Continuation bet arriscada aqui', text: cb.text };
  return { ...fb, rec, info, tips };
}
// Treino sugerido para cada vazamento
const LEAK_DRILL = { vpip: 'abrir', pfr: 'abrir', gap: 'abrir', vpip_UTG: 'abrir', vpip_MP: 'abrir', vpip_CO: 'abrir', vpip_BTN: 'abrir', vpip_SB: 'abrir', vpip_BB: 'defesa', threebet: 'defesa', fold3bet: 'defesa', cbet: 'cbet', foldcbet: 'projetos', wtsd: 'river', wsd: 'river', af: 'cbet', rivercall: 'river' };
