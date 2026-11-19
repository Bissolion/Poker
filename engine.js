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
  const RC = '23456789TJQKA'; // notação de poker: T = 10
  const A = RC[rankOf(a)], B = RC[rankOf(b)];
  if (rankOf(a) === rankOf(b)) return A + B;
  return A + B + (suitOf(a) === suitOf(b) ? 's' : 'o');
}

// ---------- Leitura de faixas depois do flop ----------
// Nível da mão num board parcial: 1 = ás/overcards, 1.5 = gutshot, 2 = par médio ou projeto forte,
// 2.5 = top pair/overpair, 3 = dois pares ou melhor (usando carta própria)
function handLevel(a, b, board, boardCat) {
  const cat = catOf(evalHand([a, b, ...board]));
  const top = Math.max(...board.map(rankOf)), ra = rankOf(a), rb = rankOf(b);
  let s = 0;
  if (cat > boardCat) {
    if (cat >= 2) s = 3;
    else {
      const pr = ra === rb ? ra : board.some(c => rankOf(c) === ra) ? ra : rb;
      s = pr >= top ? 2.5 : 2;
    }
  }
  if (s < 2 && board.length < 5) {
    const d = drawsOf([a, b], board);
    if (d.some(x => x.outs >= 8)) s = Math.max(s, 2); else if (d.length) s = Math.max(s, 1.5);
  }
  if (s < 1 && (ra === 12 || rb === 12 || (ra > top && rb > top))) s = 1;
  return s;
}
const BLUFF_ALLOW = 0.15; // fração das mãos que podem ser blefe/jogada fora da faixa

