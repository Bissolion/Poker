// ---- Banca: partidas, depósitos e saques; saldo, ROI, limite certo e avisos de tilt ----
// Tudo fica no IndexedDB deste aparelho (store 'bank'). As regras são lembretes, nunca bloqueiam.
const BANK_CFG_KEY = 'mesa-treino-banca-v1';
let bankEntries = null, bankEdit = null, bankMsg = '', bankDepWarned = false, bankShowAll = false;
function bankCfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(BANK_CFG_KEY) || '{}'); } catch (e) {}
  const d = E.BANK_DEFAULTS;
  return Object.assign({}, d, c, { minBuyins: Object.assign({}, d.minBuyins, c.minBuyins), nameBuyin: c.nameBuyin || {} });
}
function saveBankCfg(c) { try { localStorage.setItem(BANK_CFG_KEY, JSON.stringify(c)); } catch (e) {} }
async function loadBank() { bankEntries = await idbAll('bank'); return bankEntries; }
const usd = v => v == null ? '–' : (v < 0 ? '−' : '') + 'US$' + Math.abs(v).toFixed(2).replace('.', DEC);
const usdS = v => v == null ? '–' : (v > 0 ? '+' : '') + usd(v);
const pctS = v => v == null ? '–' : (v > 0 ? '+' : '') + fmtN(Math.round(v * 100)) + '%';

// chamado por Minhas mãos depois de importar
async function bankAfterImport(games, sums) {
  const cfg = bankCfg(), old = Object.fromEntries((await idbAll('bank')).map(e => [e.id, e]));
  const out = [];
  for (const g of games) out.push(E.mergeEntry(old[g.key], E.entryFromGame(g, g.sum), cfg.nameBuyin));
  for (const s of sums) if (!games.some(g => g.tourId === s.id)) out.push(E.mergeEntry(old['T' + s.id], E.entryFromSummary(s), cfg.nameBuyin));
  if (out.length) await idbPut('bank', out);
  bankEntries = null;
}

function bankCurveSVG(curve) {
  const W = 680, H = 190, L = 50, R = 10, T = 10, B = 30, n = curve.length;
  if (n < 2) return '';
  const vals = curve.map(c => c.bal), max = Math.max(1, ...vals) * 1.1, min = Math.min(0, ...vals);
  const x = i => L + i / (n - 1) * (W - L - R), y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = curve.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c.bal).toFixed(1)}`).join('');
  const marks = curve.map((c, i) => c.kind === 'deposit' || c.kind === 'withdraw' ? `<circle cx="${x(i)}" cy="${y(c.bal)}" r="4" class="cd ${c.kind === 'deposit' ? 'ok' : 'good'}"/>` : '').join('');
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx`Saldo da banca ao longo do tempo`}">
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
    ${[min, 0, max / 1.1].filter((v, i, a) => a.indexOf(v) === i).map(v => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${v.toFixed(v && Math.abs(v) < 10 ? 2 : 0).replace('.', DEC)}</text>`).join('')}
    <path d="${path}" class="ln"/>${marks}
    <text x="${L}" y="${H - 4}" class="ax">${fmtDate(curve[0].date, curve[0].time)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end" class="ax">${fmtDate(curve[n - 1].date, curve[n - 1].time)}</text></svg>`;
}

function stakeAdvice(st, entries, cfg) {
  const sug = E.stakeSuggestion(st.balance, cfg);
  return ['spin', 'mtt', 'cash'].map(f => {
    const s = sug[f], name = E.BANK_FORMAT_PT[f];
    const recent = entries.filter(e => e.kind === 'game' && e.format === f && e.buyin > 0).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
    const played = recent ? recent.buyin : null;
    const lbl = v => f === 'cash' ? (E.CASH_NAME[v] || usd(v)) : usd(v);
    let txt, sev = 'good';
    if (!s.stake) { txt = tx`Banca abaixo do mínimo. O menor limite (${lbl(E.BANK_LADDER[f][0])}) pede ${usd(E.BANK_LADDER[f][0] * s.need)}: até lá, freerolls e treino aqui no app.`; sev = 'bad'; }
    else txt = tx`Até ${s.label}: dá ${s.buyins} buy-ins (o mínimo é ${s.need}).`;
    if (played && s.stake != null && played > s.stake * 1.001) { txt += ' ' + tx`Sua última partida foi de ${lbl(played)}: acima do que a banca aguenta. Desça.`; sev = 'bad'; }
    else if (played && !s.stake) { txt += ' ' + tx`Sua última partida foi de ${lbl(played)}.`; }
    else if (s.stake && s.next && s.toNext != null) txt += ' ' + tx`Para subir para ${lbl(s.next)} faltam ${usd(s.toNext)}.`;
    return `<div class="leak ${sev}"><b>${name}</b><span>${txt}</span></div>`;
  }).join('');
}

