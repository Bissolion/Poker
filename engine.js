// ===== Motor de Texas Hold'em No-Limit =====
// Cartas: inteiros 0..51. rank = c>>2 (0 = 2 ... 12 = A), naipe = c&3 (0 ♠, 1 ♥, 2 ♦, 3 ♣)
const RANK_CH = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_CH = ['♠','♥','♦','♣'];
const rankOf = c => c >> 2;
const suitOf = c => c & 3;
const cardStr = c => RANK_CH[rankOf(c)] + SUIT_CH[suitOf(c)];

function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---------- Avaliador de mãos (5 a 7 cartas) ----------
function straightHigh(mask) {
  const ext = (mask << 1) | ((mask >> 12) & 1); // ás também vale como 1
  for (let hi = 13; hi >= 4; hi--) if (((ext >> (hi - 4)) & 31) === 31) return hi - 1;
  return -1;
}
function mkScore(cat, ks) {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 16 + (ks[i] === undefined || ks[i] < 0 ? 0 : ks[i] + 1);
  return s;
}
const CAT_BASE = 16 ** 5;
function evalHand(cards) {
  const rc = new Array(13).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) { const r = c >> 2, s = c & 3; rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r; }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const h = straightHigh(sm[fs]); if (h >= 0) return mkScore(8, [h]); }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    const n = rc[r];
    if (n === 4) quads.push(r); else if (n === 3) trips.push(r); else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r);
  }
  const bestOther = (...ex) => { for (let r = 12; r >= 0; r--) if (rc[r] && !ex.includes(r)) return r; return -1; };
  if (quads.length) return mkScore(7, [quads[0], bestOther(quads[0])]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const p = Math.max(trips.length > 1 ? trips[1] : -1, pairs.length ? pairs[0] : -1);
    return mkScore(6, [trips[0], p]);
  }
  if (fs >= 0) { const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (sm[fs] & (1 << r)) ks.push(r); return mkScore(5, ks); }
  const st = straightHigh(mask);
  if (st >= 0) return mkScore(4, [st]);
  if (trips.length) return mkScore(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) return mkScore(2, [pairs[0], pairs[1], bestOther(pairs[0], pairs[1])]);
  if (pairs.length) return mkScore(1, [pairs[0], ...singles.slice(0, 3)]);
  return mkScore(0, singles.slice(0, 5));
}
const catOf = s => Math.floor(s / CAT_BASE);
const kOf = (s, i) => Math.floor(s / 16 ** (4 - i)) % 16 - 1;
function handName(score) {
  const c = catOf(score), R = i => RANK_CH[kOf(score, i)];
  switch (c) {
    case 8: return kOf(score, 0) === 12 ? 'Royal flush' : `Straight flush até o ${R(0)}`;
    case 7: return `Quadra de ${R(0)}`;
    case 6: return `Full house, ${R(0)} com ${R(1)}`;
    case 5: return `Flush, ${R(0)} alto`;
    case 4: return `Sequência até o ${R(0)}`;
    case 3: return `Trinca de ${R(0)}`;
    case 2: return `Dois pares, ${R(0)} e ${R(1)}`;
    case 1: return `Par de ${R(0)}`;
    default: return `Carta alta ${R(0)}`;
  }
}

