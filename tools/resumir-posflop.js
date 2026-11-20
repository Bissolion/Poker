// Resume os flops resolvidos (tools/posflop/*.json) em tabelas por textura e tipo de mão
// e grava engine/19-posflop-dados.js. Uso: node tools/resumir-posflop.js
const fs = require('fs');
const path = require('path');
const P = require('../dist/engine.js');
const dir = path.join(__dirname, 'posflop');
const R = '23456789TJQKA', SU = { s: 0, h: 1, d: 2, c: 3 };
const card = s => R.indexOf(s[0]) * 4 + SU[s[1]];
const cards = s => s.match(/../g).map(card);
const CATS = P.FLOP_CATS;
const blank = keys => Object.fromEntries(CATS.map(c => [c, Object.fromEntries(keys.map(k => [k, 0]))]));
const acc = {};
const get = k => acc[k] || (acc[k] = { n: 0, expl: 0, cbet: blank(['check', 'small', 'big']), defesa: { pequena: blank(['fold', 'call', 'raise']), grande: blank(['fold', 'call', 'raise']) }, share: Object.fromEntries(CATS.map(c => [c, 0])) });
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const board = cards(d.flop), key = P.flopTexKey(board);
  const targets = [get(key), get('geral')];
  targets.forEach(t => { t.n++; t.expl += d.expl; });
  const catOf = (hands) => hands.map(h => P.flopCat(cards(h), board));
  const c1 = catOf(d.hands1), c0 = catOf(d.hands0);
  // botão depois que o big blind passa
  const A = d.ip_vs_check.actions, n1 = d.ip_vs_check.n, s1 = d.ip_vs_check.s;
  const slot = a => a === 'Check' ? 'check' : /Bet\(1\d\)/.test(a) ? 'small' : 'big';
  d.hands1.forEach((h, i) => {
    const w = d.w1[i]; if (!w) return;
    for (const t of targets) { t.share[c1[i]] += w; A.forEach((a, k) => { t.cbet[c1[i]][slot(a)] += w * s1[k * n1 + i]; }); }
  });
  // big blind diante da aposta: peso = faixa × chance de ter passado
  const r0 = d.oop_root, n0 = r0.n;
  for (const b of d.oop_vs_bet) {
    const amt = +b.bet.match(/\d+/)[0], size = amt <= 25 ? 'pequena' : 'grande';
    const B = b.r.actions;
    d.hands0.forEach((h, i) => {
      const w = d.w0[i] * r0.s[i]; if (!w) return; // r0.s[i] = probabilidade de passar (ação 0)
      for (const t of targets) B.forEach((a, k) => { const sl = a === 'Fold' ? 'fold' : a === 'Call' ? 'call' : 'raise'; t.defesa[size][c0[i]][sl] += w * b.r.s[k * n0 + i]; });
    });
  }
}
// normaliza: frequências por tipo de mão; sem dados suficientes, usa o geral
const norm = (o, fb) => {
  const out = {};
  for (const c of CATS) {
    const tot = Object.values(o[c]).reduce((a, b) => a + b, 0);
    out[c] = tot > 0.5 ? Object.fromEntries(Object.entries(o[c]).map(([k, v]) => [k, Math.round(v / tot * 100) / 100])) : fb ? fb[c] : null;
  }
  return out;
};
const G = acc.geral, geral = { cbet: norm(G.cbet), defesa: { pequena: norm(G.defesa.pequena), grande: norm(G.defesa.grande) } };
const tex = {};
for (const k of Object.keys(acc).filter(k => k !== 'geral').sort()) {
  const t = acc[k], tot = Object.values(t.share).reduce((a, b) => a + b, 0);
  tex[k] = {
    flops: t.n,
    cbet: norm(t.cbet, geral.cbet),
    defesa: { pequena: norm(t.defesa.pequena, geral.defesa.pequena), grande: norm(t.defesa.grande, geral.defesa.grande) },
    // com que frequência o botão aposta no total, nesta textura
    total: Math.round(CATS.reduce((a, c) => a + t.cbet[c].small + t.cbet[c].big, 0) / tot * 100) / 100,
  };
}
const out = `// Gerado por tools/resumir-posflop.js a partir de ${files.length} flops resolvidos (erro médio ${(G.expl / G.n).toFixed(1)}% do pote). Não edite à mão.
// Pote de abertura Botão x Big blind, 100 BB. cbet: botão depois que o big blind passa (small = 1/3 do pote, big = 3/4).
// defesa: big blind diante da aposta do botão (pequena = 1/3, grande = 3/4).
const POSFLOP = ${JSON.stringify({ geral, tex })};
`;
fs.writeFileSync(path.join(__dirname, '..', 'engine', '19-posflop-dados.js'), out);
console.log(`${files.length} flops, ${Object.keys(tex).length} texturas`);
for (const k in tex) console.log(k.padEnd(14), 'aposta', Math.round(tex[k].total * 100) + '%');
console.log('geral cbet:', JSON.stringify(geral.cbet));
console.log('geral defesa pequena:', JSON.stringify(geral.defesa.pequena));
