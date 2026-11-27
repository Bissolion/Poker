// ---------- Históricos reais (GGPoker) ----------
// Lê o texto que o PokerCraft exporta (torneios, Spin & Gold, Battle Royale, freerolls e cash),
// reconstrói cada mão no motor e avalia as decisões do jogador com o mesmo coach do jogo.

const HH_SUIT = { s: 0, h: 1, d: 2, c: 3 };
const HH_RANK = '23456789TJQKA';
const hhCard = s => HH_RANK.indexOf(s[0]) * 4 + HH_SUIT[s[1]];
const hhCards = s => (s || '').trim().split(/\s+/).filter(Boolean).map(hhCard);
// valores: "1,500" → 1500; no cash "$0.02" → 2 (centavos)
const hhNum = (s, cash) => { const v = parseFloat(String(s).replace(/[$,]/g, '')); return cash ? Math.round(v * 100) : Math.round(v); };

// Junta linhas quebradas no meio (acontece ao copiar do PokerCraft)
function hhUnwrap(text) {
  const START = /^(Poker Hand #|Tournament #|Table '|Seat \d+|\*\*\*|Dealt to |Uncalled bet|Total pot|Board \[|\S+: |\S+ collected |\S+ (shows|mucks)|$)/;
  const out = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const l = raw.trim();
    if (out.length && l && !START.test(l)) out[out.length - 1] += ' ' + l; else out.push(l);
  }
  return out.join('\n');
}

