// ---------- Mesa ----------
// Nomes de posição a partir do botão, conforme o número de jogadores na mesa
const POS_BY_N = { 2: ['BTN', 'BB'], 3: ['BTN', 'SB', 'BB'], 4: ['BTN', 'SB', 'BB', 'CO'], 5: ['BTN', 'SB', 'BB', 'UTG', 'CO'], 6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'] };
const POS_LABEL = { BTN: tx`Botão`, SB: 'Small blind', BB: 'Big blind', UTG: tx`UTG (primeiro)`, MP: 'Middle', CO: 'Cutoff' };
const STREET_LABEL = { preflop: tx`Pré-flop`, flop: 'Flop', turn: 'Turn', river: 'River' };

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
    this.currentBet = 0; this.minRaise = this.bb; this.raises = 0; this.pfAgg = -1; this.pfOpener = -1;
    this.deck = shuffle([...Array(52).keys()], this.rng);
    for (const p of this.players) Object.assign(p, { hole: [], bet: 0, committed: 0, folded: p.out, allIn: false, hasActed: false, actedSinceFull: false, minChen: 0, reads: [], lastAction: p.out ? tx`Fora` : '', startStack: p.stack });
    this.snaps = [];
    this.emit(tx`Mão #${this.handNo}`, 'hand');
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
    this.emit(tx`${p.name} posta ${a}`, 'blind', seat);
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
    if (this.handOver || seat !== this.toAct) throw new Error(tx`fora de vez`);
    const p = this.players[seat], L = this.legal(seat);
    let type = a.type;
    if (type === 'check' && !L.canCheck) type = 'call';
    if (type === 'call' && L.toCall === 0) type = 'check';
    if (type === 'raise' && !L.canRaise) type = L.canCheck ? 'check' : 'call';
    const prevBet = this.currentBet, potBefore = this.pot(), post = this.street !== 'preflop';
    if (post && L.toCall > 0) { p.tend.faced++; if (type === 'fold') p.tend.folded++; }
    if (type === 'fold') { p.folded = true; p.lastAction = tx`Desiste`; this.emit(tx`${p.name} desiste`, 'act', seat); }
    else if (type === 'check') { p.lastAction = tx`Passa`; this.emit(tx`${p.name} passa`, 'act', seat); }
    else if (type === 'call') {
      if (post) p.reads.push({ n: this.board.length, lv: 1, st: this.street });
      this.put(p, L.toCall); p.lastAction = p.allIn ? 'All-in' : tx`Paga ${L.toCall}`;
      this.emit(tx`${p.name} paga ${L.toCall}${p.allIn ? ' (all-in)' : ''}`, 'act', seat);
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
        if (this.raises === 0) this.pfOpener = seat;
        this.pfAgg = seat;
      }
      this.raises++;
      const verb = prevBet === 0 ? tx`aposta` : tx`aumenta para`;
      p.lastAction = p.allIn ? 'All-in' : (prevBet === 0 ? tx`Aposta ${to}` : tx`Aumenta ${to}`);
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
      if (d > 0 && this.live().length > 1) this.emit(tx`${d} devolvidos a ${top.name}`, 'info');
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
    this.emit(tx`${w.name} leva ${pot} (todos desistiram)`, 'win', w.seat);
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
    for (const p of live) this.emit(tx`${p.name} mostra ${p.hole.map(cardStr).join(' ')}: ${handName(sc[p.seat])}`, 'show', p.seat);
    for (const s in won) this.emit(tx`${this.players[s].name} ganha ${won[s]} com ${handName(sc[s])}`, 'win', +s);
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
      this.log.push({ hand: this.handNo, text: tx`${p.name} foi eliminado em ${p.place}º`, kind: 'info' });
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
