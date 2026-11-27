// Banca: lançamentos automáticos, saldo, ROI, limite certo e avisos
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../dist/engine.js');
const dir = path.join(__dirname, 'historicos');
const text = fs.readdirSync(dir).filter(f => !f.startsWith('resumo')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const sum = P.parseTournamentSummary(fs.readFileSync(path.join(dir, 'resumo-mbr-22-11.txt'), 'utf8'));
const games = P.importHistories(text, { iters: 30 });
const g0 = games.find(g => g.tourId === sum.id);
const e0 = P.entryFromGame(g0, sum);
assert.strictEqual(e0.format, 'mtt'); assert.strictEqual(e0.buyin, 0.25); assert.strictEqual(e0.prize, 1.24); assert.strictEqual(e0.place, 1);
assert.strictEqual(P.inferFormat('Spin&Gold #7'), 'spin');
assert.strictEqual(P.inferFormat('GGMillion$ Festival Freeroll : $10,000'), 'freeroll');
assert.strictEqual(P.guessBuyin('GGMillion$ Festival Freeroll : $10,000'), 0);
assert.strictEqual(P.guessBuyin('Mystery Battle Royale $0.25'), 0.25);
assert.strictEqual(P.guessBuyin('Spin&Gold #7'), null);
// Spin sem resumo: quem perde tudo na última mão foi eliminado
const spins = games.filter(g => /Spin/.test(g.name)).map(g => P.entryFromGame(g, null));
const busts = spins.filter(e => e.result === 'bust'), wins = spins.filter(e => e.result === 'win');
assert(busts.length >= 5, 'eliminações detectadas: ' + busts.length);
assert(busts.every(e => e.prize === 0 && e.buyin == null && !P.entryDone(e)));
// buy-in por nome completa as partidas
const filled = spins.map(e => P.mergeEntry(null, Object.assign({}, e), { 'Spin&Gold #7': 0.25, 'Spin&Gold #1': 0.25 }));
assert(filled.filter(e => e.result === 'bust').every(P.entryDone));
// vitória de Spin com multiplicador
const w = P.mergeEntry(null, { id: 'x', kind: 'game', format: 'spin', date: '2026-11-22', buyin: 0.25, prize: null, place: 1, mult: 3 });
assert.strictEqual(w.prize, 0.75);
// o que a pessoa digitou vence o automático
const kept = P.mergeEntry({ id: 'T1', buyin: 0.5, edited: { buyin: true } }, { id: 'T1', kind: 'game', format: 'mtt', buyin: 0.25, prize: 1 });
assert.strictEqual(kept.buyin, 0.5);

// saldo e ROI
const now = new Date(2026, 10, 22, 15, 0);
const es = [
  { id: 'd1', kind: 'deposit', amount: 10, date: '2026-11-20' },
  { id: 'a', kind: 'game', format: 'spin', buyin: 0.25, prize: 0, date: '2026-11-21', time: '10:00' },
  { id: 'b', kind: 'game', format: 'spin', buyin: 0.25, prize: 0.5, place: 1, date: '2026-11-21', time: '11:00' },
  { id: 'c', kind: 'game', format: 'mtt', buyin: 1, prize: 0, date: '2026-11-22', time: '10:00' },
  { id: 'p', kind: 'game', format: 'spin', buyin: null, prize: 0, date: '2026-11-22', time: '11:00' },
  { id: 'w', kind: 'withdraw', amount: 2, date: '2026-11-22' },
];
const st = P.bankStats(es, now);
assert.strictEqual(st.balance, 7); assert.strictEqual(st.profit, -1); assert.strictEqual(st.pending, 1); assert.strictEqual(st.games, 3);
assert.strictEqual(st.by.spin.n, 2); assert.strictEqual(st.by.spin.wins, 1); assert.strictEqual(st.by.spin.roi, 0);
assert.strictEqual(st.by.mtt.roi, -1);
assert.strictEqual(st.monthProfit, -1);
// limite: US$7 não chega a 50 buy-ins de Spin $0.25 (US$12.50)
const sg = P.stakeSuggestion(7);
assert.strictEqual(sg.spin.stake, null);
assert.strictEqual(P.stakeSuggestion(12.5).spin.stake, 0.25);
assert.strictEqual(P.stakeSuggestion(30).spin.stake, 0.5);
assert.strictEqual(P.stakeSuggestion(30).cash.stake, null);  // nem NL2 (US$60)
assert.strictEqual(P.stakeSuggestion(60).cash.label, 'NL2');
// avisos
const late = P.bankWarnings([], P.BANK_DEFAULTS, new Date(2026, 10, 22, 1, 30));
assert(late.some(x => x.k === 'late'));
assert(!P.bankWarnings([], P.BANK_DEFAULTS, new Date(2026, 10, 22, 15)).some(x => x.k === 'late'));
const three = [1, 2, 3].map(i => ({ id: 's' + i, kind: 'game', format: 'spin', buyin: 0.25, prize: 0, date: '2026-11-22', time: '1' + i + ':00' }));
assert(P.bankWarnings(three, P.BANK_DEFAULTS, now).some(x => x.k === 'streak'));
const losses = [...Array(6)].map((_, i) => ({ id: 'l' + i, kind: 'game', format: 'spin', buyin: 0.25, prize: 0, date: '2026-11-22', time: '1' + i + ':00' }));
assert(P.bankWarnings(losses, P.BANK_DEFAULTS, now).some(x => x.k === 'stop'));
assert(!P.bankWarnings(three, P.BANK_DEFAULTS, now).some(x => x.k === 'stop'));
assert(P.depositCheck(losses, now));
assert(!P.depositCheck([{ id: 'd', kind: 'deposit', amount: 5, date: '2026-11-22' }], now));
// primeiro depósito com partidas antigas no negativo: sem aviso; banca que zerou hoje: aviso
assert(!P.depositCheck([{ id: 'o', kind: 'game', format: 'spin', buyin: 1, prize: 0, date: '2026-11-20' }], now));
const zero = [{ id: 'd', kind: 'deposit', amount: 1, date: '2026-11-21' }, { id: 'z', kind: 'game', format: 'spin', buyin: 1, prize: 0, date: '2026-11-22', time: '09:00' }];
assert(/zerou/.test(P.depositCheck(zero, now)));
console.log(`banca ok: ${spins.length} Spins (${busts.length} eliminações, ${wins.length} vitórias detectadas)`);
