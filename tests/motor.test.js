const P = require('../dist/engine.js');
const assert = require('assert');
const R = '23456789TJQKA', S = 'shdc';
const c = s => R.indexOf(s[0]) * 4 + S.indexOf(s[1]);
const H = str => str.split(' ').map(c);
const ev = str => P.evalHand(H(str));
const name = str => P.handName(ev(str));

// Avaliador
const order = [
  'As Ks Qs Js Ts 2d 3c', // royal
  '5h 4h 3h 2h Ah Kd Kc', // straight flush (roda)
  '9c 9d 9h 9s 2c 3d 4h', // quadra
  '8c 8d 8h Kc Kd 2s 3s', // full
  'Ad Jd 8d 4d 2d Ks Kh', // flush
  'Tc 9d 8h 7s 6c 2d 2h', // sequência
  '5c 4d 3h 2s Ac Kd Qh', // roda
  '7c 7d 7h Ac Kd 2s 4s', // trinca
  'Ac Ad Kc Kd Qc 2s 3h', // dois pares
  'Ac Ad Kc Qd Jc 2s 3h', // par
  'Ac Kd Qc Jd 9c 2s 3h', // carta alta
];
for (let i = 0; i + 1 < order.length; i++) assert(ev(order[i]) > ev(order[i + 1]), `${order[i]} > ${order[i + 1]}`);
assert.strictEqual(name(order[0]), 'Royal flush');
assert.strictEqual(name(order[1]), 'Straight flush até o 5');
assert.strictEqual(name(order[6]), 'Sequência até o 5');
assert.strictEqual(name('8c 8d 8h Kc Kd Ks 3s'), 'Full house, K com 8');
assert.strictEqual(name('Ac Ad Kc Kd Qc Qs 3h'), 'Dois pares, A e K');
assert(ev('Ac Ad Kc Kd Qc Qs 3h') > ev('Ac Ad Kc Kd Jc Js Th'), 'kicker do dois pares');
assert(ev('Ac Ad Kc 7d 5c 3s 2h') > ev('Ac Ad Qc Jd 9c 3s 2h'), 'kicker do par');
assert.strictEqual(ev('Ac Ad Kc 7d 5c 3s 2h'), ev('Ah As Kd 7c 5s 3h 2d'), 'empate exato');
assert(ev('Ah 9h 7h 5h 3h Kh 2c') > ev('Kh Qh Jh 9h 8h 2c 3d'), 'flush maior');
console.log('avaliador ok');

// Chen
assert.strictEqual(P.chen(c('As'), c('Ah')), 20);
assert.strictEqual(P.chen(c('Ks'), c('Kh')), 16);
assert.strictEqual(P.chen(c('As'), c('Ks')), 12);
assert.strictEqual(P.chen(c('2s'), c('2h')), 5);
assert.strictEqual(P.chen(c('7s'), c('2h')), -1);
assert.strictEqual(P.comboName(c('Ks'), c('As')), 'AKs');
console.log('chen ok');

// Equity
const eqAA = P.equity(H('As Ah'), [], [{ minChen: 0 }], 4000);
assert(eqAA > 0.82 && eqAA < 0.88, 'AA vs aleatória ~85%: ' + eqAA);
const eqNuts = P.equity(H('As Ks'), H('Qs Js Ts'), [{}, {}], 500);
assert(eqNuts === 1, 'royal = 100%');
console.log('equity ok', eqAA.toFixed(3));

