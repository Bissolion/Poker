// ---------- Bots ----------
const PROFILES = {
  tag:     { label: 'Sólida',      open: 7,  call: 8,  rr: 12, limp: 99, aggr: 0.7,  bluff: 0.08, margin: 0.03,  bet: 0.62, raise: 0.78, size: 0.66, noise: 1,   dev: { open: 0, call: 0, raise: 0, push: 0 } },
  lag:     { label: 'Agressivo',   open: 6,  call: 7,  rr: 10, limp: 99, aggr: 0.85, bluff: 0.22, margin: 0.0,   bet: 0.55, raise: 0.68, size: 0.8,  noise: 2,   dev: { open: 0.10, call: 0.03, raise: 0.06, push: 2 } },
  station: { label: 'Paga tudo',   open: 11, call: 4,  rr: 14, limp: 4,  aggr: 0.25, bluff: 0.03, margin: -0.12, bet: 0.72, raise: 0.88, size: 0.5,  noise: 1.5, dev: { open: -0.03, call: 0.25, raise: -0.04, push: -1, callPush: 4 } },
  nit:     { label: 'Cautelosa',   open: 9,  call: 10, rr: 14, limp: 99, aggr: 0.6,  bluff: 0.02, margin: 0.08,  bet: 0.7,  raise: 0.84, size: 0.6,  noise: 0.5, dev: { open: -0.06, call: -0.08, raise: -0.02, push: -2 } },
  bal:     { label: 'Equilibrado', open: 7,  call: 8,  rr: 11, limp: 99, aggr: 0.65, bluff: 0.12, margin: 0.02,  bet: 0.6,  raise: 0.75, size: 0.65, noise: 1.5, dev: { open: 0.02, call: 0.03, raise: 0, push: 0 } },
};
const POS_BONUS = { UTG: -1, MP: -0.5, CO: 0.5, BTN: 1.5, SB: 0, BB: 0.5 };

function oppRanges(g, p) { return g.players.filter(q => q !== p && !q.folded).map(q => ({ minChen: q.minChen, reads: q.reads })); }
// Força "equivalente a mano a mano": equity contra n rivais ≈ eqHU^n
function strengthOf(eq, nOpp) { return Math.pow(Math.max(eq, 1e-6), 1 / Math.max(1, nOpp)); }

function roundChips(x, g) { return Math.max(g.bb, Math.round(x / 5) * 5); }
function sizeRaise(g, p, L, to) {
  to = Math.max(L.minTo, Math.min(L.maxTo, roundChips(to, g)));
  if (to > 0.6 * L.maxTo) to = L.maxTo;
  return { type: 'raise', to };
}

// Níveis de dificuldade: o mesmo estilo de cada bot, jogado com mais ou menos habilidade
const SKILLS = {
  easy:   { label: 'Iniciante', noise: 2.6, iters: 120, reads: false, mistake: 0.2,  bluff: 0.5,  margin: -0.05, exploit: false, cbet: 0 },
  normal: { label: 'Normal',    noise: 1,   iters: 300, reads: true,  mistake: 0.03, bluff: 1,    margin: 0,     exploit: false, cbet: 0.2 },
  hard:   { label: 'Difícil',   noise: 0.4, iters: 500, reads: true,  mistake: 0,    bluff: 1.15, margin: 0,     exploit: true,  cbet: 0.6 },
};

// Stack efetivo em big blinds: o menor entre o seu e o maior rival ainda na mão
function effBB(g, seat) {
  const p = g.players[seat];
  const other = Math.max(0, ...g.players.filter(q => q !== p && !q.folded).map(q => q.stack + q.bet));
  return Math.min(p.stack + p.bet, other) / g.bb;
}
// Força mínima (Chen) para ir all-in quando ninguém aumentou, conforme o stack
function pushThreshold(depth, pos, nAct) {
  let t = depth <= 4 ? 2 : depth <= 7 ? 4 : depth <= 10 ? 6 : 7;
  if (pos === 'UTG' || pos === 'MP') t += 1.5;
  else if (pos === 'BTN' || pos === 'SB') t -= 1;
  if (nAct === 2) t -= 2; else if (nAct <= 4) t -= 1;
  return t;
}
// Força mínima para pagar (ou re-empurrar) um all-in quando o stack é curto
function callShoveThreshold(depth, nAct) { return (depth <= 6 ? 8 : 10) - (nAct === 2 ? 2 : 0); }
const PUSH_DEPTH = 12;

