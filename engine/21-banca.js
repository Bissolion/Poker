// ---------- Banca e sessões ----------
// Lançamentos: partidas (buy-in e prêmio), depósitos e saques. Tudo em dólares.
// O app calcula saldo, ROI por formato, o limite certo para a banca e os avisos de tilt.

const BANK_FORMATS = ['spin', 'mtt', 'freeroll', 'cash', 'outro'];
const BANK_FORMAT_PT = { spin: 'Spin & Go', mtt: tx`Torneio`, freeroll: 'Freeroll', cash: 'Cash', outro: tx`Outro` };
// degraus de buy-in por formato (no cash, o buy-in de 100 BB de cada limite)
const BANK_LADDER = { spin: [0.25, 0.5, 1, 3, 5, 10, 25], mtt: [0.25, 1, 2.5, 5, 11, 22, 55], cash: [2, 5, 10, 25, 50, 100], freeroll: [0], outro: [] };
const CASH_NAME = { 2: 'NL2', 5: 'NL5', 10: 'NL10', 25: 'NL25', 50: 'NL50', 100: 'NL100' };
const BANK_DEFAULTS = { minBuyins: { spin: 50, mtt: 100, cash: 30 }, stopLoss: 5, stopUnit: 'bi', lateHour: 0, lateUntil: 6, streak: 3 };

function inferFormat(name) {
  const n = (name || '').toLowerCase();
  if (/spin/.test(n)) return 'spin';
  if (/freeroll|freebuy/.test(n)) return 'freeroll';
  if (/^cash/.test(n)) return 'cash';
  return 'mtt';
}
function guessBuyin(name) {
  const m = (name || '').match(/\$\s?([\d.]+)/);
  if (/freeroll|freebuy/i.test(name || '')) return 0;
  return m ? parseFloat(m[1]) : null;
}
const money = v => Math.round(v * 100) / 100;
const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// partida completa = sabemos quanto entrou e quanto saiu
const entryDone = e => e.kind !== 'game' || (e.format === 'cash' ? e.net != null : e.buyin != null && e.prize != null);
const entryNet = e => e.kind !== 'game' ? 0 : e.format === 'cash' ? e.net : (e.prize || 0) - (e.buyin || 0);

// saldo, lucro e ROI
function bankStats(entries, now = new Date()) {
  const es = entries.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  let bal = 0, dep = 0, wd = 0;
  const curve = [], by = {};
  const month = localDay(now).slice(0, 7);
  let monthProfit = 0;
  for (const e of es) {
    if (e.kind === 'deposit') { bal += e.amount; dep += e.amount; }
    else if (e.kind === 'withdraw') { bal -= e.amount; wd += e.amount; }
    else {
      if (!entryDone(e)) continue;
      const net = entryNet(e);
      bal += net;
      if ((e.date || '').slice(0, 7) === month) monthProfit += net;
      const f = by[e.format] || (by[e.format] = { n: 0, buyins: 0, prizes: 0, wins: 0, cashes: 0 });
      f.n++; f.buyins += e.buyin || 0; f.prizes += e.format === 'cash' ? (e.buyin || 0) + net : e.prize || 0;
      if (e.format === 'cash') { f.hands = (f.hands || 0) + (e.hands || 0); f.bbWon = (f.bbWon || 0) + (e.bbWon || 0); }
      if (e.place === 1) f.wins++;
      if ((e.prize || 0) > 0) f.cashes++;
    }
    curve.push({ date: e.date, time: e.time || '', bal: money(bal), kind: e.kind });
  }
  for (const f of Object.values(by)) { f.profit = money(f.prizes - f.buyins); f.roi = f.buyins ? f.profit / f.buyins : null; if (f.hands) f.bb100 = f.bbWon / f.hands * 100; }
  return { balance: money(bal), deposits: money(dep), withdrawals: money(wd), profit: money(bal - dep + wd), monthProfit: money(monthProfit), by, curve,
    games: es.filter(e => e.kind === 'game' && entryDone(e)).length, pending: es.filter(e => e.kind === 'game' && !entryDone(e)).length };
}

// maior limite que a banca aguenta em cada formato
function stakeSuggestion(balance, settings = BANK_DEFAULTS) {
  const out = {};
  for (const f of ['spin', 'mtt', 'cash']) {
    const need = settings.minBuyins[f], ladder = BANK_LADDER[f];
    let ok = null;
    for (const s of ladder) if (balance / s >= need) ok = s;
    const next = ladder.find(s => s > (ok || 0));
    out[f] = { stake: ok, buyins: ok ? Math.floor(balance / ok) : 0, need, next: next || null, toNext: next ? money(next * need - balance) : null, label: ok ? (f === 'cash' ? CASH_NAME[ok] : '$' + ok.toFixed(2)) : null };
  }
  return out;
}