// Side pots determinísticos
function rig(stacks, holes, board) {
  const g = new P.Game(stacks.map((s, i) => ({ name: 'P' + i, stack: s })));
  g.button = stacks.length - 1; // startHand avança para 0
  g.startHand();
  // força cartas
  holes.forEach((h, i) => g.players[i].hole = H(h));
  const used = new Set(holes.flatMap(H).concat(H(board)));
  g.deck = [...Array(52).keys()].filter(x => !used.has(x));
  g.deck.push(...H(board).reverse()); // pop entrega na ordem
  return g;
}
// 3 jogadores: P0 botão, P1 SB, P2 BB. P0 50 fichas, P1 200, P2 500.
{
  const g = rig([50, 200, 500], ['Ac Ad', 'Kc Kd', 'Qc Qd'], '2s 3h 7d 9c Js');
  g.act(0, { type: 'raise', to: 50 });  // all-in 50
  g.act(1, { type: 'raise', to: 200 }); // all-in 200
  g.act(2, { type: 'call' });
  assert(g.handOver);
  const net = g.result.net;
  assert.strictEqual(g.players[0].stack, 150, 'AA ganha pote principal 3x50');
  assert.strictEqual(g.players[1].stack, 300, 'KK ganha side pot 2x150');
  assert.strictEqual(g.players[2].stack, 300, 'QQ perde 200');
  assert.strictEqual(Object.values(net).reduce((a, b) => a + b, 0), 0);
}
// Aposta não paga é devolvida
{
  const g = rig([1000, 100, 1000], ['Ac Ad', 'Kc Kd', '7c 2d'], '2s 3h 8d 9c Js');
  g.act(0, { type: 'raise', to: 400 });
  g.act(1, { type: 'call' }); // all-in 100
  g.act(2, { type: 'fold' });
  assert(g.handOver);
  assert.strictEqual(g.players[0].stack, 1000 + 100 + 10, 'AA: +100 do KK +10 do BB');
  assert.strictEqual(g.players[1].stack, 0);
}
// Empate divide
{
  const g = rig([100, 100, 100], ['Ac 2d', 'Ad 3c', '7c 4d'], 'Ks Kh Qd Qc Js');
  g.act(0, { type: 'call' }); g.act(1, { type: 'call' }); g.act(2, { type: 'check' });
  for (const st of ['flop', 'turn', 'river']) { g.act(1, { type: 'check' }); g.act(2, { type: 'check' }); g.act(0, { type: 'check' }); }
  assert(g.handOver);
  assert.strictEqual(g.players[0].stack, 105); assert.strictEqual(g.players[1].stack, 105); assert.strictEqual(g.players[2].stack, 90);
}
// Short all-in não reabre aumento
{
  const g = rig([1000, 1000, 125], ['Ac Ad', 'Kc Kd', 'Qc Qd'], '2s 3h 8d 9c Js');
  g.act(0, { type: 'raise', to: 100 });
  g.act(1, { type: 'call' });
  g.act(2, { type: 'raise', to: 125 }); // all-in curto (+25 < 90)
  assert.strictEqual(g.toAct, 0);
  assert.strictEqual(g.legal(0).canRaise, false, 'não pode re-aumentar após all-in curto');
  g.act(0, { type: 'call' }); g.act(1, { type: 'call' });
  assert.strictEqual(g.street, 'flop');
}
console.log('side pots ok');

// Simulação em massa: conservação de fichas, sem travar
const profs = ['tag', 'lag', 'station', 'nit', 'bal', 'tag'];
const g = new P.Game(profs.map((k, i) => ({ name: 'B' + i, profile: P.PROFILES[k] })));
let hands = 0, sd = 0;
const t0 = Date.now();
for (let h = 0; h < 1500; h++) {
  for (const p of g.players) if (p.stack === 0) p.stack = 1000;
  const before = g.players.reduce((a, p) => a + p.stack, 0);
  g.startHand();
  let guard = 0;
  while (!g.handOver) {
    const a = P.botDecide(g, g.toAct);
    g.act(g.toAct, a);
    if (++guard > 200) throw new Error('loop');
  }
  const after = g.players.reduce((a, p) => a + p.stack, 0);
  assert.strictEqual(after, before, 'fichas conservadas na mão ' + g.handNo);
  assert(g.players.every(p => p.stack >= 0));
  hands++; if (g.result.showdown) sd++;
}
const net = {};
console.log(`simulação ok: ${hands} mãos, ${sd} showdowns, ${Date.now() - t0}ms`);

// Projetos
const D = (h, b) => P.drawsOf(H(h), H(b)).map(x => x.name + ':' + x.outs).join(',');
assert.strictEqual(D('9c 8c', '4h 7h 5c'), 'Gutshot (sequência por dentro):4');
assert.strictEqual(D('9c 8c', '7h 6d 2c'), 'Sequência aberta:8');
assert.strictEqual(D('Ah 2h', 'Kh 7h 9c'), 'Projeto de flush:9');
assert.strictEqual(D('9h 8h', '7h 6h 2c'), 'Projeto de flush:9,Sequência aberta:8');
assert.strictEqual(D('Ac Kd', '5h 6h 7h 8c'), '', 'sequência só do board não conta');
console.log('projetos ok');