function botDecide(g, seat, rng = Math.random) {
  const p = g.players[seat], pr = p.profile, L = g.legal(seat), pos = g.posOf(seat);
  const sk = SKILLS[p.skill || g.skill] || SKILLS.normal;
  const nAct = g.activeCount();
  const passive = () => L.canCheck ? { type: 'check' } : { type: 'fold' };
  const shove = () => L.canRaise ? { type: 'raise', to: L.maxTo } : L.toCall > 0 ? { type: 'call' } : { type: 'check' };
  if (g.street === 'preflop') {
    const cls = classOf(p.hole[0], p.hole[1]), dv = pr.dev || {}, depth = effBB(g, seat);
    // erro de iniciante: às vezes paga ou desiste no automático
    if (rng() < sk.mistake) return L.toCall > 0 ? (rng() < 0.6 ? { type: 'call' } : passive()) : { type: 'check' };
    if (depth <= PUSH_DEPTH) {
      const noise = (rng() - 0.5) * 2 * sk.noise;
      if (g.raises === 0) { const r = pushFoldAdvice(cls, depth, behindOf(g, seat)); return r.max + (dv.push || 0) + noise >= depth ? shove() : passive(); }
      const r = pushFoldAdvice(cls, depth, 0, g.pfAgg >= 0 ? behindOf(g, g.pfAgg) : 1);
      return r.max + (dv.callPush || dv.push || 0) + noise >= depth ? shove() : passive();
    }
    const { sc, f } = rangeDecision(g, seat);
    // cada estilo se afasta da tabela: o agressivo abre mais, o "paga tudo" paga mais, a cautelosa aperta
    const hp = HAND_POS[cls] + (rng() - 0.5) * 0.04 * sk.noise;
    const shift = (base, set, d) => {
      if (!d) return base;
      const size = rangePct(set);
      if (d > 0 && !base && hp < size + d) return 0.8;
      if (d < 0 && base && hp > size + d) return base * 0.2;
      return base;
    };
    const fr = shift(f.raise, sc.raise, g.raises === 0 ? dv.open : dv.raise);
    const fc = g.raises === 0 ? 0 : shift(f.call, { ...sc.call, ...sc.raise }, dv.call);
    const x = rng();
    if (x < fr && L.canRaise) {
      const limpers = g.players.filter(q => q.seat !== seat && !q.folded && q.bet === g.bb && g.posOf(q.seat) !== 'BB').length;
      const to = g.raises === 0 ? g.bb * (nAct === 2 ? 2.5 : 3 + limpers) : g.currentBet * (g.raises >= 2 ? 2.3 : 3);
      return sizeRaise(g, p, L, to);
    }
    if (x < fr + fc || (x < fr && !L.canRaise)) return L.toCall ? { type: 'call' } : { type: 'check' };
    // o "paga tudo" completa o blind em vez de desistir
    if (g.raises === 0 && !L.canCheck && pr.limp < 99 && HAND_POS[cls] < 0.6) return { type: 'call' };
    return passive();
  }
  // Iniciante às vezes joga no automático: paga ou passa sem pensar
  if (rng() < sk.mistake) return L.toCall > 0 ? (rng() < 0.7 ? { type: 'call' } : { type: 'fold' }) : { type: 'check' };
  const oppsRaw = oppRanges(g, p);
  const opps = sk.reads ? oppsRaw : oppsRaw.map(o => ({ minChen: o.minChen }));
  const eq = equity(p.hole, g.board, opps, sk.iters, rng);
  const st = strengthOf(eq, opps.length);
  const pot = g.pot();
  // Difícil: lê as tendências de um rival único (desiste demais? paga demais?)
  let bluffMul = sk.bluff, betT = pr.bet, sizeMul = 1;
  const rivals = g.players.filter(q => q !== p && !q.folded);
  if (sk.exploit && rivals.length === 1 && rivals[0].tend.faced >= 6) {
    const fr = rivals[0].tend.folded / rivals[0].tend.faced;
    if (fr > 0.55) bluffMul *= 2.2;
    else if (fr < 0.3) { bluffMul *= 0.3; betT -= 0.06; sizeMul = 1.2; }
  }
  if (L.toCall === 0) {
    if (st >= betT && rng() < pr.aggr + 0.2 && L.canRaise) return sizeRaise(g, p, L, pot * pr.size * sizeMul * (0.85 + rng() * 0.3));
    // continuation bet: quem aumentou antes do flop aposta de novo no flop
    if (g.pfAgg === seat && g.street === 'flop' && opps.length <= 2 && L.canRaise && rng() < sk.cbet) return sizeRaise(g, p, L, pot * 0.5);
    if (rng() < pr.bluff * bluffMul && L.canRaise && opps.length <= 2) return sizeRaise(g, p, L, pot * 0.5);
    return { type: 'check' };
  }
  const odds = L.toCall / (pot + L.toCall);
  const margin = sk === SKILLS.hard ? pr.margin * 0.5 : pr.margin + sk.margin;
  if (st >= pr.raise && L.canRaise && rng() < pr.aggr) return sizeRaise(g, p, L, g.currentBet + Math.max(g.minRaise, (pot + L.toCall) * 0.8));
  if (eq >= odds + margin) return { type: 'call' };
  if (rng() < pr.bluff * bluffMul * 0.35 && L.canRaise && opps.length === 1) return sizeRaise(g, p, L, g.currentBet * 2.6);
  return passive();
}
