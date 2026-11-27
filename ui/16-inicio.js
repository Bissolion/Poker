// ---- Navegação e Início ----
// Quatro seções fixas: Início (o resumo de tudo), Mesa, Treinar e Meu jogo.
// A mesa só começa quando você senta nela; longe dela, os bots esperam a sua vez em silêncio.
const TAB_GROUP = { drills: 'train', quiz: 'train', ranges: 'train', terms: 'train', real: 'mine', bank: 'mine', session: 'mine', hands: 'mine' };
const LAST_TAB = { train: 'drills', mine: 'real' };
const VIEW_HASH = { home: 'inicio', table: 'mesa', train: 'treinar', mine: 'meu-jogo' };
const HASH_VIEW = Object.fromEntries(Object.entries(VIEW_HASH).map(([k, v]) => [v, k]));
let quickArm = null;

function go(v, tab) {
  if ((v === 'train' || v === 'mine') && tab && TAB_GROUP[tab] === v) LAST_TAB[v] = tab;
  const changed = view !== v;
  view = v;
  $('vHome').hidden = v !== 'home';
  $('vTable').hidden = v !== 'table';
  $('vStudy').hidden = v !== 'train' && v !== 'mine';
  document.body.dataset.view = v;
  document.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === v ? 'page' : 'false'));
  if (v === 'train' || v === 'mine') {
    studyTab = LAST_TAB[v];
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.dataset.group !== v; });
    renderStudy();
  } else if (v === 'table') {
    if (!game) newGame(cfg); else render();
  } else renderHome();
  try { if (location.hash !== '#' + VIEW_HASH[v]) history.replaceState(null, '', '#' + VIEW_HASH[v]); } catch (e) {}
  if (changed) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { const v = HASH_VIEW[location.hash.slice(1)]; if (v && v !== view) go(v); });
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

const TABLE_TXT = () => ({ '6': tx`6 jogadores`, '9': tx`9 jogadores`, hu: 'Heads-up', spin: 'Spin & Go' });
function cfgLine(c) {
  const t = TABLE_TXT()[c.table] || c.table;
  const f = c.table === 'spin' ? '' : c.format === 'tourney' ? tx`Torneio` : 'Cash';
  return [f, t, (E.SKILLS[c.skill] || E.SKILLS.normal).label].filter(Boolean).join(' · ');
}
const QUICK = () => [
  { k: 'cash', c: { table: '6', format: 'cash' }, name: 'Cash', sub: tx`6 jogadores, blinds fixos de 5/10` },
  { k: 'tour', c: { table: '6', format: 'tourney' }, name: tx`Torneio`, sub: tx`6 jogadores, os blinds sobem` },
  { k: 'spin', c: { table: 'spin', format: 'tourney' }, name: 'Spin & Go', sub: tx`3 jogadores, 25 BB, prêmio sorteado` },
  { k: 'hu', c: { table: 'hu', format: 'cash' }, name: 'Heads-up', sub: tx`Um contra um` },
];

// o vazamento mais forte: o do jogo real pesa mais do que o do treino
function topLeak() {
  if (realGames && realGames.length) {
    const all = realGames.flatMap(g => g.hands);
    const L = E.findLeaks(all.flatMap(h => h.recs || []), all.map(h => h.hand).filter(Boolean));
    if (L.length) return { l: L[0], real: true };
  }
  const L = E.findLeaks(reg.decs, reg.hands);
  return L.length ? { l: L[0], real: false } : null;
}

function heroBlock() {
  const g = game;
  if (!g) return `
    <div class="hero-felt"><div class="hf-in">
      <p class="hf-kicker">${tx`Sua próxima mesa`}</p>
      <p class="hf-big">${cfg.table === 'spin' ? 'Spin & Go' : cfg.table === 'hu' ? 'Heads-up' : cfg.format === 'tourney' ? tx`Torneio` : 'Cash 5/10'}</p>
      <p class="hf-sub">${[cfg.table === 'spin' || cfg.table === 'hu' ? '' : TABLE_TXT()[cfg.table], (E.SKILLS[cfg.skill] || E.SKILLS.normal).label].filter(Boolean).join(' · ')} · ${tx`o coach comenta cada decisão`}</p>
    </div></div>
    <div class="hero-act"><button class="primary" type="button" id="hSit">${tx`Sentar à mesa`}</button><button class="ghost" type="button" id="hNew">${tx`Mudar o jogo`}</button></div>`;
  const me = g.players[0], bb = Math.round((me.stack + me.bet) / g.bb);
  const out = me.out || (tour && tour.over);
  const yourTurn = !g.handOver && g.toAct === 0;
  const fmt = cfgLine(cfg) + (tour ? ' · ' + tx`nível ${tour.level + 1}` : '');
  return `
    <div class="hero-felt"><div class="hf-in">
      <p class="hf-kicker">${fmt}</p>
      <p class="hf-big">${out ? (tour && tour.place ? tx`${ordinal(tour.place)} lugar` : tx`Fim de jogo`) : tx`${fmtN(bb)} BB`}</p>
      <p class="hf-sub">${out ? tx`Comece outro jogo ou revise as mãos.` : yourTurn ? `<b class="hf-turn">${tx`Sua vez`}</b> · ${tx`mão ${g.handNo}`}` : tx`Mão ${g.handNo} · ${g.activeCount()} na mesa`}</p>
    </div></div>
    <div class="hero-act"><button class="primary" type="button" id="hSit">${out ? tx`Ver a mesa` : tx`Voltar à mesa`}</button><button class="ghost" type="button" id="hNew">${tx`Novo jogo`}</button></div>`;
}