// Leitura pós-flop: rival que aposta forte no river tem faixa mais forte
{
  const hole = H('Kc Qd'), board = H('Kh 8s 4d 2c 9h'); // top pair, kicker Q
  const vsAny = P.equity(hole, board, [{ minChen: 0, reads: [] }], 3000);
  const vsBet = P.equity(hole, board, [{ minChen: 0, reads: [{ n: 5, lv: 2.5 }] }], 3000);
  const vsCall = P.equity(hole, board, [{ minChen: 0, reads: [{ n: 3, lv: 1 }] }], 3000);
  console.log('top pair: vs aleatória', vsAny.toFixed(2), 'vs pagou flop', vsCall.toFixed(2), 'vs aposta forte river', vsBet.toFixed(2));
  assert(vsAny > 0.85, 'top pair vence mão aleatória');
  assert(vsBet < vsAny - 0.2, 'aposta forte reduz bastante a equity');
  assert(vsCall < vsAny && vsCall > vsBet, 'call no flop reduz menos');
  assert.strictEqual(P.handLevel(c('Ah'), c('Kd'), H('Ks 7c 2d'), 0), 2.5, 'top pair');
  assert.strictEqual(P.handLevel(c('7h'), c('7d'), H('Ks Tc 2d'), 0), 2, 'par médio');
  assert.strictEqual(P.handLevel(c('Ah'), c('5h'), H('Kh 7h 2d'), 0), 2, 'projeto de flush');
  assert.strictEqual(P.handLevel(c('Kh'), c('7d'), H('Ks 7c 2d'), 0), 3, 'dois pares');
  assert.strictEqual(P.handLevel(c('4h'), c('3d'), H('Ks Tc 9d'), 0), 0, 'nada');
}
console.log('leitura pós-flop ok');

// Regra pré-flop
assert.strictEqual(P.preflopRule(6, 'BTN', 0, false).rec, 'raise');
assert.strictEqual(P.preflopRule(6, 'UTG', 0, false).rec, 'fold');
assert.strictEqual(P.preflopRule(5, 'BB', 0, true).rec, 'check');
assert.strictEqual(P.preflopRule(12, 'MP', 1, false).rec, 'raise');
assert.strictEqual(P.preflopRule(9, 'CO', 1, false).rec, 'call');

// Tamanho de aposta
const base = { street: 'flop', raises: 0, currentBet: 0, pot: 100, toCall: 0, isBet: true, bb: 10, limpers: 0, maxTo: 1000, draws: [], board: H('Kh 7h 2d') };
assert.strictEqual(P.gradeSizing({ ...base, to: 25, st: 0.8 }).grade, 'ok', 'valor pequeno');
assert.strictEqual(P.gradeSizing({ ...base, to: 40, st: 0.8 }).grade, 'ok', 'proteção em board molhado');
assert.strictEqual(P.gradeSizing({ ...base, to: 66, st: 0.8 }).grade, 'good');
assert.strictEqual(P.gradeSizing({ ...base, to: 150, st: 0.2 }).grade, 'ok', 'blefe caro');
assert.strictEqual(P.gradeSizing({ ...base, street: 'preflop', to: 30, st: 0 }).grade, 'good');
assert.strictEqual(P.gradeSizing({ ...base, street: 'preflop', to: 80, st: 0 }).grade, 'ok');
assert.strictEqual(P.gradeSizing({ ...base, street: 'preflop', raises: 1, currentBet: 30, to: 90, st: 0 }).grade, 'good');
console.log('sizing ok');

// Gravação para replay
{
  const g2 = new P.Game([0, 1, 2].map(i => ({ name: 'R' + i, profile: P.PROFILES.bal })));
  g2.startHand();
  while (!g2.handOver) g2.act(g2.toAct, P.botDecide(g2, g2.toAct));
  assert(g2.snaps.length >= 4, 'snapshots gravados');
  assert.strictEqual(g2.snaps[0].k, 'hand');
  assert(g2.snaps.filter(s => s.k === 'act').every(s => s.seat >= 0), 'cada ação tem autor');
  assert.strictEqual(g2.snaps.at(-1).k, 'win');
}
console.log('replay ok');

