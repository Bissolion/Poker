// Gera engine/00-dados.js: ordem de força das 169 mãos iniciais e tabelas de all-in ou desistir (push/fold).
// Uso: node build.js && node tools/gerar-dados.js   (leva cerca de 1 minuto)
//
// 1. Matriz de equity 169x169 (Monte Carlo, combinações concretas sem cartas repetidas) → tools/equity-169.json
// 2. Heads-up: equilíbrio de Nash de push/fold (SB empurra, BB paga) por jogo fictício, de 1 a 20 BB.
// 3. Mesa cheia (aproximação): quem empurra com k jogadores por agir enfrenta k possíveis "pagadores"
//    com a faixa de call do BB; a faixa de push é a melhor resposta a isso. A faixa de call do BB contra
//    cada posição é a melhor resposta à faixa de push daquela posição.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const P = require('../dist/engine.js');

const R = 'AKQJT98765432';
const CLASSES = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
  if (i === j) CLASSES.push(R[i] + R[j]);
  else if (j > i) CLASSES.push(R[i] + R[j] + 's');
  else CLASSES.push(R[j] + R[i] + 'o');
}
const rIdx = ch => 12 - R.indexOf(ch); // 12 = A ... 0 = 2 (mesma escala do motor)
function combos(cls) {
  const a = rIdx(cls[0]), b = rIdx(cls[1]), out = [];
  for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) {
    if (cls.length === 2) { if (s2 > s1) out.push([a * 4 + s1, b * 4 + s2]); }
    else if (cls[2] === 's') { if (s1 === s2) out.push([a * 4 + s1, b * 4 + s2]); }
    else if (s1 !== s2) out.push([a * 4 + s1, b * 4 + s2]);
  }
  return out;
}
const W = CLASSES.map(c => combos(c).length); // 6, 4 ou 12