// avisos de tilt: stop-loss do dia, sequência de eliminações, horário, depósito depois de perda
function bankWarnings(entries, settings = BANK_DEFAULTS, now = new Date()) {
  const W = [];
  const today = localDay(now);
  const games = entries.filter(e => e.kind === 'game' && entryDone(e)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const todayGames = games.filter(e => e.date === today);
  const todayNet = money(todayGames.reduce((a, e) => a + entryNet(e), 0));
  const avgBuyin = todayGames.filter(e => e.buyin > 0).reduce((a, e, _, arr) => a + e.buyin / arr.length, 0);
  const limit = settings.stopUnit === 'usd' ? settings.stopLoss : settings.stopLoss * (avgBuyin || 0);
  if (limit > 0 && todayNet <= -limit) W.push({ k: 'stop', sev: 'bad', text: tx`Stop-loss do dia: você perdeu US$${(-todayNet).toFixed(2)} hoje. Pare por hoje; amanhã a cabeça está melhor.` });
  const last = games.slice(-settings.streak);
  if (settings.streak > 0 && last.length === settings.streak && last.every(e => e.format !== 'cash' && !(e.prize > 0) && e.buyin > 0) && last[last.length - 1].date === today) W.push({ k: 'streak', sev: 'ok', text: tx`${settings.streak} eliminações seguidas. Faça uma pausa de 20 minutos antes da próxima partida.` });
  const h = now.getHours();
  const late = settings.lateHour != null && settings.lateHour !== settings.lateUntil && (settings.lateHour <= settings.lateUntil ? h >= settings.lateHour && h < settings.lateUntil : h >= settings.lateHour || h < settings.lateUntil);
  if (late) W.push({ k: 'late', sev: 'ok', text: tx`São ${String(h).padStart(2, '0')}h. Cansado, a gente toma as piores decisões, principalmente depois de perder.` });
  return W;
}
// depósito no mesmo dia de uma perda: o app pergunta antes
function depositCheck(entries, now = new Date()) {
  const today = localDay(now);
  const st = bankStats(entries, now);
  const net = money(entries.filter(e => e.kind === 'game' && entryDone(e) && e.date === today).reduce((a, e) => a + entryNet(e), 0));
  const zeroToday = st.deposits > 0 && st.curve.some(c => c.date === today && c.kind === 'game' && c.bal <= 0.01);
  if (!(net < 0) && !zeroToday) return '';
  return [net < 0 ? tx`Você perdeu US$${(-net).toFixed(2)} hoje.` : '', zeroToday ? tx`A banca zerou hoje.` : '', tx`Depositar agora costuma ser vontade de recuperar. Que tal decidir amanhã?`].filter(Boolean).join(' ');
}

// partidas importadas → lançamentos da banca
function entryFromGame(g, sum) {
  const fmt = g.cash ? 'cash' : inferFormat(g.name);
  const buyin = sum ? sum.buyin : guessBuyin(g.name);
  const e = { id: g.key, kind: 'game', date: g.date, time: (g.time || '').slice(0, 5), format: fmt, name: g.name, gameKey: g.key,
    buyin: buyin == null ? null : buyin, prize: sum ? sum.prize : null, place: sum ? sum.place : null, players: sum ? sum.players : null, auto: true };
  if (fmt === 'cash') {
    e.buyin = null; e.prize = null; e.hands = g.hands.length;
    e.net = money(g.hands.reduce((a, h) => a + (h.net || 0), 0) / 100);
    e.bbWon = g.hands.reduce((a, h) => a + (h.raw && h.raw.bb ? (h.net || 0) / h.raw.bb : 0), 0);
  }
  // sem resumo: dá para saber se foi eliminado pela última mão
  if (!sum && !g.cash) {
    const last = g.hands[g.hands.length - 1];
    if (last && last.raw) {
      const hero = last.raw.seats.find(s => s.name === last.raw.hero), total = last.raw.seats.reduce((a, s) => a + s.stack, 0);
      const end = hero.stack + (last.net || 0);
      if (end <= 0) { e.result = 'bust'; e.prize = 0; }
      else if (end >= total * 0.999 && last.raw.seats.length <= 3) { e.result = 'win'; e.place = 1; }
    }
  }
  return e;
}

// mescla um lançamento automático com o que já estava salvo (o que a pessoa digitou vale mais)
function mergeEntry(old, e, nameBuyin = {}) {
  if (e.buyin == null && nameBuyin[e.name] != null) e.buyin = nameBuyin[e.name];
  if (!old) return spinPrize(e);
  const out = Object.assign({}, e);
  for (const k of ['buyin', 'prize', 'place', 'mult', 'note', 'format']) if (old.edited && old.edited[k]) out[k] = old[k]; else if (out[k] == null && old[k] != null) out[k] = old[k];
  out.edited = old.edited;
  return spinPrize(out);
}
// Spin: prêmio = multiplicador × buy-in quando ganhou
function spinPrize(e) {
  if (e.format === 'spin' && e.prize == null && e.mult && e.buyin != null && e.place === 1) e.prize = money(e.mult * e.buyin);
  return e;
}
function entryFromSummary(s) {
  return spinPrize({ id: 'T' + s.id, kind: 'game', date: s.date, time: s.time, format: inferFormat(s.name), name: s.name, buyin: s.buyin, prize: s.prize, place: s.place, players: s.players, auto: true });
}