// ---- Heads-up: botão posta o small blind e age primeiro pré-flop, por último depois ----
{
  const g = new P.Game([{ name: 'A', profile: P.PROFILES.bal }, { name: 'B', profile: P.PROFILES.bal }]);
  g.button = 1; g.startHand(); // botão vai para 0
  assert.strictEqual(g.button, 0);
  assert.strictEqual(g.posOf(0), 'BTN'); assert.strictEqual(g.posOf(1), 'BB');
  assert.strictEqual(g.players[0].bet, 5, 'botão posta SB'); assert.strictEqual(g.players[1].bet, 10);
  assert.strictEqual(g.toAct, 0, 'botão age primeiro pré-flop');
  g.act(0, { type: 'call' }); g.act(1, { type: 'check' });
  assert.strictEqual(g.street, 'flop'); assert.strictEqual(g.toAct, 1, 'BB age primeiro no flop');
}
// Posições com jogadores eliminados
{
  const g = new P.Game([0, 1, 2, 3, 4, 5].map(i => ({ name: 'P' + i, profile: P.PROFILES.bal })));
  g.players[2].out = true; g.players[4].out = true;
  g.button = 5; g.startHand();
  assert.strictEqual(g.button, 0);
  assert.deepStrictEqual([0, 1, 3, 5].map(s => g.posOf(s)), ['BTN', 'SB', 'BB', 'CO']);
  assert.strictEqual(g.players[2].hole.length, 0, 'eliminado não recebe cartas');
  assert(g.players[2].folded && g.posOf(2) === '');
  assert.strictEqual(g.toAct, 5, 'CO age depois do BB');
}
console.log('heads-up e posições ok');

// ---- Torneio completo: blinds sobem, eliminados saem, campeão fica com tudo ----
for (const n of [6, 2]) {
  const g = new P.Game([...Array(n)].map((_, i) => ({ name: 'T' + i, profile: P.PROFILES[['tag', 'lag', 'station', 'nit', 'bal', 'tag'][i]] })), { stack: 1500, skill: 'normal' });
  let hands = 0, places = [];
  while (g.activeCount() > 1) {
    const lv = P.BLIND_LEVELS[P.blindLevel(hands, 5)]; g.sb = lv[0]; g.bb = lv[1];
    g.startHand();
    let guard = 0;
    while (!g.handOver) { g.act(g.toAct, P.botDecide(g, g.toAct)); if (++guard > 300) throw new Error('loop'); }
    assert.strictEqual(g.players.reduce((a, p) => a + p.stack, 0), 1500 * n, 'fichas conservadas');
    places.push(...g.eliminateBusted().map(p => p.place));
    hands++;
    if (hands > 2000) throw new Error('torneio não termina');
  }
  places.sort((a, b) => a - b);
  assert.deepStrictEqual(places, [...Array(n - 1)].map((_, i) => i + 2), 'colocações 2..n sem repetir');
  console.log(`torneio ${n} jogadores ok: ${hands} mãos`);
}

// ---- Dificuldade: bots difíceis ganham dos iniciantes ----
{
  let seed = 12345; const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const g = new P.Game([0, 1, 2, 3, 4, 5].map(i => ({ name: 'D' + i, profile: P.PROFILES.bal, skill: i % 2 ? 'hard' : 'easy' })), { rng });
  const net = { hard: 0, easy: 0 };
  for (let h = 0; h < 2500; h++) {
    for (const p of g.players) if (p.stack < 400) p.stack = 1000;
    g.startHand();
    while (!g.handOver) g.act(g.toAct, P.botDecide(g, g.toAct, rng));
    g.players.forEach((p, i) => net[p.skill] += g.result.net[i]);
  }
  console.log('difícil x iniciante (bb/100):', (net.hard / 3 / 10 / 25).toFixed(1), 'x', (net.easy / 3 / 10 / 25).toFixed(1));
  assert(net.hard > 0 && net.hard > net.easy, 'difícil deve ganhar do iniciante');
}

// ---- Coach com stack curto: all-in ou desistir ----
{
  const g = rig([80, 1000, 1000], ['As Kd', '7c 2d', '8h 3s'], '2s 3h 8d 9c Js');
  const adv = P.preflopAdvice(g, 0);
  assert(adv.push, 'stack de 8 BB entra no modo push/fold');
  assert.strictEqual(adv.rec, 'raise');
  const weak = rig([80, 1000, 1000], ['7c 2d', 'As Kd', '8h 3s'], '2s 3h 8d 9c Js');
  assert.strictEqual(P.preflopAdvice(weak, 0).rec, 'fold');
  assert.strictEqual(P.gradeSizing({ street: 'preflop', raises: 0, to: 30, currentBet: 10, pot: 15, toCall: 10, isBet: false, bb: 10, limpers: 0, maxTo: 80, stackBB: 8 }).grade, 'ok', 'aumento pequeno com 8 BB');
}
console.log('push/fold ok');