function eqPair(i, j, iters, rng) {
  const A = combos(CLASSES[i]), B = combos(CLASSES[j]);
  let win = 0, n = 0;
  for (let t = 0; t < iters; t++) {
    const a = A[Math.floor(rng() * A.length)], b = B[Math.floor(rng() * B.length)];
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) { t--; if (++n > iters * 20) break; continue; }
    const used = new Set([...a, ...b]), board = [];
    while (board.length < 5) { const c = Math.floor(rng() * 52); if (!used.has(c)) { used.add(c); board.push(c); } }
    const sa = P.evalHand([...a, ...board]), sb = P.evalHand([...b, ...board]);
    win += sa > sb ? 1 : sa === sb ? 0.5 : 0;
  }
  return win / iters;
}
function rngFrom(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

if (!isMainThread) {
  const { pairs, iters, seed } = workerData, rng = rngFrom(seed), out = [];
  for (const [i, j] of pairs) out.push([i, j, eqPair(i, j, iters, rng)]);
  parentPort.postMessage(out);
  return;
}

(async () => {
  const cache = path.join(__dirname, 'equity-169.json');
  let EQ;
  if (fs.existsSync(cache)) EQ = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    const N = 169, pairs = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pairs.push([i, j]);
    const nw = 2, iters = 1200, t0 = Date.now();
    const parts = await Promise.all([...Array(nw)].map((_, w) => new Promise((ok, bad) => {
      const wk = new Worker(__filename, { workerData: { pairs: pairs.filter((_, k) => k % nw === w), iters, seed: 1000 + w } });
      wk.on('message', ok); wk.on('error', bad);
    })));
    EQ = [...Array(N)].map(() => Array(N).fill(0.5));
    for (const part of parts) for (const [i, j, e] of part) { EQ[i][j] = e; EQ[j][i] = 1 - e; }
    // par contra o mesmo par e mãos iguais: 0,5 (já preenchido); arredonda para guardar
    EQ = EQ.map(r => r.map(x => Math.round(x * 1000) / 1000));
    fs.writeFileSync(cache, JSON.stringify(EQ));
    console.log(`matriz de equity: ${pairs.length} confrontos em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const N = 169, TOT = 1326;
  // ordem de força: equity contra uma mão qualquer
  const vsRandom = EQ.map((row, i) => row.reduce((a, e, j) => a + e * W[j], 0) / TOT);
  const RANK = CLASSES.map((c, i) => [c, vsRandom[i]]).sort((a, b) => b[1] - a[1]).map(x => x[0]);

  const eqVs = (i, set) => { let s = 0, w = 0; for (let j = 0; j < N; j++) if (set[j]) { s += EQ[i][j] * W[j] * set[j]; w += W[j] * set[j]; } return w ? s / w : 0.5; };
  const freq = set => set.reduce((a, x, j) => a + x * W[j], 0) / TOT;

  // Heads-up Nash por jogo fictício (faixas = frequência média das melhores respostas)
  function huNash(S) {
    let push = Array(N).fill(1), call = Array(N).fill(0.3);
    for (let it = 1; it <= 400; it++) {
      const cf = freq(call);
      const bp = CLASSES.map((_, i) => {
        const ev = (1 - cf) * 1 + cf * (eqVs(i, call) * 2 * S - S); // em relação a desistir (-0,5): ganha +1 se BB desiste
        return ev > -0.5 ? 1 : 0;
      });
      const bc = CLASSES.map((_, i) => (eqVs(i, push) * 2 * S - S > -1 ? 1 : 0));
      push = push.map((x, i) => x + (bp[i] - x) / (it + 1));
      call = call.map((x, i) => x + (bc[i] - x) / (it + 1));
    }
    return { push: push.map(x => (x >= 0.5 ? 1 : 0)), call: call.map(x => (x >= 0.5 ? 1 : 0)) };
  }
  // Mesa cheia: k jogadores por agir, cada um com a faixa de call c do BB
  function multiPush(S, k, callSet) {
    const cf = freq(callSet), pNo = Math.pow(1 - cf, k);
    return CLASSES.map((_, i) => {
      const ev = pNo * 1.5 + (1 - pNo) * (eqVs(i, callSet) * (2 * S + 1) - S);
      return ev > 0 ? 1 : 0;
    });
  }
  const bbCall = (S, pushSet) => CLASSES.map((_, i) => (eqVs(i, pushSet) * (2 * S + 0.5) - S > -1 ? 1 : 0));

  const MAX = 20;
  const pushMax = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} }, callMax = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  const hu = {};
  for (let S = 1; S <= MAX; S++) {
    hu[S] = huNash(S);
    for (let k = 1; k <= 5; k++) {
      const ps = k === 1 ? hu[S].push : multiPush(S, k, hu[S].call);
      const cs = k === 1 ? hu[S].call : bbCall(S, ps);
      CLASSES.forEach((c, i) => {
        if (ps[i]) pushMax[k][c] = S;
        if (cs[i]) callMax[k][c] = S;
      });
    }
  }
  // compacta: só mãos com valor > 0
  const pack = m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([, s]) => s > 0))]));
  const pct = set => Math.round(freq(set) * 1000) / 10;
  console.log('heads-up 10 BB: SB empurra', pct(hu[10].push) + '%,', 'BB paga', pct(hu[10].call) + '%');
  console.log('heads-up  5 BB: SB empurra', pct(hu[5].push) + '%,', 'BB paga', pct(hu[5].call) + '%');
  const out = `// Gerado por tools/gerar-dados.js — não edite à mão.
// HAND_RANK: as 169 mãos iniciais da mais forte para a mais fraca (equity contra uma mão qualquer).
// PUSH_MAX[k][mão] = maior stack (em BB) em que vale ir all-in com k jogadores ainda por agir.
// CALL_MAX[k][mão] = maior stack (em BB) em que vale pagar o all-in de quem empurrou com k jogadores por agir.
const HAND_RANK = ${JSON.stringify(RANK)};
const PUSH_MAX = ${JSON.stringify(pack(pushMax))};
const CALL_MAX = ${JSON.stringify(pack(callMax))};
`;
  fs.writeFileSync(path.join(__dirname, '..', 'engine', '00-dados.js'), out);
  console.log('engine/00-dados.js gerado');
})();