function renderBank() {
  const el = $('studyBody');
  if (bankEntries === null) { el.innerHTML = `<p class="muted">${tx`Carregando…`}</p>`; loadBank().then(renderBank); return; }
  if (bankEdit) return renderBankForm();
  const cfg = bankCfg(), es = bankEntries, st = E.bankStats(es);
  const warns = E.bankWarnings(es, cfg);
  const fmts = Object.entries(st.by).filter(([, f]) => f.n);
  const pend = es.filter(e => !E.entryDone(e)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const list = es.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const shown = bankShowAll ? list : list.slice(0, 15);
  const pendNames = [...new Set(pend.filter(e => e.buyin == null).map(e => e.name))];
  el.innerHTML = `
    ${warns.map(w => `<div class="bwarn ${w.sev}" role="status">${w.text}</div>`).join('')}
    <div class="rsum">
      <div><b>${usd(st.balance)}</b><span>${tx`saldo`}</span></div>
      <div><b class="${st.monthProfit < 0 ? 'neg-t' : st.monthProfit > 0 ? 'pos-t' : ''}">${usdS(st.monthProfit)}</b><span>${tx`lucro no mês`}</span></div>
      <div><b>${st.games}</b><span>${tx`partidas`}</span></div>
      <div><b class="${st.profit < 0 ? 'neg-t' : st.profit > 0 ? 'pos-t' : ''}">${usdS(st.profit)}</b><span>${tx`lucro total`}</span></div>
    </div>
    <div class="seg"><button class="chip" type="button" data-new="game">+ ${tx`Partida`}</button><button class="chip" type="button" data-new="deposit">+ ${tx`Depósito`}</button><button class="chip" type="button" data-new="withdraw">+ ${tx`Saque`}</button></div>
    ${bankMsg ? `<p class="muted" aria-live="polite">${bankMsg}</p>` : ''}
    ${!es.length ? `<p class="muted">${tx`Lance seu primeiro depósito (ou o saldo que tem hoje) e as partidas. As partidas importadas em Minhas mãos entram aqui sozinhas; os resumos de torneio da GGPoker trazem buy-in e prêmio.`}</p>` : ''}
    ${pend.length ? `<h3 class="dgroup">${tx`Falta completar`} (${pend.length})</h3>
      ${pendNames.length ? `<div class="bname">${pendNames.map(n => `<label><span>${n}</span><input type="number" min="0" step="0.01" inputmode="decimal" placeholder="${tx`buy-in`} US$" data-nb="${encodeURIComponent(n)}"></label>`).join('')}<button class="chip" type="button" id="nbSave">${tx`Aplicar buy-ins`}</button></div>` : ''}
      <p class="muted">${pend.some(e => e.format === 'spin' && e.place === 1) ? tx`Spins que você ganhou: toque na partida e informe o multiplicador (x2, x3…).` + ' ' : ''}${tx`Importe também o resumo do torneio (Tournament Summary) para o prêmio entrar sozinho, ou toque na partida para completar.`}</p>` : ''}
    ${st.curve.length > 1 ? `<div class="curve-box">${bankCurveSVG(st.curve)}</div>` : ''}
    ${fmts.length ? `<h3 class="dgroup">${tx`Por formato`}</h3><div class="tscroll"><table class="stbl"><thead><tr><th>${tx`Formato`}</th><th class="num">${tx`Partidas`}</th><th class="num">${tx`Investido`}</th><th class="num">${tx`Lucro`}</th><th class="num">ROI</th><th class="num">${tx`Títulos / ITM`}</th></tr></thead><tbody>
      ${fmts.map(([k, f]) => `<tr><td>${E.BANK_FORMAT_PT[k]}</td><td class="num">${f.n}</td><td class="num">${usd(f.buyins)}</td><td class="num ${f.profit < 0 ? 'neg-t' : f.profit > 0 ? 'pos-t' : ''}">${usdS(f.profit)}</td><td class="num">${k === 'cash' ? (f.bb100 != null ? fmtN(Math.round(f.bb100 * 10) / 10) + ' BB/100' : '–') : pctS(f.roi)}</td><td class="num">${k === 'cash' ? (f.hands || 0) + ' ' + tx`mãos` : k === 'spin' ? fmtN(Math.round(f.wins / f.n * 100)) + '%' : fmtN(Math.round(f.cashes / f.n * 100)) + '%'}</td></tr>`).join('')}
      </tbody></table></div>${st.pending ? `<p class="muted">${tx`${st.pending} partidas incompletas ficam fora da conta até você completar.`}</p>` : ''}<p class="muted">${tx`Num Spin, ganhar 1 em cada 3 é o empate (antes da taxa). Amostras pequenas mentem: o ROI só começa a dizer algo depois de umas 200 partidas.`}</p>` : ''}
    <h3 class="dgroup">${tx`Limite certo para a banca`}</h3>
    <div class="leaks">${stakeAdvice(st, es, cfg)}</div>
    ${list.length ? `<h3 class="dgroup">${tx`Lançamentos`}</h3>
    <div class="hands">${shown.map(e => `
      <button class="hand-row" type="button" data-e="${encodeURIComponent(e.id)}">
        <span class="hr-no">${fmtDate(e.date, e.time || '')}<small>${e.kind === 'deposit' ? tx`Depósito` : e.kind === 'withdraw' ? tx`Saque` : (e.name || E.BANK_FORMAT_PT[e.format])}</small></span>
        <span class="hr-mid">${e.kind === 'game' ? `${E.BANK_FORMAT_PT[e.format]}${e.place ? ' · ' + ordinal(e.place) : ''}${e.mult ? ' · x' + e.mult : ''}${!E.entryDone(e) ? ` · <b class="neg-t">${tx`incompleta`}</b>` : ''}` : (e.note || '')}</span>
        <span class="hr-net ${E.entryDone(e) ? (e.kind === 'withdraw' || E.entryNet(e) < 0 ? 'neg-t' : 'pos-t') : ''}">${e.kind === 'deposit' ? '+' + usd(e.amount) : e.kind === 'withdraw' ? '−' + usd(e.amount) : E.entryDone(e) ? usdS(E.entryNet(e)) : '?'}</span>
      </button>`).join('')}</div>
    ${list.length > shown.length ? `<p><button class="ghost" type="button" id="bankAll">${tx`Ver todos (${list.length})`}</button></p>` : ''}` : ''}
    <details class="bcfg"><summary>${tx`Regras e avisos`}</summary>
      <div class="bgrid">
        ${['spin', 'mtt', 'cash'].map(f => `<label><span>${tx`Mínimo de buy-ins`} · ${E.BANK_FORMAT_PT[f]}</span><input type="number" min="5" max="500" step="5" data-min="${f}" value="${cfg.minBuyins[f]}"></label>`).join('')}
        <label><span>${tx`Stop-loss do dia (buy-ins)`}</span><input type="number" min="0" max="50" step="1" id="cfgStop" value="${cfg.stopLoss}"></label>
        <label><span>${tx`Pausa depois de eliminações seguidas`}</span><input type="number" min="0" max="10" step="1" id="cfgStreak" value="${cfg.streak}"></label>
        <label><span>${tx`Aviso de horário a partir de`}</span><select id="cfgLate">${[[-1, tx`desligado`], [21, '21h'], [22, '22h'], [23, '23h'], [0, '0h'], [1, '1h'], [2, '2h']].map(([v, t]) => `<option value="${v}"${(cfg.lateHour == null ? -1 : cfg.lateHour) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <p class="muted">${tx`Padrão: 50 buy-ins para Spin, 100 para torneio, 30 para cash. São lembretes: o app nunca impede você de jogar.`}</p>
      <div class="seg"><button class="chip" type="button" id="cfgSave">${tx`Salvar regras`}</button></div>
    </details>
    <details class="bcfg"><summary>${tx`Backup`}</summary>
      <p class="muted">${tx`O backup leva a banca, as regras e as mãos importadas. Guarde o texto num lugar seguro (e-mail, notas) para restaurar em outro aparelho.`}</p>
      <div class="seg"><button class="chip" type="button" id="bkCopy">${tx`Copiar backup`}</button>${IS_PWA ? `<button class="chip" type="button" id="bkDown">${tx`Baixar backup`}</button>` : ''}
        <label class="chip"><input type="file" id="bkFile" accept=".json,application/json,text/plain" hidden>${tx`Restaurar de arquivo`}</label></div>
      <textarea id="bkText" rows="3" placeholder="${tx`…ou cole aqui o texto do backup`}"></textarea>
      <div class="seg"><button class="chip" type="button" id="bkRestore">${tx`Restaurar texto colado`}</button><span class="muted" id="bkMsg" aria-live="polite"></span></div>
    </details>`;
  el.querySelectorAll('[data-new]').forEach(b => b.onclick = () => { bankEdit = { kind: b.dataset.new, date: E.localDay(new Date()), time: new Date().toTimeString().slice(0, 5), format: 'spin', isNew: true }; bankDepWarned = false; bankMsg = ''; renderBank(); });
  el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { const e = es.find(x => x.id === decodeURIComponent(b.dataset.e)); if (e) { bankEdit = Object.assign({}, e); bankMsg = ''; renderBank(); } });
  const all = $('bankAll'); if (all) all.onclick = () => { bankShowAll = true; renderBank(); };
  const nb = $('nbSave');
  if (nb) nb.onclick = async () => {
    const c = bankCfg(), upd = [];
    el.querySelectorAll('[data-nb]').forEach(i => { const v = parseFloat(String(i.value).replace(',', '.')); if (i.value !== '' && v >= 0) c.nameBuyin[decodeURIComponent(i.dataset.nb)] = v; });
    saveBankCfg(c);
    for (const e of es) if (e.kind === 'game' && e.buyin == null && c.nameBuyin[e.name] != null) upd.push(E.mergeEntry(null, Object.assign({}, e, { buyin: c.nameBuyin[e.name] })));
    if (upd.length) await idbPut('bank', upd);
    bankMsg = tx`${upd.length} partidas atualizadas.`; await loadBank(); renderBank();
  };
  $('cfgSave').onclick = () => {
    const c = bankCfg();
    el.querySelectorAll('[data-min]').forEach(i => { const v = parseInt(i.value, 10); if (v > 0) c.minBuyins[i.dataset.min] = v; });
    c.stopLoss = Math.max(0, parseInt($('cfgStop').value, 10) || 0);
    c.streak = Math.max(0, parseInt($('cfgStreak').value, 10) || 0);
    const lh = parseInt($('cfgLate').value, 10); c.lateHour = lh < 0 ? null : lh;
    saveBankCfg(c); bankMsg = tx`Regras salvas.`; renderBank();
  };
  bindBackup();
}

function renderBankForm() {
  const el = $('studyBody'), e = bankEdit, isGame = e.kind === 'game';
  const title = e.isNew ? (isGame ? tx`Nova partida` : e.kind === 'deposit' ? tx`Novo depósito` : tx`Novo saque`) : (isGame ? (e.name || tx`Partida`) : e.kind === 'deposit' ? tx`Depósito` : tx`Saque`);
  const v = x => x == null ? '' : String(x);
  el.innerHTML = `
    <div class="rp-head"><button class="ghost" id="bfBack" type="button">← ${tx`Banca`}</button><span class="rp-title">${title}</span></div>
    <form class="bform" id="bForm" novalidate>
      <div class="bgrid">
        <label><span>${tx`Data`}</span><input type="date" name="date" value="${v(e.date)}" required></label>
        ${isGame ? `
        <label><span>${tx`Formato`}</span><select name="format">${E.BANK_FORMATS.map(f => `<option value="${f}"${e.format === f ? ' selected' : ''}>${E.BANK_FORMAT_PT[f]}</option>`).join('')}</select></label>
        <label class="wide"><span>${tx`Nome (opcional)`}</span><input name="name" value="${v(e.name).replace(/"/g, '&quot;')}" placeholder="Spin&Gold #7"></label>
        <label data-for="nc"><span>${tx`Buy-in (US$, 0 se foi ticket)`}</span><input type="number" min="0" step="0.01" inputmode="decimal" name="buyin" value="${v(e.buyin)}"></label>
        <label data-for="nc"><span>${tx`Prêmio (US$)`}</span><input type="number" min="0" step="0.01" inputmode="decimal" name="prize" value="${v(e.prize)}"></label>
        <label data-for="spin"><span>${tx`Multiplicador do Spin`}</span><input type="number" min="0" step="1" inputmode="numeric" name="mult" value="${v(e.mult)}" placeholder="2"></label>
        <label data-for="nc"><span>${tx`Colocação`}</span><input type="number" min="1" step="1" inputmode="numeric" name="place" value="${v(e.place)}"></label>
        <label data-for="cash"><span>${tx`Resultado (US$, negativo se perdeu)`}</span><input type="number" step="0.01" inputmode="decimal" name="net" value="${v(e.net)}"></label>`
        : `<label><span>${tx`Valor (US$)`}</span><input type="number" min="0" step="0.01" inputmode="decimal" name="amount" value="${v(e.amount)}" required></label>
        <label class="wide"><span>${tx`Observação`}</span><input name="note" value="${v(e.note).replace(/"/g, '&quot;')}"></label>`}
      </div>
      <p class="bwarn ok" id="bfWarn" hidden></p>
      <div class="seg"><button class="primary" type="submit" id="bfSave">${tx`Salvar`}</button>${e.isNew ? '' : `<button class="ghost" type="button" id="bfDel">${tx`Apagar lançamento`}</button>`}<span class="muted" id="bfMsg" aria-live="polite"></span></div>
    </form>`;
  const f = $('bForm');
  const sync = () => {
    if (!isGame) return;
    const fmt = f.format.value;
    f.querySelectorAll('[data-for]').forEach(l => { const w = l.dataset.for; l.hidden = w === 'cash' ? fmt !== 'cash' : w === 'spin' ? fmt !== 'spin' : fmt === 'cash'; });
  };
  if (isGame) f.format.onchange = sync; sync();
  $('bfBack').onclick = () => { bankEdit = null; renderBank(); };
  const num = x => { if (x == null || String(x).trim() === '') return null; const n = parseFloat(String(x).replace(',', '.')); return isNaN(n) ? null : n; };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const msg = $('bfMsg'), date = f.date.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { msg.textContent = tx`Escolha a data.`; return; }
    const out = Object.assign({}, e, { date }); delete out.isNew;
    if (!out.id) out.id = 'M' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (isGame) {
      const ed = Object.assign({}, e.edited);
      out.format = f.format.value; out.name = f.elements.name.value.trim();
      for (const k of ['buyin', 'prize', 'mult', 'place', 'net']) { const nv = num(f.elements[k].value); if (nv !== (e[k] ?? null)) ed[k] = true; out[k] = nv; }
      if (out.format === 'spin' && out.mult && out.buyin != null && out.place === 1 && (out.prize == null || ed.mult)) out.prize = Math.round(out.mult * out.buyin * 100) / 100;
      if (out.format === 'spin' && out.place && out.place > 1 && out.prize == null) out.prize = 0;
      if (ed.format !== true && out.format !== e.format) ed.format = true;
      out.edited = ed;
      if (out.format !== 'cash' && out.buyin == null) { msg.textContent = tx`Falta o buy-in (use 0 se foi ticket ou freeroll).`; return; }
      if (out.format === 'cash' && out.net == null) { msg.textContent = tx`Falta o resultado.`; return; }
    } else {
      out.amount = num(f.amount.value); out.note = f.note.value.trim();
      if (!(out.amount > 0)) { msg.textContent = tx`Digite o valor.`; return; }
      if (out.kind === 'deposit' && e.isNew && !bankDepWarned) {
        const w = E.depositCheck(bankEntries);
        if (w) { const b = $('bfWarn'); b.textContent = w; b.hidden = false; bankDepWarned = true; $('bfSave').textContent = tx`Depositar mesmo assim`; return; }
      }
    }
    await idbPut('bank', [out]);
    bankEdit = null; bankMsg = tx`Salvo.`; await loadBank(); renderBank();
  };
  const del = $('bfDel');
  if (del) del.onclick = () => { del.outerHTML = `<span class="confirm">${tx`Apagar este lançamento?`} <button class="chip" id="bfYes" type="button">${tx`Apagar`}</button> <button class="chip" id="bfNo" type="button">${tx`Cancelar`}</button></span>`; $('bfYes').onclick = async () => { await idbDel('bank', [e.id]); bankEdit = null; bankMsg = tx`Apagado.`; await loadBank(); renderBank(); }; $('bfNo').onclick = renderBankForm; };
}

// ---- backup em JSON: banca, regras e mãos importadas ----
async function bankBackup() {
  let cfg = {}; try { cfg = JSON.parse(localStorage.getItem(BANK_CFG_KEY) || '{}'); } catch (e) {}
  return JSON.stringify({ app: 'mesa-de-treino', v: 1, at: new Date().toISOString(), bank: await idbAll('bank'), cfg, games: await idbAll('games') });
}
async function bankRestore(text) {
  let d; try { d = JSON.parse(text); } catch (e) { return tx`Esse texto não é um backup válido.`; }
  if (!d || d.app !== 'mesa-de-treino') return tx`Esse texto não é um backup da Mesa de Treino.`;
  if (Array.isArray(d.bank) && d.bank.length) await idbPut('bank', d.bank.filter(e => e && e.id));
  if (Array.isArray(d.games) && d.games.length) await idbPut('games', d.games.filter(g => g && g.key));
  if (d.cfg && typeof d.cfg === 'object') { const c = bankCfg(); saveBankCfg(Object.assign({}, c, d.cfg, { nameBuyin: Object.assign({}, c.nameBuyin, d.cfg.nameBuyin) })); }
  bankEntries = null; realGames = null;
  return tx`Backup restaurado: ${(d.bank || []).length} lançamentos e ${(d.games || []).length} partidas.`;
}
function bindBackup() {
  const msg = t => { const m = $('bkMsg'); if (m) m.textContent = t; };
  $('bkCopy').onclick = () => {
    // o texto é montado antes do clique ser "gasto": guardamos uma cópia pronta
    const txt = bankBackupCache;
    const fallback = () => { const ta = $('bkText'); ta.value = txt; ta.select(); msg(tx`Não deu para copiar sozinho: o texto está selecionado na caixa, copie com Ctrl+C.`); };
    if (!txt) { msg(tx`Preparando… toque de novo.`); return; }
    try { navigator.clipboard.writeText(txt).then(() => msg(tx`Backup copiado (${Math.round(txt.length / 1024)} KB).`), fallback); } catch (e) { fallback(); }
  };
  bankBackup().then(t => { bankBackupCache = t; });
  const dn = $('bkDown');
  if (dn) dn.onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await bankBackup()], { type: 'application/json' })); a.download = `mesa-de-treino-backup-${E.localDay(new Date())}.json`; a.click(); };
  const fi = $('bkFile');
  fi.onchange = async () => { if (!fi.files.length) return; const r = await bankRestore(await fi.files[0].text()); bankMsg = r; await loadBank(); renderBank(); };
  $('bkRestore').onclick = async () => { const t = $('bkText').value.trim(); if (!t) { msg(tx`Cole o texto do backup na caixa.`); return; } const r = await bankRestore(t); bankMsg = r; await loadBank(); renderBank(); };
}
let bankBackupCache = '';