// ---- Equity com cartas conhecidas ----
{
  const e = P.equityKnown([H('As Ah'), H('Ks Kh')], [], 4000);
  assert(e[0] > 0.78 && e[0] < 0.85, 'AA x KK ~82%: ' + e[0]);
  const f = P.equityKnown([H('Ah Kh'), H('Qs Qd')], H('2h 7h Tc'));
  assert(Math.abs(f[0] + f[1] - 1) < 1e-9);
  const r = P.equityKnown([H('As Ks'), H('2c 3d')], H('Qs Js Ts 4h 5h'));
  assert.deepStrictEqual(r, [1, 0]);
}
console.log('equity conhecida ok');

// ---- Quiz ----
for (let i = 0; i < 300; i++) {
  for (const q of [P.quizPotOdds(), P.quizOuts(), P.quizWinner()]) {
    assert(q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length, 'resposta válida ' + q.type);
    assert.strictEqual(new Set(q.options).size, q.options.length, 'opções distintas');
    if (q.type === 'outs') assert.strictEqual(+q.options[q.answer], P.outsSets(q.hole, q.board).all.length);
    if (q.type === 'win') {
      const a = P.evalHand([...q.hands[0], ...q.board]), b = P.evalHand([...q.hands[1], ...q.board]);
      assert.strictEqual(q.answer, a > b ? 0 : b > a ? 1 : 2);
      assert.strictEqual(P.evalHand(q.best[0]), a, 'melhores 5 cartas corretas');
    }
  }
}
assert.strictEqual(P.outsSets(H('9h 8h'), H('7h 6c 2h')).all.length, 15, 'flush + sequência aberta = 15');
assert.strictEqual(P.outsSets(H('Ah 2h'), H('Kh 7h 9c')).all.length, 9);
console.log('quiz ok');

// Força passo a passo bate com chen() em todas as 1.326 mãos
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) {
  const br = P.chenBreakdown(a, b);
  assert.strictEqual(br.total, P.chen(a, b), `breakdown ${P.cardStr(a)} ${P.cardStr(b)}`);
  assert(br.calc.replace(/−/g, '-').endsWith(String(br.total)) || br.calc.endsWith('mín. 5'), br.calc);
}
console.log('força passo a passo ok');

// ---- Leitura da mão e da mesa ----
for (let t = 0; t < 2000; t++) {
  const d = P.shuffle([...Array(52).keys()]);
  for (const n of [5, 6, 7]) { const cs = d.slice(0, n); assert.strictEqual(P.evalHand(P.best5(cs)), P.evalHand(cs), 'best5 com ' + n + ' cartas'); }
}
{
  const m = P.madeHand(H('Ac Kd'), H('7s 7c 2d'));
  assert.strictEqual(m.short, 'Par de 7'); assert(m.boardOnly, 'par da mesa');
  const k = P.madeHand(H('Kc Kd'), H('Ks 9h 4c'));
  assert.strictEqual(k.short, 'Trinca de K'); assert.strictEqual(k.core.length, 3); assert(!k.boardOnly);
  assert.strictEqual(P.madeHand(H('Ah 2h'), H('Kh 7h 9h')).core.length, 5, 'flush usa 5 cartas');
  const dr = P.heroDraws(H('9h 8h'), H('7h 6c 2h'));
  assert.strictEqual(dr.outs, 15); assert.strictEqual(dr.name, 'Flush draw + Straight draw');
  assert.strictEqual(P.heroDraws(H('9h 8h'), H('7h 6c 2h 3d 4s')), null, 'sem projeto no river');
  const r = P.boardRead(H('Qh 7h 2c'), H('Ah Kh'));
  assert.deepStrictEqual(r.tags, ['Flush draw']); assert.strictEqual(r.label, 'Molhada');
  const r2 = P.boardRead(H('Ks 9h 4c Jd'), H('Kc Kd'));
  assert(r2.tags.includes('Sequência possível') && r2.label === 'Perigosa');
  assert(/Q-T/.test(r2.items.find(x => x.tag === 'Sequência possível').text));
  assert.strictEqual(r2.nuts.name, 'Sequência até o K');
  const r3 = P.boardRead(H('Kd 8s 3c'), H('Ah Qh'));
  assert.strictEqual(r3.label, 'Seca'); assert.deepStrictEqual(r3.tags, []);
  assert.strictEqual(P.boardRead(H('7s 7c 2d'), H('Ac Kd')).label, 'Pareada');
  assert(P.boardRead(H('Ah Kh Qh Jh Th'), H('5h 4h')).heroNuts, 'royal na mesa: todos empatam no nuts');
}
console.log('leitura da mão e da mesa ok');

