// Idiomas: toda chave de texto precisa existir nos dois idiomas, com as mesmas variáveis.
// O português é o próprio texto do código; o inglês fica em i18n/en.json.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { allKeys } = require('../tools/i18n-chaves.js');
const dir = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'i18n', 'en.json'), 'utf8'));
const { tx, html } = allKeys(dir);

// 1. nenhuma chave sem tradução
const missing = [...tx, ...html].filter(k => !(k in en));
assert.deepStrictEqual(missing, [], `textos sem tradução para o inglês:\n${missing.join('\n')}`);
// 2. as mesmas variáveis {0}, {1}... nos dois idiomas
const vars = s => [...s.matchAll(/\{(\d+)(?:\|[^}]*)?\}/g)].map(m => +m[1]).sort().filter((v, i, a) => a.indexOf(v) === i).join(',');
for (const k of tx) assert.strictEqual(vars(en[k]), vars(k), `variáveis diferentes em "${k}" → "${en[k]}"`);
// 3. marcação HTML preservada
const tags = s => (s.match(/<\/?[a-z]+/g) || []).sort().join(' ');
for (const k of Object.keys(en)) assert.strictEqual(tags(en[k]), tags(k), `tags HTML diferentes em "${k}"`);
const unused = Object.keys(en).filter(k => !tx.includes(k) && !html.includes(k));
if (unused.length) console.log(`aviso: ${unused.length} traduções sem uso: ${unused.slice(0, 5).join(' | ')}`);
console.log(`chaves ok: ${tx.length} do motor e da interface, ${html.length} textos fixos`);

// 4. o motor em inglês: gera quizzes, treinos e mãos sem texto em português
const src = fs.readFileSync(path.join(dir, 'dist', 'engine.js'), 'utf8');
const ctx = { POKER_LANG: 'en', POKER_EN: en, module: { exports: {} }, console, Math };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const E = ctx.module.exports;
assert.strictEqual(E.LANG, 'en');
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const PT = /[ãõçáéíóúâêôà]|\b(você|mão|não|para|desistir|pagar|aumentar|mesa|pote)\b/i;
const texts = [];
const quizzes = [E.quizPotOdds, E.quizOuts, E.quizWinner, E.quizOpen, E.quizTexture, E.quizNuts, E.quizCombos, E.quizMDF];
for (let i = 0; i < 40; i++) for (const q of quizzes) { const z = q(rng); texts.push(z.prompt, z.explain, ...z.options); }
for (const type of Object.keys(E.DRILLS)) for (let i = 0; i < 6; i++) {
  const d = E.makeDrill(type, i % 3, rng), r = E.gradeDrill(d, 'call', rng);
  texts.push(r.title, r.text, ...(r.tips || []).map(t => t.text), ...(r.tips || []).flatMap(t => (t.breakdown || []).map(b => b.name)));
}
for (let h = 0; h < 30; h++) {
  const g = new E.Game([{ name: 'You', isHuman: false, profile: E.PROFILES.tag }, ...['lag', 'station', 'nit', 'bal', 'tag'].map((p, i) => ({ name: 'Bot' + i, profile: E.PROFILES[p] }))], { stack: 1000, rng });
  g.button = h % 6; g.startHand();
  while (!g.handOver) {
    const s = g.toAct;
    if (s === 0) { const a = E.preflopAdvice(g, 0); texts.push(a.why, a.scTxt || ''); }
    g.act(s, E.botDecide(g, s, rng));
  }
  texts.push(...g.log.map(l => l.text));
}
for (const k in E.LEAK_TXT || {}) texts.push(...E.LEAK_TXT[k].high, ...E.LEAK_TXT[k].low);
for (const k in E.STAT_DEF) texts.push(E.STAT_DEF[k].name);
const bad = [...new Set(texts.filter(x => typeof x === 'string' && PT.test(x.replace(/Seu Zé/g, ''))))];
assert.deepStrictEqual([...E.I18N_MISSING], [], 'chaves pedidas em inglês sem tradução');
assert.deepStrictEqual(bad.slice(0, 10), [], 'texto em português na versão em inglês');
console.log(`motor em inglês ok: ${texts.length} textos conferidos`);
