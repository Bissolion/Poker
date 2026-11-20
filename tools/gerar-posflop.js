// Gera as tabelas pós-flop com o solver (tools/solver, postflop-solver em Rust).
// Pote de abertura BTN x BB, 100 BB, faixas do próprio app. Escolhe flops representativos
// (um par por textura), resolve cada um e guarda o resultado bruto em tools/posflop/.
// Retomável: flops já resolvidos são pulados. Depois rode tools/resumir-posflop.js.
// Uso: node tools/gerar-posflop.js [precisão em % do pote, padrão 2.5]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const P = require('../dist/engine.js');
const dir = path.join(__dirname, 'posflop');
fs.mkdirSync(dir, { recursive: true });
const bin = path.join(__dirname, 'solver', 'target', 'release', 'gerar-posflop');
const acc = process.argv[2] || '2.5';
const rangeStr = o => Object.entries(o).filter(([, w]) => w > 0).map(([c, w]) => (w < 1 ? `${c}:${w}` : c)).join(',');
const OOP = rangeStr(P.VS_OPEN.late_bb.call), IP = rangeStr(P.RFI.BTN);
const R = '23456789TJQKA', S = 'cdhs';
// textura de um flop: naipes, par, carta mais alta
const texKey = f => {
  const r = f.map(c => c >> 2).sort((a, b) => b - a), s = new Set(f.map(c => c & 3)).size;
  const suits = s === 1 ? 'mono' : s === 2 ? 'two' : 'rain';
  const paired = r[0] === r[1] || r[1] === r[2] ? 'par' : 'sem';
  const high = r[0] === 12 ? 'A' : r[0] >= 10 ? 'KQ' : r[0] >= 8 ? 'JT' : 'low';
  return `${suits}-${paired}-${high}`;
};
let seed = 2026; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const byKey = {};
for (let t = 0; t < 200000; t++) {
  const d = P.shuffle([...Array(52).keys()], rng), f = d.slice(0, 3), k = texKey(f);
  const list = byKey[k] || (byKey[k] = []);
  const want = /par/.test(k) ? 1 : 2;
  if (list.length < want) list.push(f);
}
const flops = Object.values(byKey).flat().map(f => f.sort((a, b) => b - a).map(c => R[c >> 2] + S[c & 3]).join(''));
console.log(`${flops.length} flops em ${Object.keys(byKey).length} texturas`);
flops.forEach((f, i) => {
  const out = path.join(dir, f + '.json');
  if (fs.existsSync(out)) return;
  const t0 = Date.now();
  const json = execFileSync(bin, [OOP, IP, f, acc], { maxBuffer: 1 << 28 }).toString();
  fs.writeFileSync(out, json);
  console.log(`${i + 1}/${flops.length} ${f} (${Math.round((Date.now() - t0) / 1000)} s, erro ${JSON.parse(json).expl}% do pote)`);
});
