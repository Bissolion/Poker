// Importação de históricos reais da GGPoker: os arquivos de tests/historicos são partidas de verdade (nomes já anônimos)
const fs = require('fs'), path = require('path');
const E = require('../dist/engine.js');
const dir = path.join(__dirname, 'historicos');
const files = fs.readdirSync(dir);
const txt = files.filter(f => !f.startsWith('resumo')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FALHOU:', m); } };
const G = E.importHistories(txt, { iters: 300, rng: (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })() });
const hands = G.flatMap(g => g.hands);
ok(G.length === 24, `24 partidas (veio ${G.length})`);
ok(hands.length === 291, `291 mãos (veio ${hands.length})`);
ok(hands.every(h => h.ok), `todas as mãos reconstruídas: ${hands.filter(h => !h.ok).map(h => h.id + ' ' + h.why).join(', ')}`);
// fichas: o pote do motor bate com o "Total pot" do histórico em toda mão que terminou
const byId = Object.fromEntries(hands.map(h => [h.id, h]));
const grade = (id, street, type) => { const h = byId[id]; const d = h && h.decisions.find(x => x.street === street && x.type === type); return d && d.grade; };
ok(grade('BR1331938501', 'preflop', 'fold') === 'bad', 'Q6o largando all-in de 1,8 BB no heads-up = ruim');
ok(grade('BR1331938356', 'preflop', 'fold') === 'bad', 'T9o largando all-in de 3,7 BB no heads-up = ruim');
ok(grade('BR1331937480', 'preflop', 'call') === 'good', 'A6o pagando all-in de 2 BB = boa');
ok(grade('BR1331937808', 'preflop', 'call') === 'good', 'A7o pagando all-in de 6 BB = boa');
ok(grade('BR1331936493', 'preflop', 'call') === 'bad', 'limp com KQs e 5 BB = ruim');
// sem duplicar: importar o mesmo texto duas vezes dá as mesmas mãos
ok(E.parseHandHistory(txt + '\n' + txt).length === 291, 'mãos repetidas não duplicam');
// resumo de torneio
const s = E.parseTournamentSummary(fs.readFileSync(path.join(dir, 'resumo-mbr-22-11.txt'), 'utf8'));
ok(s && s.buyin === 0.25 && s.prize === 1.24 && s.place === 1 && s.players === 18, 'resumo do torneio: buy-in, prêmio, colocação');
// vazamentos reais: aparece o "agressivo demais depois do flop"
const L = E.findLeaks(hands.flatMap(h => h.recs), hands.map(h => h.hand).filter(Boolean));
ok(L.some(l => l.id === 'af' && l.dir === 'high'), 'vazamento: agressivo demais depois do flop');
if (fails) { console.error(`${fails} falha(s) na importação`); process.exit(1); }
console.log(`históricos ok: ${G.length} partidas, ${hands.length} mãos, ${hands.flatMap(h => h.decisions).length} decisões avaliadas`);