// ---------- Força pré-flop (fórmula de Chen) ----------
function chen(c1, c2) {
  const r1 = rankOf(c1), r2 = rankOf(c2), hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  const pts = r => r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2;
  let s = pts(hi);
  if (r1 === r2) return Math.max(5, Math.ceil(s * 2));
  if (suitOf(c1) === suitOf(c2)) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return Math.ceil(s);
}
function comboName(c1, c2) {
  const a = rankOf(c1) >= rankOf(c2) ? c1 : c2, b = a === c1 ? c2 : c1;
  const A = RANK_CH[rankOf(a)], B = RANK_CH[rankOf(b)];
  if (rankOf(a) === rankOf(b)) return A + B;
  return A + B + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

// ---------- Equity por Monte Carlo ----------
// opps: [{minChen}] — faixa mínima estimada pela ação pré-flop de cada rival
function equity(hole, board, opps, iters = 1000, rng = Math.random) {
  const used = new Set([...hole, ...board]);
  const pool = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) pool.push(c);
  const arr = pool.slice();
  let total = 0;
  const need = 5 - board.length;
  for (let it = 0; it < iters; it++) {
    let end = arr.length;
    const draw = () => { const i = Math.floor(rng() * end); const c = arr[i]; arr[i] = arr[end - 1]; arr[end - 1] = c; end--; return c; };
    const oh = [];
    for (const o of opps) {
      let a, b, tries = 0;
      for (;;) {
        a = draw(); b = draw();
        if (!o.minChen || chen(a, b) >= o.minChen || tries++ > 25) break;
        end += 2;
      }
      oh.push([a, b]);
    }
    const full = board.slice();
    for (let k = 0; k < need; k++) full.push(draw());
    const me = evalHand([...hole, ...full]);
    let best = -1, ties = 0;
    for (const h of oh) {
      const s = evalHand([...h, ...full]);
      if (s > best) { best = s; ties = 1; } else if (s === best) ties++;
    }
    if (me > best) total += 1; else if (me === best) total += 1 / (ties + 1);
  }
  return total / iters;
}

// ---------- Mesa ----------
const POS_NAMES = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];
const POS_LABEL = { BTN: 'Botão', SB: 'Small blind', BB: 'Big blind', UTG: 'UTG (primeiro)', MP: 'Middle', CO: 'Cutoff' };
const STREET_LABEL = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' };

class Game {
  constructor(players, opts = {}) {
    this.sb = opts.sb || 5; this.bb = opts.bb || 10;
    this.rng = opts.rng || Math.random;
    this.players = players.map((p, i) => Object.assign({ seat: i, stack: 1000, hole: [], bet: 0, committed: 0, folded: false, allIn: false, hasActed: false, actedSinceFull: false, minChen: 0, lastAction: '' }, p));
    this.n = this.players.length;
    this.button = Math.floor(this.rng() * this.n);
    this.handNo = 0;
    this.log = [];
  }
  posOf(seat) { return POS_NAMES[(seat - this.button + this.n) % this.n]; }
  next(seat) { return (seat + 1) % this.n; }
  emit(text, kind = 'act') { this.log.push({ hand: this.handNo, text, kind }); }