function renderHome() {
  const el = $('vHome');
  const tl = topLeak(), sug = tl ? E.LEAK_DRILL[tl.l.id] : 'abrir';
  const dr = E.DRILLS[sug] || E.DRILLS.abrir;
  const best = stats.drills && stats.drills[sug];
  const wk = weekNow();
  el.innerHTML = `
    <div class="home-in">
      <div class="h-warn" id="hWarn"></div>
      <section class="h-hero" aria-label="${tx`Sua mesa`}">${heroBlock()}</section>
      <section class="h-quick" aria-labelledby="hqT">
        <h2 id="hqT">${tx`Jogo rápido`}</h2>
        <div class="qgrid">${QUICK().map(q => `<button class="qt${quickArm === q.k ? ' armed' : ''}" type="button" data-q="${q.k}"><b>${q.name}</b><span>${quickArm === q.k ? tx`Toque de novo: a mesa atual será encerrada.` : q.sub}</span></button>`).join('')}</div>
      </section>
      <section class="h-drill" aria-labelledby="hdT">
        <h2 id="hdT">${tx`Treino de hoje`}</h2>
        <p class="hd-why">${tl ? (tl.real ? tx`Nas suas partidas reais: <b>${tl.l.title.toLowerCase()}</b>.` : tx`No treino aqui: <b>${tl.l.title.toLowerCase()}</b>.`) + ' ' + tl.l.todo : tx`Ainda não há mãos suficientes para achar seus vazamentos. Jogue na mesa ou importe seus históricos em Meu jogo. Enquanto isso, comece pelo básico.`}</p>
        <button class="hd-go" type="button" id="hDrill"><span><b>${dr.name}</b><small>${dr.desc}</small></span><span class="hd-best">${best ? best.best + '/' + DRILL_N : tx`novo`}</span></button>
      </section>
      <section class="h-mine" aria-labelledby="hmT">
        <h2 id="hmT">${tx`Meu jogo`}</h2>
        <div class="mrow">
          <button type="button" data-m="bank"><span>${tx`Banca`}</span><b id="hBank">…</b><small id="hBankS"></small></button>
          <button type="button" data-m="real"><span>${tx`Partidas reais`}</span><b>${realGames ? realGames.length : '…'}</b><small>${realGames && realGames.length ? tx`nota média ${fmtN(Math.round(realGames.reduce((a, g) => a + (g.score || 0), 0) / realGames.length * 10) / 10)}` : tx`importe da GGPoker`}</small></button>
          <button type="button" data-m="session"><span>${tx`Esta semana`}</span><b>${wk.d ? pct(wk.good) : '–'}</b><small>${wk.d ? tx`decisões boas em ${wk.h} mãos` : tx`sem mãos ainda`}</small></button>
        </div>
      </section>
      <section class="h-study" aria-labelledby="hsT">
        <h2 id="hsT">${tx`Consultar`}</h2>
        <div class="srow"><button type="button" data-s="ranges">${tx`Faixas por posição`}</button><button type="button" data-s="quiz">Quiz</button><button type="button" data-s="terms">${tx`Termos`}</button></div>
      </section>
    </div>`;
  $('hSit').onclick = () => go('table');
  $('hNew').onclick = () => openSetup('new');
  el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    const q = QUICK().find(x => x.k === b.dataset.q);
    const busy = game && game.handNo > 1 && !(tour && tour.over) && !game.players[0].out;
    if (busy && quickArm !== q.k) { quickArm = q.k; renderHome(); return; }
    quickArm = null;
    cfg = { ...cfg, ...q.c }; newGame(cfg); go('table');
  });
  $('hDrill').onclick = () => { drill = { type: sug, i: 0, res: [], streak: 0 }; nextDrill(); go('train', 'drills'); };
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => go('mine', b.dataset.m));
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go('train', b.dataset.s));
  // dados que vêm do armazenamento do aparelho chegam depois
  const pend = [];
  if (realGames === null) pend.push(loadReal());
  if (bankEntries === null) pend.push(loadBank());
  if (pend.length) Promise.all(pend).then(() => { if (view === 'home') renderHome(); }).catch(() => {});
  else homeBank();
}
function homeBank() {
  const st = E.bankStats(bankEntries || []);
  const b = $('hBank'); if (b) b.textContent = bankEntries && bankEntries.length ? usd(st.balance) : '–';
  const bs = $('hBankS'); if (bs) bs.textContent = bankEntries && bankEntries.length ? tx`${st.games} partidas lançadas` : tx`lance seu saldo`;
  const warns = E.bankWarnings(bankEntries || [], bankCfg());
  const w = $('hWarn'); if (w) w.innerHTML = warns.map(x => `<div class="bwarn ${x.sev}" role="status">${x.text}</div>`).join('');
}
// decisões boas nesta semana (treino aqui no app)
function weekNow() {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const hs = reg.hands.filter(h => (h.s || 0) >= start.getTime()), keys = new Set(hs.map(h => h.h));
  const ds = reg.decs.filter(d => keys.has(d.h));
  return { h: hs.length, d: ds.length, good: ds.length ? ds.filter(d => d.g === 'good').length / ds.length : 0 };
}

go(HASH_VIEW[location.hash.slice(1)] || 'home');