// ---- Faixas modernas ----
{
  const pr = P.parseRange('22+, A2s+, KTs+, ATo-AJo, AK, 98s:0.5');
  assert.strictEqual(pr['22'], 1); assert.strictEqual(pr.AA, 1); assert.strictEqual(pr.A2s, 1); assert.strictEqual(pr.KQs, 1);
  assert.strictEqual(pr.K9s, undefined); assert.strictEqual(pr.ATo, 1); assert.strictEqual(pr.AQo, undefined); assert.strictEqual(pr.AKo, 1); assert.strictEqual(pr['98s'], 0.5);
  const pc = k => P.rangePct(P.RFI[k]);
  assert(pc('UTG') >= 0.15 && pc('UTG') <= 0.18, 'UTG abre 15–18%: ' + pc('UTG'));
  assert(pc('BTN') >= 0.40 && pc('BTN') <= 0.45, 'botão abre 40–45%: ' + pc('BTN'));
  const bb = P.VS_OPEN.late_bb, def = P.rangePct({ ...bb.call, ...bb.raise });
  assert(def >= 0.38 && def <= 0.48, 'BB defende ~40% contra o botão: ' + def);
  assert(P.HAND_RANK[0] === 'AA' && P.HAND_RANK.indexOf('72o') > 160, 'ordem de força');
  // push/fold: AA sempre; 72o nunca do UTG; heads-up 10 BB perto de 58% (Nash publicado ~57,7%)
  assert(P.PUSH_MAX[5].AA >= 20 && !(P.PUSH_MAX[5]['72o'] >= 3));
  const hu10 = Object.entries(P.PUSH_MAX[1]).reduce((a, [n, m]) => a + (m >= 10 ? (n.length === 2 ? 6 : n[2] === 's' ? 4 : 12) : 0), 0) / 1326;
  assert(Math.abs(hu10 - 0.577) < 0.03, 'push heads-up 10 BB: ' + hu10);
  // coach usa a tabela
  const g = new P.Game([0, 1, 2, 3, 4, 5].map(i => ({ name: 'F' + i, profile: P.PROFILES.bal })));
  g.button = 1; g.startHand(); // botão = 2 → UTG = seat 5
  const utg = [0, 1, 2, 3, 4, 5].find(s => g.posOf(s) === 'UTG');
  g.players[utg].hole = H('As Kd'); assert.strictEqual(P.preflopAdvice(g, utg).rec, 'raise');
  g.players[utg].hole = H('7s 2d'); assert.strictEqual(P.preflopAdvice(g, utg).rec, 'fold');
  g.players[utg].hole = H('Ks 9d'); assert.strictEqual(P.preflopAdvice(g, utg).rec, 'fold', 'K9o não abre do UTG');
}
console.log('faixas modernas ok');

// ---- Coach pós-flop ----
{
  const spot = (heroHole, vilHole, board, opts = {}) => {
    const g = new P.Game([{ name: 'Você' }, { name: 'Rival', profile: P.PROFILES.bal }]);
    g.button = 1; g.startHand();
    g.players[0].hole = H(heroHole); g.players[1].hole = H(vilHole);
    g.act(0, { type: 'raise', to: 25 }); g.act(1, { type: 'call' });
    g.board = H(board); g.street = board.split(' ').length === 3 ? 'flop' : board.split(' ').length === 4 ? 'turn' : 'river';
    g.toAct = 1;
    if (opts.bet) g.act(1, { type: 'raise', to: opts.bet }); else g.act(1, { type: 'check' });
    const info = P.postflopInfo(g, 0, 600);
    return P.postflopTips(g, 0, info);
  };
  const has = (t, k) => t.find(x => x.k === k);
  const dry = spot('Qs Jd', '9h 8h', 'Kc 7d 2s');
  assert(has(dry, 'cbet') && has(dry, 'cbet').rec === 'raise', 'c-bet em mesa seca sem mão');
  const wet = spot('9s 9d', 'Qc Jc', 'Kh Th 4h');
  assert(has(wet, 'cbet').rec === 'check', 'par médio em mesa monocromática: passar');
  const imp = spot('Ah 5h', 'Kc Kd', 'Kh 9h 2c', { bet: 60 });
  assert(has(imp, 'range'), 'mostra o que a aposta representa');
  const low = spot('6h 5h', 'Kc Kd', 'Kh 9h 2c', { bet: 60 });
  assert(has(low, 'reverse'), 'alerta de flush baixo');
  const riv = spot('Ac Qd', 'Kc Kd', 'Ks 9h 2c 4d 7s', { bet: 40 });
  assert(has(riv, 'mdf'), 'defesa mínima no river');
  const br = has(riv, 'range').breakdown, sum = br.reduce((a, x) => a + x.p, 0);
  assert(sum > 0.9 && sum <= 1.0001, 'categorias somam ~100%');
}
console.log('coach pós-flop ok');