  startHand() {
    this.handNo++;
    this.button = this.next(this.button);
    this.board = []; this.street = 'preflop'; this.handOver = false; this.result = null;
    this.currentBet = 0; this.minRaise = this.bb; this.raises = 0;
    this.deck = shuffle([...Array(52).keys()], this.rng);
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, committed: 0, folded: false, allIn: false, hasActed: false, actedSinceFull: false, minChen: 0, lastAction: '' });
    this.emit(`Mão #${this.handNo}`, 'hand');
    for (let k = 0; k < 2; k++) for (let i = 1; i <= this.n; i++) this.players[(this.button + i) % this.n].hole.push(this.deck.pop());
    const sbS = this.next(this.button), bbS = this.next(sbS);
    this.post(sbS, this.sb); this.post(bbS, this.bb);
    this.currentBet = Math.max(this.players[sbS].bet, this.players[bbS].bet, this.bb);
    this.toAct = this.findNext(bbS);
    if (this.toAct < 0) this.endStreet();
  }
  post(seat, amt) {
    const p = this.players[seat]; const a = Math.min(amt, p.stack);
    p.stack -= a; p.bet += a; p.committed += a; if (p.stack === 0) p.allIn = true;
    this.emit(`${p.name} posta ${a}`, 'blind');
  }
  needs(p) { return !p.folded && !p.allIn && (!p.hasActed || p.bet < this.currentBet); }
  findNext(from) {
    let s = from;
    for (let i = 0; i < this.n; i++) { s = this.next(s); if (this.needs(this.players[s])) return s; }
    return -1;
  }
  live() { return this.players.filter(p => !p.folded); }
  pot() { return this.players.reduce((a, p) => a + p.committed, 0); }
  potCollected() { return this.players.reduce((a, p) => a + p.committed - p.bet, 0); }

  legal(seat) {
    const p = this.players[seat];
    const toCall = Math.min(this.currentBet - p.bet, p.stack);
    const others = this.players.filter(q => q !== p && !q.folded && !q.allIn).length;
    const maxTo = p.bet + p.stack;
    let minTo = Math.min(this.currentBet + this.minRaise, maxTo);
    const canRaise = p.stack > toCall && !p.actedSinceFull && others > 0;
    return { toCall, canCheck: toCall === 0, canRaise, minTo, maxTo, isBet: this.currentBet === 0 };
  }

  act(seat, a) {
    if (this.handOver || seat !== this.toAct) throw new Error('fora de vez');
    const p = this.players[seat], L = this.legal(seat);
    let type = a.type;
    if (type === 'check' && !L.canCheck) type = 'call';
    if (type === 'call' && L.toCall === 0) type = 'check';
    if (type === 'raise' && !L.canRaise) type = L.canCheck ? 'check' : 'call';
    const prevBet = this.currentBet;
    if (type === 'fold') { p.folded = true; p.lastAction = 'Desiste'; this.emit(`${p.name} desiste`); }
    else if (type === 'check') { p.lastAction = 'Passa'; this.emit(`${p.name} passa`); }
    else if (type === 'call') {
      this.put(p, L.toCall); p.lastAction = p.allIn ? 'All-in' : `Paga ${L.toCall}`;
      this.emit(`${p.name} paga ${L.toCall}${p.allIn ? ' (all-in)' : ''}`);
      if (this.street === 'preflop' && prevBet > this.bb) p.minChen = Math.max(p.minChen, this.raises >= 2 ? 9 : 5);
    } else {
      let to = Math.round(Math.max(L.minTo, Math.min(a.to || L.minTo, L.maxTo)));
      this.put(p, to - p.bet);
      const size = to - this.currentBet;
      if (size >= this.minRaise) { this.minRaise = size; for (const q of this.players) if (q !== p) q.actedSinceFull = false; }
      if (to > this.currentBet) { this.currentBet = to; for (const q of this.players) if (q !== p) q.hasActed = false; }
      if (this.street === 'preflop') p.minChen = Math.max(p.minChen, this.raises === 0 ? 7 : this.raises === 1 ? 10 : 12);
      this.raises++;
      const verb = prevBet === 0 ? 'aposta' : 'aumenta para';
      p.lastAction = p.allIn ? 'All-in' : (prevBet === 0 ? `Aposta ${to}` : `Aumenta ${to}`);
      this.emit(`${p.name} ${verb} ${to}${p.allIn ? ' (all-in)' : ''}`);
    }
    p.hasActed = true; p.actedSinceFull = true;
    this.advance(seat);
  }
  put(p, amt) {
    const a = Math.min(amt, p.stack);
    p.stack -= a; p.bet += a; p.committed += a;
    if (p.stack === 0) p.allIn = true;
  }
  advance(seat) {
    if (this.live().length === 1) return this.finishUncontested();
    const nx = this.findNext(seat);
    if (nx >= 0) { this.toAct = nx; return; }
    this.endStreet();
  }
  refundUncalled() {
    const sorted = this.players.map(p => p.bet).sort((a, b) => b - a);
    const top = this.players.find(p => p.bet === sorted[0]);
    if (sorted[0] > sorted[1]) {
      const d = sorted[0] - sorted[1];
      top.bet -= d; top.committed -= d; top.stack += d; if (top.stack > 0) top.allIn = false;
      if (d > 0 && this.live().length > 1) this.emit(`${d} devolvidos a ${top.name}`, 'info');
    }
  }
  endStreet() {
    this.refundUncalled();
    for (const p of this.players) { p.bet = 0; p.hasActed = false; p.actedSinceFull = false; }
    this.currentBet = 0; this.minRaise = this.bb; this.raises = 0;
    if (this.street === 'river') return this.showdown();
    if (this.street === 'preflop') { this.street = 'flop'; this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop()); }
    else if (this.street === 'flop') { this.street = 'turn'; this.board.push(this.deck.pop()); }
    else { this.street = 'river'; this.board.push(this.deck.pop()); }
    for (const p of this.players) if (!p.folded && !p.allIn) p.lastAction = '';
    this.emit(`${STREET_LABEL[this.street]}: ${this.board.map(cardStr).join(' ')}`, 'street');
    const able = this.players.filter(p => !p.folded && !p.allIn);
    if (able.length <= 1) return this.endStreet();
    this.toAct = this.findNext(this.button);
    if (this.toAct < 0) this.endStreet();
  }
  finishUncontested() {
    this.refundUncalled();
    const w = this.live()[0];
    const pot = this.pot();
    for (const p of this.players) p.bet = 0;
    w.stack += pot;
    this.emit(`${w.name} leva ${pot} (todos desistiram)`, 'win');
    this.handOver = true; this.toAct = -1;
    this.result = { showdown: false, pot, winners: [{ seat: w.seat, amount: pot }], net: this.netMap({ [w.seat]: pot }) };
  }
  showdown() {
    const live = this.live();
    const sc = {};
    for (const p of live) sc[p.seat] = evalHand([...p.hole, ...this.board]);
    const levels = [...new Set(live.map(p => p.committed))].sort((a, b) => a - b);
    const won = {}; let prev = 0;
    const order = []; for (let i = 1; i <= this.n; i++) order.push((this.button + i) % this.n);
    const pots = [];
    for (const L of levels) {
      let amt = 0;
      for (const p of this.players) amt += Math.min(p.committed, L) - Math.min(p.committed, prev);
      const elig = live.filter(p => p.committed >= L);
      pots.push({ amt, elig }); prev = L;
    }
    let left = 0; for (const p of this.players) left += Math.max(0, p.committed - prev);
    if (left) pots[pots.length - 1].amt += left;
    for (const { amt, elig } of pots) {
      if (!amt) continue;
      const best = Math.max(...elig.map(p => sc[p.seat]));
      const ws = order.filter(s => elig.some(p => p.seat === s) && sc[s] === best);
      const share = Math.floor(amt / ws.length); let rem = amt - share * ws.length;
      for (const s of ws) { const g = share + (rem > 0 ? 1 : 0); if (rem > 0) rem--; won[s] = (won[s] || 0) + g; this.players[s].stack += g; }
    }
    for (const p of live) this.emit(`${p.name} mostra ${p.hole.map(cardStr).join(' ')}: ${handName(sc[p.seat])}`, 'show');
    for (const s in won) this.emit(`${this.players[s].name} ganha ${won[s]} com ${handName(sc[s])}`, 'win');
    this.handOver = true; this.toAct = -1;
    this.result = { showdown: true, pot: this.pot(), scores: sc, winners: Object.keys(won).map(s => ({ seat: +s, amount: won[s], hand: handName(sc[s]) })), net: this.netMap(won) };
  }
  netMap(won) { const m = {}; for (const p of this.players) m[p.seat] = (won[p.seat] || 0) - p.committed; return m; }
}

