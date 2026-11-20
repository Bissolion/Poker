// ---------- Torneio com prêmios: ICM (Independent Chip Model, Malmuth-Harville) ----------
// Prêmios em frações do total (pontos fictícios, sem dinheiro real)
const PAYOUTS = { '65/35': [0.65, 0.35], '50/30/20': [0.5, 0.3, 0.2], vencedor: [1] };
// Valor em prêmio de cada stack (fração do total de prêmios). Exato por recursão; rápido até 6 jogadores.
function icm(stacks, payouts) {
  const n = stacks.length, memo = new Map(), total = stacks.reduce((a, b) => a + b, 0);
  if (!total) return stacks.map(() => 0);
  // prob[i] de terminar em cada posição a partir de um conjunto de jogadores ainda "na disputa"
  const rec = (mask, place) => {
    if (place >= payouts.length || !mask) return null;
    const key = mask * 8 + place;
    if (memo.has(key)) return memo.get(key);
    let sum = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += stacks[i];
    const ev = Array(n).fill(0);
    if (sum > 0) for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i)) || !stacks[i]) continue;
      const p = stacks[i] / sum;
      ev[i] += p * payouts[place];
      const sub = rec(mask & ~(1 << i), place + 1);
      if (sub) for (let j = 0; j < n; j++) ev[j] += p * sub[j];
    }
    memo.set(key, ev);
    return ev;
  };
  let mask = 0; stacks.forEach((s, i) => { if (s > 0) mask |= 1 << i; });
  return rec(mask, 0) || stacks.map(() => 0);
}
// Equity de uma mão contra uma faixa de classes (sorteio de combinações sem repetir cartas)
function equityVsClasses(hole, classes, iters = 1200, rng = Math.random) {
  const list = Object.keys(classes).filter(c => classes[c]);
  if (!list.length) return 0.5;
  const weights = list.map(c => CLASS_W(c) * classes[c]), tw = weights.reduce((a, b) => a + b, 0);
  const combosOf = cls => { const out = []; const a = rv(cls[0]), b = rv(cls[1]); for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) { if (cls.length === 2) { if (s2 > s1) out.push([a * 4 + s1, b * 4 + s2]); } else if (cls[2] === 's') { if (s1 === s2) out.push([a * 4 + s1, b * 4 + s2]); } else if (s1 !== s2) out.push([a * 4 + s1, b * 4 + s2]); } return out; };
  const cache = {};
  let win = 0, n = 0;
  for (let it = 0; it < iters * 3 && n < iters; it++) {
    let x = rng() * tw, k = 0; while (x > weights[k]) { x -= weights[k]; k++; }
    const cs = cache[list[k]] || (cache[list[k]] = combosOf(list[k]));
    const v = cs[Math.floor(rng() * cs.length)];
    if (v.some(c => hole.includes(c))) continue;
    const used = new Set([...hole, ...v]), board = [];
    while (board.length < 5) { const c = Math.floor(rng() * 52); if (!used.has(c)) { used.add(c); board.push(c); } }
    const a = evalHand([...hole, ...board]), b = evalHand([...v, ...board]);
    win += a > b ? 1 : a === b ? 0.5 : 0; n++;
  }
  return n ? win / n : 0.5;
}
// Faixa de all-in de quem empurrou, pelas tabelas, no stack dele
function shoveRange(depth, k) {
  const t = PUSH_MAX[Math.min(5, Math.max(1, k))] || {}, out = {};
  for (const c in t) if (t[c] >= Math.max(1, Math.round(depth))) out[c] = 1;
  return out;
}
// Pagar um all-in com ICM: quanto de equity precisa, em fichas e em prêmio
function icmCallSpot(g, seat, payouts, rng = Math.random) {
  const p = g.players[seat], L = g.legal(seat);
  const shover = g.players.find(q => q.seat !== seat && !q.folded && q.bet === g.currentBet);
  if (!shover) return null;
  const alive = g.players.filter(q => !q.out);
  const stacksNow = () => alive.map(q => q.stack + q.bet); // fichas de cada um com o que já pôs nesta rua
  const potOthers = g.pot() - p.committed - shover.committed; // fichas mortas de quem já desistiu (blinds)
  const risk = Math.min(p.stack + p.bet, shover.stack + shover.bet); // o que está em jogo entre os dois
  const idx = q => alive.indexOf(q);
  const base = stacksNow().map((s, i) => s - (alive[i] === p || alive[i] === shover ? 0 : 0));
  // desistir: o rival leva o que está no meio
  const fold = base.slice(); fold[idx(p)] = p.stack; fold[idx(shover)] = shover.stack + shover.bet + p.bet + Math.max(0, potOthers);
  // pagar e ganhar / perder
  const win = base.slice(); win[idx(p)] = p.stack + p.bet + risk + Math.max(0, potOthers); win[idx(shover)] = shover.stack + shover.bet - risk;
  const lose = base.slice(); lose[idx(p)] = p.stack + p.bet - risk; lose[idx(shover)] = shover.stack + shover.bet + risk + Math.max(0, potOthers);
  // jogadores que ainda vão agir ou já desistiram ficam como estão
  const I = s => icm(s, payouts)[idx(p)];
  const evF = I(fold), evW = I(win), evL = I(lose);
  const needIcm = (evF - evL) / ((evW - evL) || 1e-9);
  const needChip = L.toCall / (g.pot() + L.toCall);
  const depth = (shover.stack + shover.bet) / g.bb;
  const eq = equityVsClasses(p.hole, shoveRange(depth, behindOf(g, shover.seat)), 1200, rng);
  return { eq, needIcm: Math.max(0, Math.min(1, needIcm)), needChip, premium: Math.max(0, needIcm - needChip), evNow: icm(stacksNow(), payouts)[idx(p)], shover: shover.name };
}
// Valor atual em prêmio de cada jogador vivo
function icmNow(g, payouts) {
  const alive = g.players.filter(q => !q.out), v = icm(alive.map(q => q.stack + q.committed), payouts);
  const out = {}; alive.forEach((q, i) => { out[q.seat] = v[i]; });
  return out;
}
const isBubble = (g, payouts) => g.activeCount() === payouts.length + 1;
// Ir all-in com ICM: compara o valor em prêmio de empurrar e de desistir, contra quem paga pela tabela
function icmPushSpot(g, seat, payouts, rng = Math.random) {
  const p = g.players[seat], alive = g.players.filter(q => !q.out), idx = q => alive.indexOf(q);
  const others = g.players.filter(q => q !== p && !q.folded);
  if (!others.length) return null;
  const k = behindOf(g, seat), depth = (p.stack + p.bet) / g.bb;
  // quem paga: o maior stack ainda por agir (o mais perigoso), com a faixa de call contra quem empurra com k atrás
  const caller = others.reduce((a, b) => (b.stack + b.bet > a.stack + a.bet ? b : a));
  const cDepth = Math.min(depth, (caller.stack + caller.bet) / g.bb);
  const callT = CALL_MAX[Math.min(5, k)] || {}, callRange = {};
  for (const c in callT) if (callT[c] >= Math.max(1, Math.round(cDepth))) callRange[c] = 1;
  const pc = Math.min(0.95, 1 - Math.pow(1 - rangePct(callRange), others.length));
  const dead = g.pot() - p.committed;
  const S = alive.map(q => q.stack + q.bet), risk = Math.min(p.stack + p.bet, caller.stack + caller.bet);
  const fold = S.slice();
  const steal = S.slice(); steal[idx(p)] += dead; others.forEach(q => { steal[idx(q)] -= q.bet; });
  const win = S.slice(); win[idx(p)] += risk + dead - caller.bet; others.forEach(q => { if (q !== caller) win[idx(q)] -= q.bet; }); win[idx(caller)] -= risk;
  const lose = S.slice(); lose[idx(p)] -= risk; lose[idx(caller)] += risk + dead - caller.bet; others.forEach(q => { if (q !== caller) lose[idx(q)] -= q.bet; });
  const I = s => icm(s, payouts)[idx(p)];
  const eq = equityVsClasses(p.hole, callRange, 1000, rng);
  const evPush = (1 - pc) * I(steal) + pc * (eq * I(win) + (1 - eq) * I(lose)), evFold = I(fold);
  return { push: evPush > evFold, evPush, evFold, eq, pc };
}