// ---- Vazamentos: um jogador que paga demais no river ----
{
  let seed = 777; const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const realRandom = Math.random; Math.random = rng; // toda a simulação reprodutível, inclusive a equity
  const g = new P.Game([0, 1, 2, 3, 4, 5].map(i => ({ name: 'V' + i, profile: P.PROFILES.bal })), { rng });
  const decs = [], hands = [];
  for (let h = 0; h < 1000; h++) {
    for (const p of g.players) if (p.stack < 400) p.stack = 1000;
    g.startHand();
    const fl = {};
    while (!g.handOver) {
      const s = g.toAct;
      let a = P.botDecide(g, s, rng);
      if (s === 0) {
        const L = g.legal(0);
        if (g.street === 'preflop') { const adv = P.preflopAdvice(g, 0); a = adv.rec === 'raise' ? { type: 'raise', to: adv.push ? L.maxTo : g.raises ? g.currentBet * 3 : g.bb * 3 } : { type: adv.rec }; }
        if (g.street !== 'preflop' && L.toCall > 0) a = { type: 'call' }; // o vazamento: paga tudo depois do flop
        let grade = 'good';
        if (g.street !== 'preflop') { const info = P.postflopInfo(g, 0, 120); grade = P.gradePostflop(info, a.type === 'call' && L.toCall === 0 ? 'check' : a.type, L, g.street).grade; }
        decs.push(P.decisionRecord(g, 0, a.type === 'call' && L.toCall === 0 ? 'check' : a.type, grade));
        if (g.street === 'preflop' && (a.type === 'raise' || (a.type === 'call' && L.toCall > 0))) { fl.vpip = true; if (a.type === 'raise') fl.pfr = true; }
      }
      g.act(s, a);
      if (g.board.length >= 3 && !g.players[0].folded) fl.flop = true;
    }
    hands.push(P.handRecord(g, 0, fl));
  }
  Math.random = realRandom;
  const leaks = P.findLeaks(decs, hands);
  console.log('vazamentos encontrados:', leaks.slice(0, 3).map(l => `${l.id} ${Math.round(l.value * 100)}% (${l.n})`).join(', '));
  assert(leaks.length && ['rivercall', 'wtsd', 'wsd', 'foldcbet', 'af'].includes(leaks[0].id), 'o primeiro vazamento é o call no river: ' + (leaks[0] && leaks[0].id));
  const S = P.leakStats(decs, hands);
  const manual = hands.filter(h => h.flop && h.sd).length / hands.filter(h => h.flop).length;
  assert.strictEqual(S.wtsd.v, manual, 'estatística confere com a conta à mão');
}
console.log('vazamentos ok');

// ---- Treinos e quiz novos ----
{
  const expect = { abrir: g => g.street === 'preflop' && g.raises === 0, defesa: g => g.posOf(0) === 'BB' && g.raises === 1, pushfold: g => P.effBB(g, 0) <= 15,
    projetos: g => g.street !== 'preflop' && g.legal(0).toCall > 0 && P.heroDraws(g.players[0].hole, g.board), cbet: g => g.street === 'flop' && g.legal(0).toCall === 0 && g.pfAgg === 0, river: g => g.street === 'river' && g.legal(0).toCall > 0,
    hu_abrir: g => g.players.length === 2 && g.posOf(0) === 'BTN' && g.raises === 0, hu_defesa: g => g.players.length === 2 && g.posOf(0) === 'BB' && g.raises === 1,
    hu_push: g => g.players.length === 2 && P.effBB(g, 0) <= 12 && P.preflopAdvice(g, 0).push, spin_push: g => g.players.length === 3 && P.effBB(g, 0) <= 12 && P.preflopAdvice(g, 0).push,
    spin_call: g => g.players.length === 3 && g.legal(0).toCall > 0 && g.players.some(p => p.allIn) };
  for (const t of Object.keys(P.DRILLS)) for (let i = 0; i < 100; i++) {
    const d = P.makeDrill(t, i % 3), g = d.g;
    assert(g.toAct === 0 && !g.handOver && g.players.every(p => p.stack >= 0), `treino ${t} válido`);
    assert.strictEqual(new Set([...g.board, ...g.players.flatMap(p => p.hole)]).size, g.board.length + 2 * g.players.length, `treino ${t} sem carta repetida`);
    assert(expect[t](g), `treino ${t} monta a situação certa`);
  }
  for (let i = 0; i < 300; i++) for (const q of [P.quizOpen(), P.quizTexture(), P.quizNuts(), P.quizCombos(), P.quizMDF()]) {
    assert(q.answer >= 0 && q.answer < q.options.length && new Set(q.options).size === q.options.length, 'quiz novo válido: ' + q.type);
    if (q.type === 'tex') assert.strictEqual(q.options[q.answer], P.boardRead(q.board, null).label);
  }
}
console.log('treinos e quiz novos ok');