// ---------- Bots ----------
const PROFILES = {
  tag:     { label: 'Sólida',      open: 7,  call: 8,  rr: 12, limp: 99, aggr: 0.7,  bluff: 0.08, margin: 0.03,  bet: 0.62, raise: 0.78, size: 0.66, noise: 1 },
  lag:     { label: 'Agressivo',   open: 6,  call: 7,  rr: 10, limp: 99, aggr: 0.85, bluff: 0.22, margin: 0.0,   bet: 0.55, raise: 0.68, size: 0.8,  noise: 2 },
  station: { label: 'Paga tudo',   open: 11, call: 4,  rr: 14, limp: 4,  aggr: 0.25, bluff: 0.03, margin: -0.12, bet: 0.72, raise: 0.88, size: 0.5,  noise: 1.5 },
  nit:     { label: 'Cautelosa',   open: 9,  call: 10, rr: 14, limp: 99, aggr: 0.6,  bluff: 0.02, margin: 0.08,  bet: 0.7,  raise: 0.84, size: 0.6,  noise: 0.5 },
  bal:     { label: 'Equilibrado', open: 7,  call: 8,  rr: 11, limp: 99, aggr: 0.65, bluff: 0.12, margin: 0.02,  bet: 0.6,  raise: 0.75, size: 0.65, noise: 1.5 },
};
const POS_BONUS = { UTG: -1, MP: -0.5, CO: 0.5, BTN: 1.5, SB: 0, BB: 0.5 };