function parseHandHistory(text) {
  const out = [], seen = new Set();
  const blocks = hhUnwrap(text).split(/(?=Poker Hand #)/).filter(b => b.startsWith('Poker Hand #'));
  for (const b of blocks) {
    const h = parseOneHand(b);
    if (h && !seen.has(h.id)) { seen.add(h.id); out.push(h); }
  }
  return out;
}

function parseOneHand(b) {
  const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
  const head = lines[0];
  const id = (head.match(/^Poker Hand #(\w+)/) || [])[1];
  if (!id) return null;
  const cash = !/Tournament #/.test(head);
  const tour = cash ? null : { id: (head.match(/Tournament #(\d+)/) || [])[1], name: (head.match(/Tournament #\d+,\s*(.+?)\s+Hold'em/) || [])[1] || '' };
  const blinds = cash ? head.match(/\(\$?([\d.,]+)\/\$?([\d.,]+)\)/) : head.match(/Level\s*\d+\(([\d,]+)\/([\d,]+)/);
  const when = head.match(/(\d{4})\/(\d\d)\/(\d\d) (\d\d:\d\d:\d\d)/);
  if (!blinds || !when) return null;
  const h = { id, cash, tour, sb: hhNum(blinds[1], cash), bb: hhNum(blinds[2], cash), date: `${when[1]}-${when[2]}-${when[3]}`, time: when[4],
    level: +((head.match(/Level\s*(\d+)/) || [])[1] || 0), seats: [], button: 0, max: 9, posts: [], actions: [], board: [], shows: {}, won: {}, hero: null, heroCards: [], totalPot: 0 };
  let street = 'preflop';
  for (const l of lines.slice(1)) {
    let m;
    if ((m = l.match(/^Table '.*?' (\d+)-max Seat #(\d+) is the button/))) { h.max = +m[1]; h.button = +m[2]; continue; }
    if ((m = l.match(/^Seat (\d+): (\S+) \(\$?([\d.,]+) in chips\)/)) && street === 'preflop' && !h.summary) { h.seats.push({ seat: +m[1], name: m[2], stack: hhNum(m[3], cash) }); continue; }
    if ((m = l.match(/^Dealt to Hero \[(.+?)\]/))) { h.hero = 'Hero'; h.heroCards = hhCards(m[1]); continue; }
    if ((m = l.match(/^(\S+): posts the ante \$?([\d.,]+)/))) { h.posts.push({ name: m[1], kind: 'ante', amt: hhNum(m[2], cash) }); continue; }
    if ((m = l.match(/^(\S+): posts small blind \$?([\d.,]+)/))) { h.posts.push({ name: m[1], kind: 'sb', amt: hhNum(m[2], cash) }); continue; }
    if ((m = l.match(/^(\S+): posts big blind \$?([\d.,]+)/))) { h.posts.push({ name: m[1], kind: 'bb', amt: hhNum(m[2], cash) }); continue; }
    if ((m = l.match(/^\*\*\* (FLOP|TURN|RIVER) \*\*\* (.*)$/))) {
      street = m[1].toLowerCase();
      const all = [...m[2].matchAll(/\[(.+?)\]/g)].map(x => x[1]).join(' ');
      h.board = hhCards(all); continue;
    }
    if (/^\*\*\* SUMMARY/.test(l)) { h.summary = true; continue; }
    if ((m = l.match(/^Total pot \$?([\d.,]+)/))) { h.totalPot = hhNum(m[1], cash); continue; }
    if ((m = l.match(/^(\S+): shows \[(.+?)\]/))) { h.shows[m[1]] = hhCards(m[2]); continue; }
    if ((m = l.match(/^(\S+) collected \$?([\d.,]+) from pot/))) { h.won[m[1]] = (h.won[m[1]] || 0) + hhNum(m[2], cash); continue; }
    if (h.summary) continue;
    if ((m = l.match(/^(\S+): (folds|checks|calls|bets|raises)(?: \$?([\d.,]+))?(?: to \$?([\d.,]+))?( and is all-in)?/))) {
      const type = m[2];
      h.actions.push({ street, name: m[1], type: type === 'folds' ? 'fold' : type === 'checks' ? 'check' : type === 'calls' ? 'call' : 'raise',
        amt: m[3] ? hhNum(m[3], cash) : 0, to: m[4] ? hhNum(m[4], cash) : (type === 'bets' ? hhNum(m[3], cash) : 0), bet: type === 'bets', allIn: !!m[5] });
    }
  }
  if (!h.hero || h.heroCards.length !== 2) return null;
  // na primeira rodada o primeiro "bets" pode ser um aumento sem aposta anterior
  return h;
}

// Resumo do torneio (arquivo "Tournament #..."): buy-in, prêmio, colocação
function parseTournamentSummary(text) {
  const t = text.replace(/\r/g, '');
  const head = t.match(/Tournament #(\d+),\s*(.+?),\s*Hold'em/);
  if (!head) return null;
  const buy = t.match(/Buy-in:\s*(.+)/), players = t.match(/(\d+) Players/), place = t.match(/finished the tournament in (\d+)/), recv = t.match(/received a total of \$([\d.,]+)/);
  const when = t.match(/started (\d{4})\/(\d\d)\/(\d\d) (\d\d:\d\d)/);
  const buyin = buy ? buy[1].split('+').reduce((a, x) => a + (parseFloat(x.replace(/[$,]/g, '')) || 0), 0) : 0;
  return { id: head[1], name: head[2], buyin: Math.round(buyin * 100) / 100, players: players ? +players[1] : 0, place: place ? +place[1] : 0,
    prize: recv ? parseFloat(recv[1].replace(/,/g, '')) : 0, date: when ? `${when[1]}-${when[2]}-${when[3]}` : '', time: when ? when[4] : '' };
}

// ---------- Avaliação de uma decisão (o mesmo caminho do jogo ao vivo) ----------
function limpersAt(g, seat) { return g.players.filter(q => q.seat !== seat && !q.folded && q.bet === g.bb && g.posOf(q.seat) !== 'BB').length; }
function adviseDecision(g, seat, iters = 1500) {
  const L = g.legal(seat);
  let adv = null, info = null, rec;
  if (g.street === 'preflop') { adv = preflopAdvice(g, seat); rec = adv.rec; }
  else {
    info = postflopInfo(g, seat, iters); rec = postflopRec(info);
    info.tips = postflopTips(g, seat, info);
    const t = info.tips.find(x => x.rec && (x.k === 'cbet' || x.k === 'river'));
    if (t && L.toCall === 0) rec = t.rec;
    const sz = info.tips.find(x => x.size); if (sz) info.size = sz.size;
  }
  if (rec === 'raise' && !L.canRaise) rec = L.canCheck ? 'check' : 'call';
  if (rec === 'check' && !L.canCheck) rec = 'call';
  return { street: g.street, L, adv, info, rec };
}
function judgeDecision(g, seat, d, type, to) {
  const L = d.L;
  if (type === 'call' && L.canCheck) type = 'check';
  let fb = d.street === 'preflop' ? gradePreflop(d.adv, type, L) : gradePostflop(d.info, type, L, d.street);
  const cb = d.info && (d.info.tips || []).find(x => x.k === 'cbet');
  if (cb && cb.rec === 'raise' && type === 'check') fb = { grade: 'ok', title: tx`Faltou a continuation bet`, text: cb.text };
  if (cb && cb.rec === 'check' && type === 'raise' && fb.grade === 'good') fb = { grade: 'ok', title: tx`Continuation bet arriscada aqui`, text: cb.text };
  let sizing = null;
  if (type === 'raise') sizing = gradeSizing({ street: d.street, raises: g.raises, to, currentBet: g.currentBet, pot: g.pot(), toCall: L.toCall, isBet: L.isBet, bb: g.bb,
    limpers: limpersAt(g, seat), maxTo: L.maxTo, st: d.info ? d.info.st : 0, draws: d.info ? d.info.draws : [], board: g.board, nAct: g.activeCount(), stackBB: d.adv && d.adv.push ? d.adv.depth : null, nuts: d.info ? d.info.nuts : false });
  return { fb, sizing, type };
}

// ---------- Reconstrução da mão no motor ----------
function replayHand(h, opts = {}) {
  const iters = opts.iters || 500;
  const seats = h.seats.slice().sort((a, b) => a.seat - b.seat);
  const idx = {}; seats.forEach((s, i) => { idx[s.name] = i; });
  if (!(h.hero in idx)) return { ok: false, why: 'sem herói' };
  const g = new Game(seats.map(s => ({ name: s.name, isHuman: s.name === h.hero, stack: s.stack })), { sb: h.sb, bb: h.bb, rng: opts.rng });
  const sbPost = h.posts.find(p => p.kind === 'sb'), bbPost = h.posts.find(p => p.kind === 'bb');
  // o motor escolhe quem posta os blinds a partir do botão; ajusta o botão para bater com o histórico
  let btn = seats.findIndex(s => s.seat === h.button);
  const bbIdx = bbPost ? idx[bbPost.name] : -1;
  if (bbIdx >= 0) {
    const n = seats.length;
    btn = n === 2 ? (bbIdx + 1) % 2 : (bbIdx - 2 + n) % n;
    if (sbPost && n > 2 && idx[sbPost.name] !== (bbIdx - 1 + n) % n) return { ok: false, why: 'blinds fora do padrão' };
  }
  if (btn < 0) return { ok: false, why: 'botão' };
  g.button = (btn - 1 + seats.length) % seats.length;
  g.startHand();
  if (g.button !== btn) return { ok: false, why: 'botão' };
  // cartas: herói, quem mostrou, o resto aleatório; o baralho entrega a mesa do histórico
  const used = new Set([...h.heroCards, ...h.board, ...Object.values(h.shows).flat()]);
  const free = shuffle([...Array(52).keys()].filter(c => !used.has(c)), opts.rng || Math.random);
  for (const p of g.players) p.hole = p.name === h.hero ? h.heroCards.slice() : (h.shows[p.name] ? h.shows[p.name].slice() : [free.pop(), free.pop()]);
  g.deck = free.concat(h.board.slice().reverse());
  // antes: vão direto para o pote (não contam como aposta)
  for (const a of h.posts.filter(x => x.kind === 'ante')) {
    const p = g.players[idx[a.name]]; if (!p) continue;
    const v = Math.min(a.amt, p.stack); p.stack -= v; p.committed += v; if (p.stack === 0) p.allIn = true;
  }
  // confere os blinds postados
  if (sbPost && g.players[idx[sbPost.name]].bet !== Math.min(sbPost.amt, h.seats.find(s => s.name === sbPost.name).stack)) return { ok: false, why: 'small blind' };
  if (bbPost && g.players[idx[bbPost.name]].bet !== bbPost.amt && g.players[idx[bbPost.name]].stack > 0) return { ok: false, why: 'big blind' };
  const heroSeat = idx[h.hero], decisions = [], recs = [], flags = {};
  const startStack = h.seats.find(s => s.name === h.hero).stack;
  for (const a of h.actions) {
    if (g.handOver) break;
    const s = idx[a.name];
    if (s !== g.toAct) return { ok: false, why: `ordem (${a.name})`, decisions };
    let act;
    if (a.type === 'raise') act = { type: 'raise', to: a.to };
    else act = { type: a.type };
    if (s === heroSeat && opts.judge !== false) {
      const d = adviseDecision(g, s, iters);
      const j = judgeDecision(g, s, d, act.type, act.to || 0);
      const L = d.L;
      decisions.push({ street: g.street, board: g.board.slice(), pot: g.pot(), toCall: L.toCall, stackBB: Math.round((g.players[s].stack + g.players[s].bet) / g.bb * 10) / 10,
        pos: g.posOf(s), type: j.type, to: act.to || 0, allIn: a.allIn, rec: d.rec, grade: j.fb.grade, title: j.fb.title, text: j.fb.text, sizing: j.sizing,
        push: !!(d.adv && d.adv.push), why: d.adv ? d.adv.why : '', snap: g.snaps.length });
      const rec = decisionRecord(g, s, j.type, j.fb.grade); rec.h = h.id; recs.push(rec);
    }
    if (s === heroSeat && g.street === 'preflop') { if (act.type === 'raise') flags.vpip = flags.pfr = true; else if (act.type === 'call') flags.vpip = true; }
    try { g.act(s, act); } catch (e) { return { ok: false, why: 'ação inválida', decisions }; }
    if (!g.players[heroSeat].folded && g.board.length >= 3) flags.flop = true;
  }
  // fim da mão: ninguém mais age (todos all-in ou mão encerrada no histórico)
  const ok = !h.totalPot || Math.abs(g.pot() - h.totalPot) <= Math.max(2, h.totalPot * 0.002) || !g.handOver;
  const net = (h.won[h.hero] || 0) - g.players[heroSeat].committed;
  let hand = null;
  if (g.result) { hand = handRecord(g, heroSeat, flags); }
  else { const p = g.players[heroSeat]; hand = { pos: g.posOf(heroSeat), n: g.activeCount(), vpip: !!flags.vpip, pfr: !!flags.pfr, flop: !!flags.flop, sd: false, won: net > 0, net: Math.round(net / h.bb * 10) / 10 }; }
  hand.h = h.id;
  return { ok, why: ok ? '' : 'pote diferente', decisions, recs, hand, g, heroSeat, pos: g.posOf(heroSeat), stackBB: Math.round(startStack / h.bb * 10) / 10, net, players: seats.length };
}

// Nota da partida (0–10) a partir das decisões: boas valem 1, ok 0,6, ruins 0; erros grandes (all-in) pesam o dobro
function sessionScore(decs) {
  if (!decs.length) return null;
  let s = 0, w = 0;
  for (const d of decs) { const k = d.allIn || d.push ? 2 : 1; w += k; s += k * (d.grade === 'good' ? 1 : d.grade === 'ok' ? 0.6 : 0); }
  return Math.round(s / w * 100) / 10;
}

// Importa um texto inteiro: mãos agrupadas por partida, com as decisões avaliadas
function importHistories(text, opts = {}) { return importParsed(parseHandHistory(text), opts); }
function importParsed(hands, opts = {}) {
  const games = {};
  for (const h of hands) {
    const key = h.tour ? 'T' + h.tour.id : 'C' + h.date;
    const r = replayHand(h, opts);
    const gm = games[key] || (games[key] = { key, name: h.tour ? h.tour.name : 'Cash ' + h.date, cash: h.cash, tourId: h.tour && h.tour.id, date: h.date, time: h.time, hands: [] });
    if (h.date + h.time < gm.date + gm.time) { gm.date = h.date; gm.time = h.time; }
    gm.hands.push({ id: h.id, date: h.date, time: h.time, level: h.level, sb: h.sb, bb: h.bb, cards: h.heroCards, board: h.board, shows: h.shows, ok: r.ok, why: r.why,
      pos: r.pos, stackBB: r.stackBB, net: r.net, players: r.players, decisions: r.decisions || [], recs: r.recs || [], hand: r.hand || null, raw: h });
  }
  for (const gm of Object.values(games)) {
    gm.hands.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const decs = gm.hands.flatMap(x => x.decisions);
    gm.score = sessionScore(decs);
    gm.counts = { good: decs.filter(d => d.grade === 'good').length, ok: decs.filter(d => d.grade === 'ok').length, bad: decs.filter(d => d.grade === 'bad').length };
    gm.unread = gm.hands.filter(x => !x.ok).length;
  }
  return Object.values(games).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// ---------- Leitor de .zip (sem bibliotecas: usa DecompressionStream do navegador) ----------
async function unzipTexts(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = [];
  // diretório central: procura o fim de arquivo (EOCD)
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip inválido');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!/\.txt$/i.test(name)) continue;
    const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true), start = off + 30 + lnl + lel;
    const data = u8.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = data;
    else if (method === 8) {
      const ds = new DecompressionStream('deflate-raw');
      bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer());
    } else continue;
    out.push({ name, text: new TextDecoder().decode(bytes) });
  }
  return out;
}
