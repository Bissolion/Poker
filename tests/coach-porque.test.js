// Etapas 3 e 4: coach de tamanho (nuts, 3-bet mínimo) e o porquê depois do flop
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../dist/engine.js');
const C = s => s.match(/../g).map(x => 'TJQKA'.includes(x[0]) || /\d/.test(x[0]) ? '23456789TJQKA'.indexOf(x[0]) * 4 + { s: 0, h: 1, d: 2, c: 3 }[x[1]] : -1);
// nuts
assert(P.isNuts(C('AhKh'), C('QhJhTh2c3d')), 'royal');
assert(!P.isNuts(C('AsAd'), C('KhQhJh2c3d')), 'AA não é nuts com 3 copas e sequência');
assert(P.isNuts(C('AhKd'), C('QsJcTd2h3h')), 'sequência máxima');
// valor perdido com a nuts no river; overbet com a nuts é bom
const base = { street: 'river', raises: 0, currentBet: 0, pot: 1000, toCall: 0, isBet: true, bb: 20, maxTo: 5000, st: 0.95, draws: [], board: C('QsJcTd2h3h'), nAct: 2, nuts: true };
let r = P.gradeSizing(Object.assign({}, base, { to: 300 }));
assert.strictEqual(r.grade, 'ok'); assert(/Valor perdido/.test(r.text), r.text);
r = P.gradeSizing(Object.assign({}, base, { to: 1500 }));
assert.strictEqual(r.grade, 'good'); assert(/Overbet/.test(r.text));
r = P.gradeSizing(Object.assign({}, base, { to: 1500, nuts: false, st: 0.7 }));
assert.strictEqual(r.grade, 'ok');
// 3-bet mínimo
r = P.gradeSizing({ street: 'preflop', raises: 1, to: 120, currentBet: 60, minTo: 120, maxTo: 2000, bb: 20, nAct: 6 });
assert(/mínimo/.test(r.text), r.text);
// porquê nas mãos reais
const dir = path.join(__dirname, 'historicos');
const text = fs.readdirSync(dir).filter(f => !f.startsWith('resumo')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const hands = P.parseHandHistory(text);
const get = id => P.replayHand(hands.find(h => h.id === id), { iters: 300 });
const r65 = get('SG4453829998'), river = r65.decisions.find(d => d.street === 'river' && d.type === 'raise');
assert.strictEqual(river.grade, 'bad'); assert(/já pagou/.test(river.why), river.why);
const t7 = get('BR1331936701'), turn = t7.decisions.find(d => d.street === 'turn' && d.type === 'raise');
assert(/já pagou no flop/.test(turn.why), turn.why);
const k4 = get('SG4453810084');
assert(k4.decisions.filter(d => d.street !== 'preflop' && d.type === 'raise').every(d => /Nenhuma mão pior paga/.test(d.why)));
const call = get('SG4453546329').decisions.find(d => d.street === 'river' && d.type === 'call');
assert(/precisa ganhar 20%/.test(call.why), call.why);
console.log('coach de tamanho e porquê pós-flop ok');