// ---------- Equity por Monte Carlo ----------
// opps: [{minChen, reads}] — faixa estimada pela ação pré-flop e pelas apostas/calls depois do flop
function equity(hole, board, opps, iters = 1000, rng = Math.random) {
  const used = new Set([...hole, ...board]);
  const pool = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) pool.push(c);
  const arr = pool.slice();
  let total = 0;
  const need = 5 - board.length;
  const cons = opps.map(o => (o.reads || []).filter(r => r.n <= board.length).map(r => {
    const bp = board.slice(0, r.n);
    return { bp, lv: r.lv, bc: catOf(evalHand(bp)) };
  }));
  for (let it = 0; it < iters; it++) {
    let end = arr.length;
    const draw = () => { const i = Math.floor(rng() * end); const c = arr[i]; arr[i] = arr[end - 1]; arr[end - 1] = c; end--; return c; };
    const oh = [];
    for (let k = 0; k < opps.length; k++) {
      const o = opps[k], cs = cons[k];
      let a, b, tries = 0;
      for (;;) {
        a = draw(); b = draw();
        if (tries++ > 30) break;
        if (o.minChen && chen(a, b) < o.minChen) { end += 2; continue; }
        if (cs.length && rng() >= BLUFF_ALLOW && cs.some(r => handLevel(a, b, r.bp, r.bc) < r.lv)) { end += 2; continue; }
        break;
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
// Nomes de posição a partir do botão, conforme o número de jogadores na mesa
const POS_BY_N = { 2: ['BTN', 'BB'], 3: ['BTN', 'SB', 'BB'], 4: ['BTN', 'SB', 'BB', 'CO'], 5: ['BTN', 'SB', 'BB', 'UTG', 'CO'], 6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'] };
const POS_LABEL = { BTN: 'Botão', SB: 'Small blind', BB: 'Big blind', UTG: 'UTG (primeiro)', MP: 'Middle', CO: 'Cutoff' };
const STREET_LABEL = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' };

class Game {
  constructor(players, opts = {}) {
    this.sb = opts.sb || 5; this.bb = opts.bb || 10;
    this.rng = opts.rng || Math.random;
    this.skill = opts.skill || 'normal';
    this.players = players.map((p, i) => Object.assign({ seat: i, stack: opts.stack || 1000, hole: [], bet: 0, committed: 0, folded: false, allIn: false, out: false, hasActed: false, actedSinceFull: false, minChen: 0, lastAction: '', tend: { faced: 0, folded: 0 } }, p));
    this.n = this.players.length;
    this.button = Math.floor(this.rng() * this.n);
    this.handNo = 0;
    this.log = [];
  }
  // Próximo lugar ocupado (pula eliminados)
  next(seat) {
    let s = seat;
    for (let i = 0; i < this.n; i++) { s = (s + 1) % this.n; if (!this.players[s].out) return s; }
    return seat;
  }
  activeCount() { return this.players.filter(p => !p.out).length; }
  posOf(seat) {
    if (this.players[seat].out) return '';
    const order = []; let s = this.button;
    do { order.push(s); s = this.next(s); } while (s !== this.button && order.length <= this.n);
    return (POS_BY_N[order.length] || POS_BY_N[6])[order.indexOf(seat)];
  }
  emit(text, kind = 'act', seat = -1) {
    this.log.push({ hand: this.handNo, text, kind });
    // fotografia da mesa a cada evento, para o replay
    if (this.snaps) this.snaps.push({ t: text, k: kind, seat, st: this.street, b: (this.board || []).slice(), pot: this.potCollected(),
      p: this.players.map(p => [p.stack, p.bet, p.folded ? 1 : 0, p.allIn ? 1 : 0, p.lastAction, p.out ? 1 : 0]) });
  }

  startHand() {
    this.handNo++;
    this.button = this.next(this.button);
    this.board = []; this.street = 'preflop'; this.handOver = false; this.result = null;
    this.currentBet = 0; this.minRaise = this.bb; this.raises = 0; this.pfAgg = -1;
    this.deck = shuffle([...Array(52).keys()], this.rng);
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, committed: 0, folded: p.out, allIn: false, hasActed: false, actedSinceFull: false, minChen: 0, reads: [], lastAction: p.out ? 'Fora' : '', startStack: p.stack });
    this.snaps = [];
    this.emit(`Mão #${this.handNo}`, 'hand');
    for (let k = 0; k < 2; k++) for (let i = 1; i <= this.n; i++) { const q = this.players[(this.button + i) % this.n]; if (!q.out) q.hole.push(this.deck.pop()); }
    // No heads-up o botão posta o small blind e age primeiro antes do flop
    const sbS = this.activeCount() === 2 ? this.button : this.next(this.button), bbS = this.next(sbS);
    this.post(sbS, this.sb); this.post(bbS, this.bb);
    this.currentBet = Math.max(this.players[sbS].bet, this.players[bbS].bet, this.bb);
    this.toAct = this.findNext(bbS);
    if (this.toAct < 0) this.endStreet();
  }
  post(seat, amt) {
    const p = this.players[seat]; const a = Math.min(amt, p.stack);
    p.stack -= a; p.bet += a; p.committed += a; if (p.stack === 0) p.allIn = true;
    this.emit(`${p.name} posta ${a}`, 'blind', seat);
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
    const prevBet = this.currentBet, potBefore = this.pot(), post = this.street !== 'preflop';
    if (post && L.toCall > 0) { p.tend.faced++; if (type === 'fold') p.tend.folded++; }
    if (type === 'fold') { p.folded = true; p.lastAction = 'Desiste'; this.emit(`${p.name} desiste`, 'act', seat); }
    else if (type === 'check') { p.lastAction = 'Passa'; this.emit(`${p.name} passa`, 'act', seat); }
    else if (type === 'call') {
      if (post) p.reads.push({ n: this.board.length, lv: 1, st: this.street });
      this.put(p, L.toCall); p.lastAction = p.allIn ? 'All-in' : `Paga ${L.toCall}`;
      this.emit(`${p.name} paga ${L.toCall}${p.allIn ? ' (all-in)' : ''}`, 'act', seat);
      if (this.street === 'preflop' && prevBet > this.bb) p.minChen = Math.max(p.minChen, this.raises >= 2 ? 9 : 5);
    } else {
      let to = Math.round(Math.max(L.minTo, Math.min(a.to || L.minTo, L.maxTo)));
      // aposta grande (perto do pote) ou aumento sobre aposta estreitam mais a faixa
      if (post) p.reads.push({ n: this.board.length, lv: prevBet > 0 || to >= potBefore * 0.9 ? 2.5 : 2, st: this.street, raise: prevBet > 0 });
      this.put(p, to - p.bet);
      const size = to - this.currentBet;
      if (size >= this.minRaise) { this.minRaise = size; for (const q of this.players) if (q !== p) q.actedSinceFull = false; }
      if (to > this.currentBet) { this.currentBet = to; for (const q of this.players) if (q !== p) q.hasActed = false; }
      if (this.street === 'preflop') {
        // all-in de stack curto não indica mão premium: a faixa de quem empurra 8 BB é larga
        const shortShove = p.allIn && to <= 12 * this.bb;
        p.minChen = Math.max(p.minChen, shortShove ? (this.raises === 0 ? 4 : 7) : this.raises === 0 ? 7 : this.raises === 1 ? 10 : 12);
        this.pfAgg = seat;
      }
      this.raises++;
      const verb = prevBet === 0 ? 'aposta' : 'aumenta para';
      p.lastAction = p.allIn ? 'All-in' : (prevBet === 0 ? `Aposta ${to}` : `Aumenta ${to}`);
      this.emit(`${p.name} ${verb} ${to}${p.allIn ? ' (all-in)' : ''}`, 'act', seat);
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
    this.emit(`${w.name} leva ${pot} (todos desistiram)`, 'win', w.seat);
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
    for (const p of live) this.emit(`${p.name} mostra ${p.hole.map(cardStr).join(' ')}: ${handName(sc[p.seat])}`, 'show', p.seat);
    for (const s in won) this.emit(`${this.players[s].name} ganha ${won[s]} com ${handName(sc[s])}`, 'win', +s);
    this.handOver = true; this.toAct = -1;
    this.result = { showdown: true, pot: this.pot(), scores: sc, winners: Object.keys(won).map(s => ({ seat: +s, amount: won[s], hand: handName(sc[s]) })), net: this.netMap(won) };
  }
  netMap(won) { const m = {}; for (const p of this.players) m[p.seat] = (won[p.seat] || 0) - p.committed; return m; }
  // Torneio: quem zerou sai. Entre eliminados na mesma mão, quem começou com mais fichas fica melhor colocado.
  eliminateBusted() {
    const busted = this.players.filter(p => !p.out && p.stack === 0).sort((a, b) => b.startStack - a.startStack);
    const remaining = this.activeCount();
    busted.forEach((p, i) => {
      p.out = true; p.place = remaining - busted.length + 1 + i;
      this.log.push({ hand: this.handNo, text: `${p.name} foi eliminado em ${p.place}º`, kind: 'info' });
    });
    return busted;
  }
}

// Torneio: estrutura de blinds
const BLIND_LEVELS = [[10, 20], [15, 30], [25, 50], [40, 80], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [400, 800], [600, 1200], [1000, 2000], [1500, 3000]];
function blindLevel(handsPlayed, perLevel) { return Math.min(BLIND_LEVELS.length - 1, Math.floor(handsPlayed / perLevel)); }

// Equity com todas as cartas conhecidas (para mostrar no all-in). Exata a partir do flop.
function equityKnown(hands, board, iters = 3000, rng = Math.random) {
  const used = new Set([...hands.flat(), ...board]);
  const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  const share = hands.map(() => 0); let n = 0;
  const score = full => {
    const sc = hands.map(h => evalHand([...h, ...full]));
    const best = Math.max(...sc), w = sc.filter(x => x === best).length;
    sc.forEach((x, i) => { if (x === best) share[i] += 1 / w; });
    n++;
  };
  const need = 5 - board.length;
  if (need === 0) score(board);
  else if (need === 1) for (const c of rest) score([...board, c]);
  else if (need === 2) { for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) score([...board, rest[i], rest[j]]); }
  else {
    const arr = rest.slice();
    for (let it = 0; it < iters; it++) {
      for (let k = 0; k < need; k++) { const j = k + Math.floor(rng() * (arr.length - k)); const t = arr[k]; arr[k] = arr[j]; arr[j] = t; }
      score([...board, ...arr.slice(0, need)]);
    }
  }
  return share.map(x => x / n);
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
    const raw = chen(p.hole[0], p.hole[1]) + (rng() - 0.5) * pr.noise * sk.noise;
    const depth = effBB(g, seat);
    if (depth <= PUSH_DEPTH) {
      if (g.raises === 0) return raw >= pushThreshold(depth, pos, nAct) + (pr.open - 7) * 0.5 ? shove() : passive();
      return raw >= callShoveThreshold(depth, nAct) + (pr.call - 8) * 0.4 ? shove() : passive();
    }
    const widen = nAct === 2 ? 2.5 : nAct <= 4 ? 1 : 0;
    const s = raw + (POS_BONUS[pos] || 0) + widen;
    if (g.raises === 0) {
      const limpers = g.players.filter(q => q.seat !== seat && !q.folded && q.bet === g.bb && g.posOf(q.seat) !== 'BB').length;
      const open = nAct === 2 ? 2.5 : 3 + limpers;
      if (s >= pr.open && L.canRaise) return sizeRaise(g, p, L, g.bb * open);
      if (L.canCheck) return { type: 'check' };
      if (s >= pr.limp) return { type: 'call' };
      if (['BTN', 'CO', 'SB'].includes(pos) && limpers === 0 && rng() < pr.bluff * sk.bluff * 0.6 && L.canRaise) return sizeRaise(g, p, L, g.bb * open);
      return { type: 'fold' };
    }
    const cost = L.toCall / Math.max(1, p.stack + p.bet);
    const needR = pr.rr + (g.raises >= 2 ? 2 : 0);
    const needC = pr.call + (g.raises >= 2 ? 2.5 : 0) + (cost > 0.25 ? 2 : 0) - (pos === 'BB' ? 1 : 0);
    if (s >= needR && L.canRaise) return sizeRaise(g, p, L, g.currentBet * (g.raises >= 2 ? 2.3 : 3));
    if (s >= needC) return { type: 'call' };
    if (g.raises === 1 && rng() < pr.bluff * sk.bluff * 0.3 && L.canRaise) return sizeRaise(g, p, L, g.currentBet * 3);
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

// ---------- Coach ----------
const OPEN_T = { UTG: 9, MP: 8, CO: 7, BTN: 6, SB: 7, BB: 9 };
// Regra pré-flop única, usada pelo coach e pela grade de faixas.
// t = força mínima para continuar; rr = força mínima para (re)aumentar
function preflopRule(s, pos, raises, canCheck, nAct = 6) {
  let rec, t, rr;
  if (raises === 0) {
    t = nAct === 2 ? (pos === 'BTN' ? 3 : 8) : OPEN_T[pos] - (nAct <= 3 ? 1 : 0);
    rr = t; rec = s >= t ? 'raise' : canCheck ? 'check' : 'fold';
  } else if (raises === 1) {
    if (nAct === 2) { t = 4; rr = 10; }
    else { t = pos === 'BB' ? 7 : (pos === 'BTN' || pos === 'CO') ? 9 : 10; rr = 12; }
    rec = s >= rr ? 'raise' : s >= t ? 'call' : 'fold';
  } else {
    if (nAct === 2) { t = 9; rr = 12; } else { t = 12; rr = 14; }
    rec = s >= rr ? 'raise' : s >= t ? 'call' : 'fold';
  }
  return { rec, t, rr };
}
function preflopAdvice(g, seat) {
  const p = g.players[seat], pos = g.posOf(seat), L = g.legal(seat), nAct = g.activeCount();
  const s = chen(p.hole[0], p.hole[1]);
  const combo = comboName(p.hole[0], p.hole[1]);
  const depth = effBB(g, seat);
  const D = Math.round(depth * 10) / 10;
  if (depth <= PUSH_DEPTH) {
    // Stack curto: all-in ou desistir
    let t, rec, why;
    const Ds = D.toString().replace('.', ',');
    if (g.raises === 0) {
      t = pushThreshold(depth, pos, nAct);
      rec = s >= t ? 'raise' : L.canCheck ? 'check' : 'fold';
      why = `Com ${Ds} BB, a jogada é all-in ou desistir: um aumento normal compromete quase tudo sem tirar ninguém da mão. Nesta posição, vá all-in com força ${t}+. ${combo} tem ${s}.`;
    } else {
      t = callShoveThreshold(depth, nAct);
      rec = s >= t ? (L.canRaise ? 'raise' : 'call') : 'fold';
      why = `Com ${Ds} BB contra um aumento, só continue all-in com força ${t}+. ${combo} tem ${s}.`;
    }
    return { rec, why, s, t, combo, pos, push: true, depth: D };
  }
  const { rec, t, rr } = preflopRule(s, pos, g.raises, L.canCheck, nAct);
  const hu = nAct === 2 ? ' No heads-up as faixas são bem mais largas: contra um rival só, mãos medianas ganham valor.' : '';
  let why;
  if (g.raises === 0) {
    if (L.canCheck) why = s >= t ? `${combo} (força ${s}) é forte o bastante para aumentar do Big blind.` : `${combo} (força ${s}): passe de graça e veja o flop.`;
    else why = `No ${POS_LABEL[pos]}, o padrão é abrir com força ${t} ou mais. ${combo} tem força ${s}.${hu}`;
  } else if (g.raises === 1) {
    why = s >= rr ? `${combo} (força ${s}) é forte: volte a aumentar (3-bet).` : `Contra um aumento, pague com força ${t}+ nesta posição e re-aumente com ${rr}+. ${combo} tem ${s}.${hu}`;
  } else {
    why = `Contra re-aumentos, continue só com mãos muito fortes (${t}+; re-aumente com ${rr}+). ${combo} tem ${s}.`;
  }
  return { rec, why, s, t, combo, pos, depth: D };
}

// O que a ação de cada rival diz sobre a mão dele (texto para o coach)
const LV_TXT = { 1: 'algo no board, ás ou cartas altas', 1.5: 'pelo menos um projeto', 2: 'um par ou projeto forte', 2.5: 'top pair ou melhor (ou blefe)' };
const ST_PT = { flop: 'no flop', turn: 'no turn', river: 'no river' };
function readNote(q) {
  const parts = [];
  if (q.minChen >= 12) parts.push('re-aumentou antes do flop');
  else if (q.minChen >= 10) parts.push('fez 3-bet antes do flop');
  else if (q.minChen >= 9) parts.push('pagou um re-aumento');
  else if (q.minChen >= 7) parts.push('aumentou antes do flop');
  else if (q.minChen >= 5) parts.push('pagou um aumento');
  for (const r of q.reads || []) parts.push(`${r.lv === 1 ? 'pagou' : r.raise ? 'aumentou' : r.lv >= 2.5 ? 'apostou forte' : 'apostou'} ${ST_PT[r.st]}`);
  if (!parts.length) return null;
  const top = Math.max(0, ...(q.reads || []).map(r => r.lv));
  const range = top ? LV_TXT[top] : q.minChen >= 10 ? 'mãos premium' : q.minChen >= 7 ? 'mãos boas' : 'mãos jogáveis';
  return { name: q.name, text: parts.join(', '), range };
}

// ---------- Tamanho da aposta ----------
function boardWet(board) {
  if (board.length < 3 || board.length >= 5) return false;
  const sc = [0, 0, 0, 0];
  for (const c of board) sc[suitOf(c)]++;
  if (Math.max(...sc) >= 2) return true;
  const rs = [...new Set(board.map(rankOf))].sort((a, b) => a - b);
  for (let i = 0; i + 2 < rs.length; i++) if (rs[i + 2] - rs[i] <= 4) return true;
  return false;
}
// c: {street, raises, to, currentBet, pot, toCall, isBet, bb, limpers, maxTo, st, draws, board}
function gradeSizing(c) {
  const P = x => Math.round(x * 100) + '%';
  if (c.street === 'preflop') {
    if (c.stackBB && c.stackBB <= PUSH_DEPTH && c.to < c.maxTo) return { grade: 'ok', text: `Com ${Math.round(c.stackBB)} BB, prefira all-in: um aumento menor te deixa preso no pote sem tirar ninguém da mão.` };
    if (c.stackBB && c.stackBB <= PUSH_DEPTH) return { grade: 'good', text: `All-in com ${Math.round(c.stackBB)} BB: o tamanho certo para stack curto.` };
    if (c.raises === 0) {
      const x = c.to / c.bb, std = c.nAct === 2 ? 2.5 : 3 + c.limpers;
      const stdTxt = std.toString().replace('.', ',');
      if (c.to >= c.maxTo && x > 25) return { grade: 'ok', text: `All-in de ${Math.round(x)} BB para roubar ${c.bb * 1.5} fichas: arrisca muito para ganhar pouco. O padrão é ${stdTxt} BB.` };
      if (x < (c.nAct === 2 ? 1.9 : 2.2)) return { grade: 'ok', text: `Aumento mínimo dá ótimas odds para pagarem. O padrão é ${stdTxt} BB${c.limpers ? ` (3 BB + 1 por limper)` : ''}.` };
      if (x > std + 2.5) return { grade: 'ok', text: `${Math.round(x)} BB é grande demais: só mãos fortes continuam. O padrão é ${stdTxt} BB.` };
      return { grade: 'good', text: `${(Math.round(x * 2) / 2).toString().replace('.', ',')} BB é um tamanho padrão de abertura.` };
    }
    const x = c.to / c.currentBet;
    if (x < 2.2) return { grade: 'ok', text: `Re-aumento pequeno (${x.toFixed(1).replace('.', ',')}×) dá odds boas para pagar. Use cerca de 3×.` };
    if (x > 4.5 && c.to < c.maxTo) return { grade: 'ok', text: `Re-aumento de ${x.toFixed(1).replace('.', ',')}× é grande demais: só mãos melhores continuam. Use cerca de 3×.` };
    return { grade: 'good', text: `Re-aumento de ${x.toFixed(1).replace('.', ',')}×, tamanho padrão.` };
  }
  const frac = c.isBet ? c.to / c.pot : (c.to - c.currentBet) / (c.pot + c.toCall);
  const F = P(frac) + (c.isBet ? ' do pote' : ' do pote no aumento');
  const wet = boardWet(c.board);
  const semi = c.st < 0.6 && c.draws && c.draws.some(d => d.outs >= 8);
  if (c.st >= 0.6) {
    if (frac < 0.33) return { grade: 'ok', text: `Aposta de ${F} é pequena para mão forte: mãos piores pagariam mais.${wet ? ' E projetos pagam barato para tentar te passar.' : ''}` };
    if (wet && frac < 0.5) return { grade: 'ok', text: `Aposta de ${F} protege pouco: o board tem projetos possíveis. Aposte pelo menos meio pote para cobrar caro deles.` };
    if (frac > 1.3 && c.st < 0.85) return { grade: 'ok', text: `Aposta de ${F} é grande demais para esta mão: só mãos melhores pagam.` };
    return { grade: 'good', text: `Aposta de ${F}: bom tamanho para valor${wet ? ' e proteção' : ''}.` };
  }
  if (semi) {
    if (frac < 0.4) return { grade: 'ok', text: `Semi-blefe de ${F} é barato de pagar. Apostando mais, você ganha mais vezes na hora e ainda tem outs.` };
    if (frac > 1.2) return { grade: 'ok', text: `Semi-blefe de ${F} arrisca muito; 50–80% do pote costuma bastar.` };
    return { grade: 'good', text: `Semi-blefe de ${F}: bom tamanho. Você ganha se eles desistirem ou se completar o projeto.` };
  }
  if (c.st < 0.35) {
    if (frac > 1.1) return { grade: 'ok', text: `Blefe de ${F} é caro: se der errado, perde muito. 40–75% do pote costuma bastar.` };
    if (frac < 0.3) return { grade: 'ok', text: `Blefe de ${F} é barato demais: fica fácil pagar.` };
    return { grade: 'good', text: `Tamanho razoável para blefe (${F}).` };
  }
  if (frac > 0.9) return { grade: 'ok', text: `Aposta de ${F} com mão média: só mãos melhores continuam. Prefira 33–60% do pote.` };
  return { grade: 'good', text: `Aposta de ${F}: tamanho moderado, adequado para mão média.` };
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
  return { eq, need, st: strengthOf(eq, opps.length), nOpp: opps.length, made: handName(evalHand([...p.hole, ...g.board])), notes: g.players.filter(q => q !== p && !q.folded).map(readNote).filter(Boolean), draws: drawsOf(p.hole, g.board), cardsLeft: 5 - g.board.length, toCall: L.toCall, pot };
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

// ---------- Quiz ----------
const CAT_PT = ['carta alta', 'par', 'dois pares', 'trinca', 'sequência', 'flush', 'full house', 'quadra', 'straight flush'];
const pickOf = (a, rng) => a[Math.floor(rng() * a.length)];
function choices(correct, pool, rng, n = 4, minGap = 1) {
  const out = [correct];
  for (const x of shuffle(pool.slice(), rng)) {
    if (out.length >= n) break;
    if (out.every(y => Math.abs(y - x) >= minGap)) out.push(x);
  }
  return shuffle(out, rng);
}
// Melhores 5 cartas (para destacar na explicação)
function best5(cards) {
  let best = -1, bc = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    if (n === 6 && b !== n - 1) continue;
    const sc = evalHand(n === 5 ? cards : five);
    if (sc > best) { best = sc; bc = n === 5 ? cards.slice() : five; }
  }
  return bc;
}

function quizPotOdds(rng = Math.random) {
  const pot = pickOf([60, 80, 100, 120, 150, 200, 240, 300, 400, 500], rng);
  const fr = pickOf([[1 / 3, '⅓ do pote', 'de ⅓ do pote'], [1 / 2, 'meio pote', 'de meio pote'], [2 / 3, '⅔ do pote', 'de ⅔ do pote'], [3 / 4, '¾ do pote', 'de ¾ do pote'], [1, 'o pote inteiro', 'do tamanho do pote'], [2, 'o dobro do pote', 'do dobro do pote']], rng);
  const bet = Math.max(5, Math.round(pot * fr[0] / 5) * 5);
  const total = pot + 2 * bet, need = Math.round(bet / total * 100);
  const how = `Você paga ${bet} para disputar um pote final de ${total} (${pot} + ${bet} do rival + ${bet} seu): ${bet} ÷ ${total} = ${need}%.`;
  if (rng() < 0.55) {
    const pool = [Math.round(bet / pot * 100), Math.round(bet / (pot + bet) * 100), need + 10, need - 8, need + 17, Math.round(need / 2), need + 5].filter(x => x > 2 && x < 98 && x !== need);
    const opts = choices(need, pool, rng, 4, 3);
    return { type: 'pot', prompt: `O pote tem ${pot}. O rival aposta ${bet} (${fr[1]}). Qual a equity mínima para pagar?`,
      options: opts.map(x => x + '%'), answer: opts.indexOf(need),
      explain: `${how} Atalho: contra uma aposta ${fr[2]}, você precisa de cerca de ${need}%.${bet < pot ? ` Erro comum: dividir a aposta só pelo pote (${Math.round(bet / pot * 100)}%).` : ''}` };
  }
  let eq = need + pickOf([-16, -11, -7, 7, 11, 16], rng);
  eq = Math.max(4, Math.min(95, eq));
  const ok = eq >= need;
  return { type: 'pot', prompt: `O pote tem ${pot} e o rival aposta ${bet} (${fr[1]}). Sua equity é ${eq}%. Pagar é lucrativo?`,
    options: ['Pagar: é lucrativo', 'Desistir: não compensa'], answer: ok ? 0 : 1,
    explain: `${how} Você tem ${eq}%, ${ok ? 'mais' : 'menos'} do que precisa: ${ok ? 'pagar ganha fichas no longo prazo' : 'pagar perde fichas no longo prazo'}.` };
}

// Cartas que completam flush ou sequência usando suas cartas
function outsSets(hole, board) {
  const all = [...hole, ...board], used = new Set(all);
  const mask = cs => { let m = 0; for (const c of cs) m |= 1 << rankOf(c); return m; };
  const flush = cs => { const sc = [0, 0, 0, 0]; for (const c of cs) sc[suitOf(c)]++; return Math.max(...sc) >= 5; };
  const F = [], S = [];
  for (let c = 0; c < 52; c++) {
    if (used.has(c)) continue;
    const na = [...all, c], nb = [...board, c];
    if (flush(na) && !flush(nb)) F.push(c);
    if (straightHigh(mask(na)) >= 0 && straightHigh(mask(nb)) < 0) S.push(c);
  }
  return { F, S, all: [...new Set([...F, ...S])] };
}
function quizOuts(rng = Math.random) {
  for (let tries = 0; tries < 2000; tries++) {
    const d = shuffle([...Array(52).keys()], rng);
    const hole = [d[0], d[1]], board = d.slice(2, 2 + (rng() < 0.65 ? 3 : 4));
    const cur = catOf(evalHand([...hole, ...board]));
    if (cur >= 4) continue;
    if (new Set(board.map(rankOf)).size < board.length) continue; // sem par na mesa
    const o = outsSets(hole, board), n = o.all.length;
    if (n < 4 || n > 15) continue;
    const left = 5 - board.length, unseen = 52 - 2 - board.length;
    const approx = n * (left === 2 ? 4 : 2);
    const exact = Math.round((left === 2 ? 1 - ((unseen - n) * (unseen - n - 1)) / (unseen * (unseen - 1)) : n / unseen) * 100);
    const parts = [];
    if (o.F.length) parts.push(`Flush: ${o.F.length} cartas de ${SUIT_CH[suitOf(o.F[0])]}.`);
    if (o.S.length) {
      const rs = [...new Set(o.S.map(rankOf))].sort((a, b) => b - a).map(r => RANK_CH[r]);
      parts.push(`Sequência: ${o.S.length} cartas (qualquer ${rs.join(' ou ')}).`);
    }
    const overlap = o.F.length + o.S.length - n;
    const opts = choices(n, [n - 1, n + 1, n - 3, n + 3, 4, 8, 9, 12, 15, n + 2].filter(x => x > 0 && x !== n), rng, 4, 1);
    return { type: 'outs', hole, board, prompt: `Quantos outs você tem para completar sequência ou flush?`,
      options: opts.map(String), answer: opts.indexOf(n),
      explain: `${parts.join(' ')}${overlap ? ` ${overlap} ${overlap > 1 ? 'cartas contam' : 'carta conta'} nas duas, então o total é ${n}.` : ''} Regra do 2 e 4: ${n} × ${left === 2 ? 4 : 2} ≈ ${approx}% de completar ${left === 2 ? 'até o river' : 'no river'} (exato: ${exact}%).` };
  }
  return quizPotOdds(rng);
}

const ORD = ['1ª', '2ª', '3ª', '4ª', '5ª'];
function kickDesc(cat, i) {
  switch (cat) {
    case 1: return i === 0 ? 'o par maior' : 'o kicker (carta lateral)';
    case 2: return i === 0 ? 'o par mais alto' : i === 1 ? 'o segundo par' : 'o kicker (carta lateral)';
    case 3: return i === 0 ? 'a trinca maior' : 'o kicker (carta lateral)';
    case 4: case 8: return 'a carta mais alta da sequência';
    case 6: return i === 0 ? 'a trinca do full house' : 'o par do full house';
    case 7: return i === 0 ? 'a quadra' : 'o kicker';
    default: return `a ${ORD[i]} carta mais alta`;
  }
}
function quizWinner(rng = Math.random) {
  for (let tries = 0; tries < 3000; tries++) {
    const d = shuffle([...Array(52).keys()], rng);
    const board = d.slice(0, 5), A = [d[5], d[6]], B = [d[7], d[8]];
    const sa = evalHand([...A, ...board]), sb = evalHand([...B, ...board]);
    const ca = catOf(sa), cb = catOf(sb);
    if (ca < 1 || cb < 1 || Math.abs(ca - cb) > 1) continue;
    if (ca !== cb && rng() < 0.6) continue; // prefere desempates na mesma categoria
    const answer = sa > sb ? 0 : sb > sa ? 1 : 2;
    let why;
    if (ca !== cb) why = `${CAT_PT[Math.max(ca, cb)][0].toUpperCase() + CAT_PT[Math.max(ca, cb)].slice(1)} vence ${CAT_PT[Math.min(ca, cb)]}.`;
    else if (answer === 2) why = `As duas formam a mesma melhor combinação de 5 cartas, então dividem o pote. Só as 5 melhores cartas contam.`;
    else {
      let i = 0; while (kOf(sa, i) === kOf(sb, i)) i++;
      why = `Mesma categoria (${CAT_PT[ca]}): desempata ${kickDesc(ca, i)}, ${RANK_CH[kOf(sa, i)]} contra ${RANK_CH[kOf(sb, i)]}.`;
    }
    return { type: 'win', board, hands: [A, B], best: [best5([...A, ...board]), best5([...B, ...board])],
      prompt: 'Qual mão ganha?', options: ['Mão A', 'Mão B', 'Empate'], answer,
      explain: `A: ${handName(sa)}. B: ${handName(sb)}. ${why}` };
  }
  return quizPotOdds(rng);
}

const Poker = { SKILLS, effBB, pushThreshold, callShoveThreshold, PUSH_DEPTH, BLIND_LEVELS, blindLevel, equityKnown, POS_BY_N, quizPotOdds, quizOuts, quizWinner, outsSets, best5, CAT_PT, drawsOf, handLevel, preflopRule, readNote, gradeSizing, boardWet, OPEN_T, RANK_CH, SUIT_CH, rankOf, suitOf, cardStr, shuffle, evalHand, handName, catOf, chen, comboName, equity, Game, PROFILES, botDecide, preflopAdvice, gradePreflop, postflopInfo, postflopRec, gradePostflop, POS_LABEL, STREET_LABEL, strengthOf };
if (typeof module !== 'undefined') module.exports = Poker;