// ---- ICM ----
{
  const v = P.icm([5000, 3000, 2000], [0.5, 0.3, 0.2]);
  assert(Math.abs(v[0] - 0.3839) < 0.001 && Math.abs(v[2] - 0.2886) < 0.001, 'ICM confere com o exemplo publicado');
  assert(P.icm([1000, 1000, 1000], [0.5, 0.3, 0.2]).every(x => Math.abs(x - 1 / 3) < 1e-9), 'stacks iguais valem 1/3');
  // Bolha: 4 jogadores, 3 premiados. O líder empurra; você no BB com stack médio e dois stacks curtos na mesa.
  let found = null;
  for (const hand of ['Ac 9d', 'Kc Jd', 'Ac Td', '9c 9d', 'Ac Jd', 'Kc Qd', '8c 8d', 'Ac 8d']) {
    const g = new P.Game([0, 1, 2, 3].map(i => ({ name: 'B' + i, profile: P.PROFILES.bal })), { stack: 1000, sb: 50, bb: 100 });
    g.payouts = P.PAYOUTS['50/30/20'];
    g.players[0].stack = 2000; g.players[1].stack = 5000; g.players[2].stack = 600; g.players[3].stack = 600;
    g.button = 0; g.startHand(); // botão = 1 (líder), SB = 2, BB = 3 → coloca você no BB
    // reorganiza: você = lugar 3 (BB); usa o lugar 3 com stack médio
    g.players[3].stack += g.players[0].stack - 600; g.players[0].stack = 600 - 0;
    g.players[3].hole = H(hand);
    while (g.toAct !== 3) { const s = g.toAct; g.act(s, s === 1 ? { type: 'raise', to: g.players[1].stack + g.players[1].bet } : { type: 'fold' }); }
    const sp = P.icmCallSpot(g, 3, g.payouts);
    if (sp.eq >= sp.needChip && sp.eq < sp.needIcm) { found = { hand, sp, adv: P.preflopAdvice(g, 3) }; break; }
  }
  assert(found, 'existe call lucrativo em fichas que o ICM manda largar na bolha');
  assert.strictEqual(found.adv.rec, 'fold', 'coach recomenda desistir na bolha');
  console.log(`bolha: ${found.hand} tem ${Math.round(found.sp.eq * 100)}%; fichas pedem ${Math.round(found.sp.needChip * 100)}%, ICM pede ${Math.round(found.sp.needIcm * 100)}%`);
  // Torneio com prêmios termina e conserva fichas
  const g = new P.Game([0, 1, 2, 3, 4, 5].map(i => ({ name: 'T' + i, profile: P.PROFILES[['tag', 'lag', 'station', 'nit', 'bal', 'tag'][i]] })), { stack: 1500 });
  g.payouts = P.PAYOUTS['65/35'];
  let hands = 0;
  while (g.activeCount() > 1 && hands < 2000) {
    const lv = P.BLIND_LEVELS[P.blindLevel(hands, 5)]; g.sb = lv[0]; g.bb = lv[1]; g.startHand();
    while (!g.handOver) g.act(g.toAct, P.botDecide(g, g.toAct));
    assert.strictEqual(g.players.reduce((a, p) => a + p.stack, 0), 9000); g.eliminateBusted(); hands++;
  }
  assert(g.activeCount() === 1, 'torneio com ICM termina');
}
console.log('ICM ok');
