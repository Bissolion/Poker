// ---- jogo ----
let game = null, tour = null, gameId = 0;
const handKey = () => `${gameId}:${game.handNo}`;
let decision = null, handFb = [], flags = {}, loopId = 0, counted = false, raiseTo = 0;
let runout = null, anim = null, lastOut = [], strOpen = false, readCache = { key: '' };
let studyTab = 'hands', replay = null, rangeSt = { pos: null, scn: 'open', sel: null, hu: null, opener: null, depth: 10 };
let handFilter = null;
let quiz = { cat: 'mix', q: null, picked: null };

function newGame(c) {
  cfg = { ...c }; saveCfg();
  gameId = Date.now();
  const roster = c.table === 'hu' ? [BOTS.find(b => b.k === c.rival) || BOTS[1]] : BOTS;
  const tourney = c.format === 'tourney';
  game = new E.Game([{ name: 'Você', isHuman: true }, ...roster.map(b => ({ name: b.name, profile: E.PROFILES[b.k] }))],
    { stack: tourney ? 1500 : 1000, skill: c.skill, sb: tourney ? E.BLIND_LEVELS[0][0] : 5, bb: tourney ? E.BLIND_LEVELS[0][1] : 10 });
  const payouts = tourney ? E.PAYOUTS[c.table === 'hu' ? 'vencedor' : (c.prize || '65/35')] : null;
  if (payouts) game.payouts = payouts;
  tour = tourney ? { per: c.per, hands: 0, level: 0, over: false, place: null, n: game.n, flash: false, payouts } : null;
  replay = null; lastOut = []; rangeSt.hu = null;
  nextHand();
}

// ---- cartas ----
const card = (c, size, extra = '') => `<div class="card ${size} su${E.suitOf(c)} ${extra}" aria-label="${E.cardStr(c)}"><span class="r">${E.RANK_CH[E.rankOf(c)]}</span><span class="s">${SYM[E.suitOf(c)]}</span></div>`;
const back = size => `<div class="card ${size} back" aria-hidden="true"></div>`;
const slot = () => `<div class="card md slot" aria-hidden="true"></div>`;
const pct = x => Math.round(x * 100) + '%';
const signed = n => (n > 0 ? '+' : '') + n;
const ordinal = n => n + 'º';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---- mesa (compartilhada entre jogo e replay) ----
const SLOTS = { 2: ['p3'], 6: ['p1', 'p2', 'p3', 'p4', 'p5'] };
function tableHTML(v, heroSize) {
  let html = '<div class="felt"></div>';
  const slots = SLOTS[v.seats.length] || SLOTS[6];
  for (let i = 1; i < v.seats.length; i++) {
    const s = v.seats[i];
    const cards = s.mode === 'none' ? '' : s.mode === 'up' ? s.hole.map(c => card(c, 'sm', (v.hl.has(c) && s.win ? 'hl' : '') + (s.flip ? ' flip' : ''))).join('') : back('sm') + back('sm');
    html += `<div class="seat ${slots[i - 1]}${s.out ? ' out' : s.folded ? ' folded' : ''}${s.turn ? ' turn' : ''}${s.win ? ' win' : ''}">
      <div class="cards">${cards}</div>
      <div class="plate">
        <div class="nm">${s.name}${s.pos ? ` <span class="pos${s.pos === 'BTN' ? ' btn' : ''}">${s.pos}</span>` : ''}</div>
        <div class="sty">${s.label}</div>
        <div class="stk">${s.out ? '–' : s.stack}</div>
      </div>
      <div class="tag${s.allIn ? ' allin' : ''}${s.eq != null ? ' eq' : ''}">${s.eq != null ? pct(s.eq) : s.tag || ''}</div>
      ${s.bet ? `<div class="bet">${s.bet}</div>` : ''}
    </div>`;
  }
  const mk = c => v.made && v.made.has(c) ? 'made' : '';
  let b = v.board.map((c, k) => card(c, 'md', (v.hl.has(c) ? 'hl' : mk(c)) + (v.newFrom != null && k >= v.newFrom ? ' flip' : ''))).join('');
  for (let k = v.board.length; k < 5; k++) b += slot();
  html += `<div class="center">
    ${v.pot ? `<div class="potline">Pote <span>${v.pot}</span></div>` : ''}
    <div class="board">${b}</div>
    <div class="street">${v.street}</div>
  </div>`;
  const h = v.seats[0];
  html += `<div class="hero${h.folded && !h.out ? ' folded' : ''}${h.turn ? ' turn' : ''}${h.win ? ' win' : ''}">
    ${h.bet ? `<div class="bet">${h.bet}</div>` : ''}
    <div class="cards">${h.hole.map(c => card(c, heroSize, v.hl.has(c) && h.win ? 'hl' : mk(c))).join('')}</div>
    <div class="plate"><span class="nm">Você${h.pos ? ` <span class="pos${h.pos === 'BTN' ? ' btn' : ''}">${h.pos}</span>` : ''}</span><span class="stk">${h.stack}</span></div>
    <div class="tag${h.allIn ? ' allin' : ''}${h.eq != null ? ' eq' : ''}">${h.eq != null ? pct(h.eq) : h.tag || ''}</div>
  </div>`;
  return html;
}
function winningCards() {
  const r = game.result; if (!r || !r.showdown || anim) return new Set();
  return new Set(r.winners.flatMap(w => game.players[w.seat].hole));
}
function liveView() {
  const g = game, r = anim ? null : g.result, winners = new Set(r ? r.winners.map(w => w.seat) : []);
  const eqBy = {}; if (anim && anim.eq) anim.live.forEach((s, k) => eqBy[s] = anim.eq[k]);
  const seats = g.players.map((p, i) => ({
    name: p.name, label: p.profile ? p.profile.label : '', pos: g.posOf(i), stack: anim ? p.startStack - p.committed : p.stack, bet: anim ? 0 : p.bet, folded: p.folded, allIn: p.allIn, out: p.out && !(anim || (g.handOver && !counted)),
    tag: p.out ? `Fora${p.place ? ' · ' + ordinal(p.place) : ''}` : winners.has(i) ? '+' + r.winners.find(w => w.seat === i).amount : p.lastAction, hole: p.hole,
    mode: i === 0 ? 'up' : p.folded ? 'none' : ((r && r.showdown) || anim) ? 'up' : 'back', flip: anim && anim.first,
    turn: g.toAct === i && !g.handOver, win: winners.has(i), eq: anim && eqBy[i] != null ? eqBy[i] : null,
  }));
  const board = anim ? g.board.slice(0, anim.len) : g.board;
  const street = anim ? 'All-in' : g.handOver ? (r.showdown ? 'Showdown' : 'Fim da mão') : E.STREET_LABEL[g.street];
  const rd = !anim && !g.handOver && !g.players[0].folded && prefs.showStrength ? reading() : null;
  return { seats, board, pot: g.handOver ? g.result.pot : g.potCollected(), street, hl: winningCards(), newFrom: anim ? anim.newFrom : null, made: rd ? new Set(rd.made.core) : null };
}