function oppRanges(g, p) { return g.players.filter(q => q !== p && !q.folded).map(q => ({ minChen: q.minChen })); }
// Força "equivalente a mano a mano": equity contra n rivais ≈ eqHU^n
function strengthOf(eq, nOpp) { return Math.pow(Math.max(eq, 1e-6), 1 / Math.max(1, nOpp)); }

function roundChips(x, g) { return Math.max(g.bb, Math.round(x / 5) * 5); }
function sizeRaise(g, p, L, to) {
  to = Math.max(L.minTo, Math.min(L.maxTo, roundChips(to, g)));
  if (to > 0.6 * L.maxTo) to = L.maxTo;
  return { type: 'raise', to };
}

function botDecide(g, seat, rng = Math.random) {
  const p = g.players[seat], pr = p.profile, L = g.legal(seat), pos = g.posOf(seat);
  const passive = () => L.canCheck ? { type: 'check' } : { type: 'fold' };
  if (g.street === 'preflop') {
    const s = chen(p.hole[0], p.hole[1]) + (rng() - 0.5) * pr.noise + POS_BONUS[pos];
    if (g.raises === 0) {
      const limpers = g.players.filter(q => q.seat !== seat && q.bet === g.bb && g.posOf(q.seat) !== 'BB').length;
      if (s >= pr.open && L.canRaise) return sizeRaise(g, p, L, g.bb * (3 + limpers));
      if (L.canCheck) return { type: 'check' };
      if (s >= pr.limp) return { type: 'call' };
      if (['BTN', 'CO', 'SB'].includes(pos) && limpers === 0 && rng() < pr.bluff * 0.6 && L.canRaise) return sizeRaise(g, p, L, g.bb * 3);
      return { type: 'fold' };
    }
    const cost = L.toCall / Math.max(1, p.stack + p.bet);
    const needR = pr.rr + (g.raises >= 2 ? 2 : 0);
    const needC = pr.call + (g.raises >= 2 ? 2.5 : 0) + (cost > 0.25 ? 2 : 0) - (pos === 'BB' ? 1 : 0);
    if (s >= needR && L.canRaise) return sizeRaise(g, p, L, g.currentBet * (g.raises >= 2 ? 2.3 : 3));
    if (s >= needC) return { type: 'call' };
    if (g.raises === 1 && rng() < pr.bluff * 0.3 && L.canRaise) return sizeRaise(g, p, L, g.currentBet * 3);
    return passive();
  }
  const opps = oppRanges(g, p);
  const eq = equity(p.hole, g.board, opps, 300, rng);
  const st = strengthOf(eq, opps.length);
  const pot = g.pot();
  if (L.toCall === 0) {
    if (st >= pr.bet && rng() < pr.aggr + 0.2 && L.canRaise) return sizeRaise(g, p, L, pot * pr.size * (0.85 + rng() * 0.3));
    if (rng() < pr.bluff && L.canRaise && opps.length <= 2) return sizeRaise(g, p, L, pot * 0.5);
    return { type: 'check' };
  }
  const odds = L.toCall / (pot + L.toCall);
  if (st >= pr.raise && L.canRaise && rng() < pr.aggr) return sizeRaise(g, p, L, g.currentBet + Math.max(g.minRaise, (pot + L.toCall) * 0.8));
  if (eq >= odds + pr.margin) return { type: 'call' };
  if (rng() < pr.bluff * 0.35 && L.canRaise && opps.length === 1) return sizeRaise(g, p, L, g.currentBet * 2.6);
  return passive();
}

