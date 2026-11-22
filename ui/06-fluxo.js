// ---- fluxo ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
function soundFor(p, prevLen) {
  const a = p.lastAction || '';
  voice.say(a === tx`Desiste` ? 'Fold' : a === tx`Passa` ? 'Check' : a === 'All-in' ? 'All in' : a.startsWith(tx`Paga`) ? 'Call' : a.startsWith(tx`Aposta`) ? 'Bet' : a ? 'Raise' : '');
  if (a === tx`Desiste`) sfx.fold(); else if (a === tx`Passa`) sfx.check(); else if (a === 'All-in') sfx.allin(); else if (a) sfx.chip();
  if (!game.handOver && game.board.length > prevLen) setTimeout(() => sfx.card(game.board.length - prevLen), 160);
}
function doAct(seat, a) {
  const prevLen = game.board.length;
  game.act(seat, a);
  if (!game.players[0].folded && game.board.length >= 3) flags.flop = true;
  soundFor(game.players[seat], prevLen);
  // Todos all-in: o motor distribui o resto do board de uma vez; a interface revela aos poucos
  if (game.handOver && game.result.showdown && game.board.length > prevLen) runout = { from: prevLen };
}
async function loop() {
  const my = ++loopId;
  for (;;) {
    if (my !== loopId) return;
    if (game.handOver) { await finishHand(my); return; }
    const s = game.toAct;
    if (s === 0) { beginHeroTurn(); render(); sfx.turn(); return; }
    render();
    const h = game.players[0];
    await sleep(h.folded || h.allIn ? speed().think * 0.45 : speed().think);
    if (my !== loopId) return;
    doAct(s, E.botDecide(game, s));
  }
}
async function finishHand(my) {
  if (runout) {
    const live = game.players.filter(p => !p.folded).map(p => p.seat);
    const hs = live.map(s => game.players[s].hole);
    const steps = [runout.from < 3 ? 3 : null, runout.from < 4 ? 4 : null, 5].filter(Boolean);
    anim = { len: runout.from, live, eq: E.equityKnown(hs, game.board.slice(0, runout.from), 1500), first: true, newFrom: null };
    runout = null;
    render(); sfx.allin();
    await sleep(speed().run);
    for (const len of steps) {
      if (my !== loopId) { anim = null; return; }
      anim.first = false; anim.newFrom = anim.len; anim.len = len;
      anim.eq = len < 5 ? E.equityKnown(hs, game.board.slice(0, len), 1500) : null;
      render(); sfx.card(len === 3 ? 3 : 1);
      await sleep(speed().run * (len === 5 ? 0.8 : 1));
    }
    anim = null;
    if (my !== loopId) return;
  }
  onHandOver();
  render();
  if (game.result.winners.some(w => w.seat === 0)) sfx.win();
}
function beginHeroTurn() {
  const L = game.legal(0);
  let adv = null, info = null, rec;
  if (game.street === 'preflop') { adv = E.preflopAdvice(game, 0); rec = adv.rec; }
  else {
    info = E.postflopInfo(game, 0, 1500); rec = E.postflopRec(info);
    info.tips = E.postflopTips(game, 0, info);
    // a continuation bet e o river mudam a sugestão quando ninguém apostou
    const t = info.tips.find(x => x.rec && (x.k === 'cbet' || x.k === 'river'));
    if (t && L.toCall === 0) rec = t.rec;
    const sz = info.tips.find(x => x.size); if (sz) info.size = sz.size;
  }
  if (rec === 'raise' && !L.canRaise) rec = L.canCheck ? 'check' : 'call';
  if (rec === 'check' && !L.canCheck) rec = 'call';
  decision = { street: game.street, L, adv, info, rec };
  raiseTo = 0;
}
function heroAct(type) {
  const d = decision; if (!d || game.toAct !== 0) return;
  const L = d.L, g = game;
  if (type === 'call' && L.canCheck) type = 'check';
  const to = raiseTo;
  let fb = d.street === 'preflop' ? E.gradePreflop(d.adv, type, L) : E.gradePostflop(d.info, type, L, d.street);
  const cb = d.info && (d.info.tips || []).find(x => x.k === 'cbet');
  if (cb && cb.rec === 'raise' && type === 'check') fb = { grade: 'ok', title: tx`Faltou a continuation bet`, text: cb.text };
  if (cb && cb.rec === 'check' && type === 'raise' && fb.grade === 'good') fb = { grade: 'ok', title: tx`Continuation bet arriscada aqui`, text: cb.text };
  let sizing = null;
  if (type === 'raise') sizing = E.gradeSizing({ street: d.street, raises: g.raises, to, currentBet: g.currentBet, pot: g.pot(), toCall: L.toCall, isBet: L.isBet, bb: g.bb, limpers: limpersFor(0), maxTo: L.maxTo, st: d.info ? d.info.st : 0, draws: d.info ? d.info.draws : [], board: g.board, nAct: g.activeCount(), stackBB: d.adv && d.adv.push ? d.adv.depth : null });
  const actPt = type === 'fold' ? tx`desistiu` : type === 'check' ? tx`passou` : type === 'call' ? tx`pagou ${L.toCall}` : (to >= L.maxTo ? `all-in ${L.maxTo}` : (L.isBet ? tx`apostou ${to}` : tx`aumentou p/ ${to}`));
  const item = Object.assign({ street: E.STREET_LABEL[d.street], act: actPt, sizing }, fb);
  handFb.push(item);
  flashGrade(fb);
  stats[fb.grade]++;
  stats.recent.unshift({ h: g.handNo, street: item.street, combo: E.comboName(g.players[0].hole[0], g.players[0].hole[1]), act: actPt, grade: fb.grade, title: fb.title });
  stats.recent = stats.recent.slice(0, 20);
  if (d.street === 'preflop') { if (type === 'raise') { flags.vpip = flags.pfr = true; } else if (type === 'call') flags.vpip = true; }
  save();
  const rec = E.decisionRecord(g, 0, type, fb.grade); rec.h = handKey(); rec.s = SESSION; rec.m = tour ? 't' : 'c';
  reg.decs.push(rec); saveReg();
  decision = null;
  const at = g.snaps.length;
  doAct(0, type === 'raise' ? { type, to } : { type });
  if (g.snaps[at]) g.snaps[at].fb = item;
  loop();
}
function modeLabel() { return cfg.table === 'spin' ? 'Spin & Go' : (tour ? tx`Torneio` : 'Cash') + (cfg.table === 'hu' ? ' · HU' : ''); }
function onHandOver() {
  if (counted) return;
  const g = game, r = g.result;
  stats.hands++;
  if (!tour) stats.net += r.net[0];
  if (flags.vpip) stats.vpip++; if (flags.pfr) stats.pfr++;
  lastOut = [];
  if (tour) {
    tour.hands++;
    lastOut = g.eliminateBusted().map(p => ({ seat: p.seat, name: p.name, place: p.place }));
    if (g.players[0].out) { tour.over = true; tour.place = g.players[0].place; }
    else if (g.activeCount() === 1) { tour.over = true; tour.place = 1; }
    if (tour.over) { stats.tourneys.unshift({ place: tour.place, n: tour.n, hands: tour.hands, skill: cfg.skill, hu: cfg.table === 'hu', spin: cfg.table === 'spin' ? tour.mult : null, pts: tour.payouts && tour.payouts.length > 1 ? Math.round((tour.payouts[tour.place - 1] || 0) * 100) : null }); stats.tourneys = stats.tourneys.slice(0, 30); }
  }
  counted = true;
  save();
  if (!g.players[0].out || r.net[0]) { const hr = E.handRecord(g, 0, flags); hr.h = handKey(); hr.s = SESSION; hr.m = tour ? 't' : 'c'; reg.hands.push(hr); saveReg(); }
  hands.unshift({
    key: handKey(), no: g.handNo, mode: modeLabel(), names: g.players.map(p => p.name), labels: g.players.map(p => p.profile ? p.profile.label : ''),
    pos: g.players.map(p => g.posOf(p.seat) || ''), holes: g.players.map(p => p.hole.slice()), snaps: g.snaps,
    shown: r.showdown ? g.players.filter(p => !p.folded).map(p => p.seat) : [], net: r.net[0], grades: handFb.map(f => f.grade),
  });
  hands = hands.slice(0, MAX_HANDS);
  saveHands();
}
function nextHand() {
  const g = game;
  if (tour) {
    const lv = E.blindLevel(tour.hands, tour.per);
    if (lv > tour.level) { tour.flash = true; setTimeout(() => sfx.level(), 200); }
    tour.level = lv;
    [g.sb, g.bb] = E.BLIND_LEVELS[lv];
  } else {
    const h = g.players[0];
    if (h.stack === 0) { h.stack = 1000; stats.rebuys++; }
    for (const p of g.players.slice(1)) if (p.stack === 0) p.stack = 1000;
  }
  decision = null; handFb = []; flags = {}; counted = false; raiseTo = 0; runout = null; anim = null; lastOut = [];
  g.startHand();
  if (tour && tour.flash) g.log.push({ hand: g.handNo, text: tx`Blinds sobem para ${g.sb}/${g.bb}`, kind: 'level' });
  setTimeout(() => sfx.card(2), 60);
  loop();
}


// Aviso rápido na tela com a nota da decisão
function flashGrade(fb) {
  let el = document.getElementById('gradeFlash');
  if (!el) { el = document.createElement('div'); el.id = 'gradeFlash'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  const word = { good: tx`Boa!`, ok: 'Ok', bad: tx`Ruim` }[fb.grade];
  el.className = '';
  el.innerHTML = `<b>${word}</b><span>${fb.title || ''}</span>`;
  void el.offsetWidth;
  el.className = 'show ' + fb.grade;
  clearTimeout(flashGrade.t);
  flashGrade.t = setTimeout(() => { el.className = fb.grade; }, 1700);
}
