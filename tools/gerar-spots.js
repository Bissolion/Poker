// Gera os cenários pós-flop extras com o solver (tools/solver, binário gerar-spot):
//   srp_btn  botão x big blind, 100 BB, com a segunda bala no turn
//   srp_co   cutoff x big blind, 100 BB
//   srp_sb   small blind x big blind, 100 BB (o small blind age primeiro)
//   3bet_bb  big blind re-aumenta o botão e leva call, 100 BB
//   curto    botão x big blind com 25 BB
// Um flop por textura. Retomável: flops já resolvidos são pulados. Depois rode tools/resumir-spots.js.
// Uso: node tools/gerar-spots.js [cenário ...] [--acc 4]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const P = require('../dist/engine.js');
const bin = path.join(__dirname, 'solver', 'target', 'release', 'gerar-spot');
const args = process.argv.slice(2), ai = args.indexOf('--acc');
const acc = ai >= 0 ? args[ai + 1] : '4';
const rangeStr = o => Object.entries(o).filter(([, w]) => w > 0).map(([c, w]) => (w < 1 ? `${c}:${w}` : c)).join(',');
// unidades: décimos de big blind
const SPOTS = {
  srp_btn: { oop: P.VS_OPEN.late_bb.call, ip: P.RFI.BTN, pot: 55, stack: 975, aggr: 'ip', turn: 1 },
  srp_co: { oop: P.VS_OPEN.late_bb.call, ip: P.RFI.CO, pot: 55, stack: 975, aggr: 'ip' },
  srp_sb: { oop: P.RFI.SB, ip: P.VS_OPEN.late_bb.call, pot: 60, stack: 970, aggr: 'oop' },
  '3bet_bb': { oop: P.VS_OPEN.late_bb.raise, ip: P.VS_3BET.late.call, pot: 205, stack: 900, aggr: 'oop' },
  curto: { oop: P.VS_OPEN.late_bb.call, ip: P.RFI.BTN, pot: 50, stack: 225, aggr: 'ip' },
};
const R = '23456789TJQKA', S = 'cdhs';
let seed = 2027; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const byKey = {};
for (let t = 0; t < 200000; t++) {
  const d = P.shuffle([...Array(52).keys()], rng), f = d.slice(0, 3), k = P.flopTexKey(f);
  if (!byKey[k]) byKey[k] = f;
}
const flops = Object.values(byKey).map(f => f.sort((a, b) => b - a).map(c => R[c >> 2] + S[c & 3]).join(''));
const which = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--acc');
for (const name of (which.length ? which : Object.keys(SPOTS))) {
  const sp = SPOTS[name], dir = path.join(__dirname, 'spots', name);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`${name}: ${flops.length} flops`);
  flops.forEach((f, i) => {
    const out = path.join(dir, f + '.json');
    if (fs.existsSync(out)) return;
    const t0 = Date.now();
    const json = execFileSync(bin, [rangeStr(sp.oop), rangeStr(sp.ip), f, acc, String(sp.pot), String(sp.stack), sp.aggr, sp.turn ? '1' : '0'], { maxBuffer: 1 << 29 }).toString();
    fs.writeFileSync(out, json);
    console.log(`${name} ${i + 1}/${flops.length} ${f} (${Math.round((Date.now() - t0) / 1000)} s, erro ${JSON.parse(json).expl}% do pote)`);
  });
}