// ---------- Coach ----------
const OPEN_T = { UTG: 9, MP: 8, CO: 7, BTN: 6, SB: 7, BB: 9 };
function preflopAdvice(g, seat) {
  const p = g.players[seat], pos = g.posOf(seat), L = g.legal(seat);
  const s = chen(p.hole[0], p.hole[1]);
  const combo = comboName(p.hole[0], p.hole[1]);
  let rec, why, t;
  if (g.raises === 0) {
    t = OPEN_T[pos];
    if (L.canCheck) { rec = s >= t ? 'raise' : 'check'; why = s >= t ? `${combo} (força ${s}) é forte o bastante para aumentar do Big blind.` : `${combo} (força ${s}): passe de graça e veja o flop.`; }
    else { rec = s >= t ? 'raise' : 'fold'; why = `No ${POS_LABEL[pos]}, o padrão é abrir com força ${t} ou mais. ${combo} tem força ${s}.`; }
  } else if (g.raises === 1) {
    t = pos === 'BB' ? 7 : (pos === 'BTN' || pos === 'CO') ? 9 : 10;
    rec = s >= 12 ? 'raise' : s >= t ? 'call' : 'fold';
    why = s >= 12 ? `${combo} (força ${s}) é premium: volte a aumentar (3-bet).` : `Contra um aumento, pague com força ${t}+ nesta posição e re-aumente com 12+. ${combo} tem ${s}.`;
  } else {
    t = 12;
    rec = s >= 14 ? 'raise' : s >= 12 ? 'call' : 'fold';
    why = `Contra re-aumentos, continue só com mãos muito fortes (12+; re-aumente com 14+). ${combo} tem ${s}.`;
  }
  return { rec, why, s, t, combo, pos };
}
const ACT_PT = { fold: 'desistir', check: 'passar', call: 'pagar', raise: 'aumentar' };

function gradePreflop(adv, action, L) {
  const a = action === 'check' && !L.canCheck ? 'call' : action;
  if (a === 'fold' && L.canCheck) return { grade: 'bad', title: 'Desistiu de graça', text: 'Você podia passar sem pagar nada. Desistir nunca é melhor que passar de graça.' };
  if (a === adv.rec) return { grade: 'good', title: 'Boa decisão', text: adv.why };
  const r = adv.rec, gap = adv.s - adv.t;
  if ((r === 'raise' && a === 'call') || (r === 'call' && a === 'raise') || (r === 'check' && a === 'call')) return { grade: 'ok', title: `Aceitável; o ideal era ${ACT_PT[r]}`, text: adv.why };
  if (r === 'check' && a === 'raise') return { grade: 'ok', title: 'Aumento leve', text: adv.why };
  if (a === 'fold') return gap >= 2 ? { grade: 'bad', title: `Desistiu de mão boa; o ideal era ${ACT_PT[r]}`, text: adv.why } : { grade: 'ok', title: `Um pouco apertado; dava para ${ACT_PT[r]}`, text: adv.why };
  return adv.s >= adv.t - 1 ? { grade: 'ok', title: 'Mão no limite', text: adv.why } : { grade: 'bad', title: `Mão fraca demais: o ideal era ${ACT_PT[r]}`, text: adv.why };
}

// Projetos (draws) e outs, para o coach ensinar a regra do 2 e 4
function drawsOf(hole, board) {
  if (board.length < 3 || board.length > 4) return [];
  const all = [...hole, ...board];
  const cur = catOf(evalHand(all));
  const out = [];
  if (cur < 5) {
    const sc = [0, 0, 0, 0];
    for (const c of all) sc[suitOf(c)]++;
    for (let s = 0; s < 4; s++) if (sc[s] === 4 && hole.some(c => suitOf(c) === s)) out.push({ name: 'Projeto de flush', outs: 9 });
  }
  if (cur < 4) {
    let mask = 0; for (const c of all) mask |= 1 << rankOf(c);
    let hm = 0; for (const c of hole) hm |= 1 << rankOf(c);
    let n = 0;
    for (let r = 0; r < 13; r++) {
      if (mask & (1 << r)) continue;
      const m = mask | (1 << r);
      const h = straightHigh(m);
      if (h < 0) continue;
      // a sequência precisa usar alguma carta sua
      let bm = 0; for (const c of board) bm |= 1 << rankOf(c);
      if (straightHigh(bm | (1 << r)) === h) continue;
      n++;
    }
    if (n >= 2) out.push({ name: 'Sequência aberta', outs: 8 });
    else if (n === 1) out.push({ name: 'Gutshot (sequência por dentro)', outs: 4 });
  }
  return out;
}

