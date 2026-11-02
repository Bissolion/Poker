const P = require('./engine.js');
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