function postflopInfo(g, seat, iters = 1500) {
  const p = g.players[seat], L = g.legal(seat);
  const opps = oppRanges(g, p);
  const eq = equity(p.hole, g.board, opps, iters);
  const pot = g.pot();
  const need = L.toCall > 0 ? L.toCall / (pot + L.toCall) : 0;
  return { eq, need, st: strengthOf(eq, opps.length), nOpp: opps.length, made: handName(evalHand([...p.hole, ...g.board])), draws: drawsOf(p.hole, g.board), cardsLeft: 5 - g.board.length, toCall: L.toCall, pot };
}
function postflopRec(info) {
  if (info.toCall === 0) return info.st >= 0.62 ? 'raise' : 'check';
  if (info.st >= 0.78) return 'raise';
  return info.eq >= info.need ? 'call' : 'fold';
}
const pct = x => Math.round(x * 100) + '%';
function gradePostflop(info, action, L, street) {
  const { eq, need, st } = info;
  const E = pct(eq), N = pct(need);
  const draw = street !== 'river';
  if (L.canCheck) {
    if (action === 'fold') return { grade: 'bad', title: 'Desistiu de graça', text: 'Ninguém apostou: passar não custa nada e você continua na mão.' };
    if (action === 'check') return st >= 0.75 ? { grade: 'ok', title: 'Deixou valor na mesa', text: `Sua mão é forte (${E} de equity). Apostar faz rivais com mãos piores pagarem.` } : { grade: 'good', title: 'Check razoável', text: `Com ${E} de equity, passar controla o tamanho do pote.` };
    if (st >= 0.6) return { grade: 'good', title: 'Aposta de valor', text: `Com ${E} de equity, você está à frente da maioria das mãos rivais. Apostar cobra delas.` };
    if (st < 0.35) return { grade: 'ok', title: 'Blefe', text: `Só ${E} de equity. Blefe funciona às vezes contra jogadores cautelosos, mas o “Paga tudo” quase nunca desiste.` };
    return { grade: 'ok', title: 'Aposta com mão média', text: `${E} de equity. Mãos médias muitas vezes preferem passar: quem paga sua aposta costuma ter mão melhor.` };
  }
  if (action === 'fold') {
    if (eq >= need + 0.08) return { grade: 'bad', title: 'Desistiu de mão lucrativa', text: `Você precisava de ${N} de equity para pagar e tinha ${E}. No longo prazo, pagar dá lucro.` };
    if (eq >= need - 0.03) return { grade: 'ok', title: 'Decisão no limite', text: `Precisava de ${N}, tinha ${E}. Pagar ou desistir dão resultado parecido.` };
    return { grade: 'good', title: 'Boa desistência', text: `Precisava de ${N} de equity para pagar e tinha só ${E}.` };
  }
  if (action === 'call') {
    if (eq >= need + 0.03) return { grade: 'good', title: 'Call lucrativo', text: `Precisava de ${N} e tinha ${E}. As pot odds justificam pagar.` };
    if (eq >= need - 0.07) return { grade: 'ok', title: 'Call no limite', text: `Precisava de ${N}, tinha ${E}.${draw ? ' Se acertar, você pode ganhar mais nas próximas ruas (odds implícitas).' : ''}` };
    return { grade: 'bad', title: 'Pagou caro demais', text: `Precisava de ${N} de equity e tinha ${E}. Pagar isso repetidamente perde fichas.` };
  }
  if (st >= 0.75) return { grade: 'good', title: 'Aumento por valor', text: `Com ${E} de equity, aumentar faz mãos piores colocarem mais fichas.` };
  if (eq >= need) return { grade: 'ok', title: 'Pagar já bastava', text: `Com ${E} de equity, pagar era lucrativo (precisava de ${N}). Aumentar com mão média isola você contra mãos melhores.` };
  return { grade: 'ok', title: 'Aumento como blefe', text: `Só ${E} de equity (precisava de ${N} para pagar). Blefe-aumento é arriscado; guarde para quando os rivais mostram fraqueza.` };
}

const Poker = { drawsOf, RANK_CH, SUIT_CH, rankOf, suitOf, cardStr, shuffle, evalHand, handName, catOf, chen, comboName, equity, Game, PROFILES, botDecide, preflopAdvice, gradePreflop, postflopInfo, postflopRec, gradePostflop, POS_LABEL, STREET_LABEL, strengthOf };
if (typeof module !== 'undefined') module.exports = Poker;
