// ---- Minhas mãos: históricos reais importados da GGPoker ----
// Guarda no IndexedDB do navegador (tudo fica no aparelho). Cada partida: mãos, decisões avaliadas, nota.
const IDB_NAME = 'mesa-treino-real', IDB_VER = 1;
let realGames = null, realSel = null, realFilter = 'bad', realBusy = '';
function idb() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('sem IndexedDB'));
    const r = indexedDB.open(IDB_NAME, IDB_VER);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'key' }); if (!db.objectStoreNames.contains('bank')) db.createObjectStore('bank', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbAll(store) { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); } catch (e) { return []; } }
async function idbPut(store, items) { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'), os = t.objectStore(store); for (const it of items) os.put(it); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbDel(store, keys) { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction(store, 'readwrite'), os = t.objectStore(store); for (const k of keys) os.delete(k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function loadReal() { realGames = (await idbAll('games')).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); return realGames; }

// lê arquivos .zip/.txt, importa mãos e resumos de torneio
async function importFiles(files) {
  const texts = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) { try { texts.push(...(await E.unzipTexts(await f.arrayBuffer())).map(x => x.text)); } catch (e) { realBusy = tx`Não consegui abrir ${f.name}.`; } }
    else texts.push(await f.text());
  }
  const hhText = texts.filter(t => /Poker Hand #/.test(t)).join('\n');
  const sums = texts.filter(t => !/Poker Hand #/.test(t)).map(E.parseTournamentSummary).filter(Boolean);
  const games = [];
  // análise em blocos para não travar a tela
  const hands = E.parseHandHistory(hhText);
  const byKey = {};
  for (let i = 0; i < hands.length; i++) {
    const h = hands[i];
    const key = h.tour ? 'T' + h.tour.id : 'C' + h.date;
    (byKey[key] = byKey[key] || []).push(h);
  }
  const keys = Object.keys(byKey); let done = 0;
  for (const k of keys) {
    realBusy = tx`Analisando ${done} de ${hands.length} mãos…`; renderRealBusy();
    await new Promise(r => setTimeout(r, 0));
    const gs = E.importParsed(byKey[k], { iters: 400 });
    games.push(...gs); done += byKey[k].length;
  }
  const old = await idbAll('games'), oldBy = Object.fromEntries(old.map(g => [g.key, g]));
  // junta com a mesma partida já importada (mãos novas entram, repetidas não duplicam)
  for (const g of games) {
    const o = oldBy[g.key];
    if (o) { const ids = new Set(o.hands.map(h => h.id)); g.hands = o.hands.concat(g.hands.filter(h => !ids.has(h.id))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); }
    const decs = g.hands.flatMap(x => x.decisions);
    g.score = E.sessionScore(decs);
    g.counts = { good: decs.filter(d => d.grade === 'good').length, ok: decs.filter(d => d.grade === 'ok').length, bad: decs.filter(d => d.grade === 'bad').length };
    if (o && o.sum) g.sum = o.sum;
  }
  for (const s of sums) { const g = games.find(x => x.tourId === s.id) || (oldBy['T' + s.id]); if (g) { g.sum = s; if (!games.includes(g)) games.push(g); } }
  if (games.length) await idbPut('games', games);
  if (typeof bankAfterImport === 'function') await bankAfterImport(games, sums);
  realBusy = games.length ? tx`${games.length} ${games.length === 1 ? tx`partida importada` : tx`partidas importadas`}.` : (realBusy || tx`Nenhuma mão da GGPoker encontrada nesses arquivos.`);
  await loadReal();
  renderReal();
}
function renderRealBusy() { const b = $('realBusy'); if (b) b.textContent = realBusy; }

const gradeWord = g => ({ good: tx`Boa`, ok: 'Ok', bad: tx`Ruim` }[g]);
const actWord = d => d.type === 'fold' ? tx`desistiu` : d.type === 'check' ? tx`passou` : d.type === 'call' ? tx`pagou ${d.toCall}` : d.allIn ? 'all-in' : d.to ? (d.toCall ? tx`aumentou p/ ${d.to}` : tx`apostou ${d.to}`) : tx`aumentou`;
const fmtDate = (d, t) => `${d.slice(8, 10)}/${d.slice(5, 7)} ${t.slice(0, 5)}`;
const worst = ds => ds.some(d => d.grade === 'bad') ? 'bad' : ds.some(d => d.grade === 'ok') ? 'ok' : ds.length ? 'good' : '';

function renderReal() {
  const el = $('studyBody');
  if (replay && replay.h) return renderReplay();
  if (realGames === null) { el.innerHTML = `<p class="muted">${tx`Carregando…`}</p>`; loadReal().then(renderReal); return; }
  if (realSel) return renderRealGame();
  const all = realGames.flatMap(g => g.hands), decs = all.flatMap(h => h.decisions);
  const L = E.findLeaks(all.flatMap(h => h.recs || []), all.map(h => h.hand).filter(Boolean));
  el.innerHTML = `
    <div class="imp">
      <p class="muted">${tx`Baixe o histórico no PokerCraft (GGPoker) e solte aqui o .zip ou o .txt. As mãos são analisadas pelo coach e ficam só neste aparelho.`}</p>
      <label class="imp-drop" id="impDrop"><input type="file" id="impFile" accept=".zip,.txt,text/plain,application/zip" multiple hidden><b>${tx`Escolher arquivos`}</b><span>${tx`ou arraste para cá`}</span></label>
      <p class="muted" id="realBusy" aria-live="polite">${realBusy}</p>
    </div>
    ${realGames.length ? `
    <div class="rsum">
      <div><b>${realGames.length}</b><span>${tx`partidas`}</span></div>
      <div><b>${all.length}</b><span>${tx`mãos`}</span></div>
      <div><b>${fmtN(E.sessionScore(decs) ?? 0)}</b><span>${tx`nota média`}</span></div>
      <div><b>${decs.filter(d => d.grade === 'bad').length}</b><span>${tx`erros`}</span></div>
    </div>
    ${L.length ? `<h3 class="dgroup">${tx`Vazamentos no jogo real`}</h3><div class="leaks">${L.slice(0, 3).map(l => `<div class="leak"><b>${l.title}</b><span>${l.why}</span><span class="muted">${l.todo}</span></div>`).join('')}</div>` : ''}
    <h3 class="dgroup">${tx`Partidas`}</h3>
    <div class="hands">${realGames.map((g, i) => `
      <button class="hand-row rg" type="button" data-g="${i}">
        <span class="hr-no">${fmtDate(g.date, g.time)}<small>${g.name}</small></span>
        <span class="hr-mid"><span class="dots">${['good', 'ok', 'bad'].map(k => `<i class="dot ${k}"></i>${g.counts[k]}`).join(' ')}</span></span>
        <span class="hr-net">${g.sum && g.sum.place ? ordinal(g.sum.place) + ' · ' : ''}${g.score == null ? '–' : fmtN(g.score)}</span>
      </button>`).join('')}</div>
    <p><button class="ghost" id="realClear" type="button">${tx`Apagar mãos importadas`}</button></p>` : ''}`;
  const inp = $('impFile');
  inp.onchange = () => { if (inp.files.length) importFiles([...inp.files]); };
  const dz = $('impDrop');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files.length) importFiles([...e.dataTransfer.files]); };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { realSel = realGames[+b.dataset.g]; renderReal(); });
  const c = $('realClear');
  if (c) c.onclick = () => { c.outerHTML = `<span class="confirm">${tx`Apagar tudo o que foi importado?`} <button class="chip" id="realYes" type="button">${tx`Apagar`}</button> <button class="chip" id="realNo" type="button">${tx`Cancelar`}</button></span>`; $('realYes').onclick = async () => { await idbDel('games', realGames.map(g => g.key)); realBusy = ''; await loadReal(); renderReal(); }; $('realNo').onclick = renderReal; };
}

// curva do stack em BB com as decisões marcadas
function stackCurveSVG(g) {
  const hs = g.hands, W = 680, H = 220, L = 34, R = 10, T = 10, B = 24, n = hs.length;
  const max = Math.max(20, ...hs.map(h => h.stackBB || 0)) * 1.08;
  const x = i => L + (n < 2 ? 0 : i / (n - 1)) * (W - L - R), y = v => T + (1 - v / max) * (H - T - B);
  const path = hs.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.stackBB || 0).toFixed(1)}`).join('');
  const dots = hs.map((h, i) => { const w = worst(h.decisions.filter(d => d.type !== 'fold' || d.grade !== 'good')); return w && (w !== 'good' || h.decisions.some(d => d.allIn || d.push)) ? `<circle cx="${x(i)}" cy="${y(h.stackBB || 0)}" r="6" class="cd ${w}" data-hi="${i}" tabindex="0" role="button" aria-label="${tx`Mão ${i + 1}: ${gradeWord(w)}`}"/>` : ''; }).join('');
  const twelve = y(12);
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx`Stack em big blinds mão a mão`}">
    <rect x="${L}" y="${twelve}" width="${W - L - R}" height="${y(0) - twelve}" class="zone"/>
    <text x="${W - R - 4}" y="${twelve + 14}" text-anchor="end" class="ax">${tx`12 BB: all-in ou desistir`}</text>
    ${[0, 12, Math.round(max / 2)].map(v => `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('')}
    <path d="${path}" class="ln"/>${dots}</svg>`;
}
function renderRealGame() {
  const el = $('studyBody'), g = realSel;
  const items = g.hands.flatMap((h, hi) => h.decisions.map(d => ({ d, h, hi }))).filter(({ d }) => realFilter === 'all' || d.grade === realFilter || (realFilter === 'bad' && d.grade === 'ok' && d.sizing && d.sizing.grade === 'ok'));
  el.innerHTML = `
    <div class="rp-head"><button class="ghost" id="rgBack" type="button">← ${tx`Partidas`}</button><span class="rp-title">${g.name} · ${fmtDate(g.date, g.time)}</span></div>
    <div class="rsum">
      <div><b>${g.score == null ? '–' : fmtN(g.score)}</b><span>${tx`nota`}</span></div>
      <div><b>${g.hands.length}</b><span>${tx`mãos`}</span></div>
      <div><b>${g.counts.good}/${g.counts.ok}/${g.counts.bad}</b><span>${tx`boas / ok / ruins`}</span></div>
      ${g.sum ? `<div><b>${g.sum.place ? ordinal(g.sum.place) : '–'}</b><span>${g.sum.prize ? '$' + g.sum.prize.toFixed(2) : tx`sem prêmio`}</span></div>` : ''}
    </div>
    <div class="curve-box">${stackCurveSVG(g)}</div>
    <div class="filters" role="group" aria-label="${tx`Filtrar decisões`}">${[['bad', tx`Erros`], ['ok', 'Ok'], ['good', tx`Boas`], ['all', tx`Todas`]].map(([k, t]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${realFilter === k}">${t}</button>`).join('')}</div>
    <div class="rdecs">${items.length ? items.map(({ d, h, hi }) => `
      <button class="rdec ${d.grade}" type="button" data-hi="${hi}">
        <span class="rd-cards">${h.cards.map(c => card(c, 'sm')).join('')}</span>
        <span class="rd-body"><span class="rd-meta">${tx`Mão ${hi + 1}`} · ${E.STREET_LABEL[d.street]} · ${d.pos} · ${fmtN(d.stackBB)} BB · <b>${gradeWord(d.grade)}</b>${d.sizing ? ` · ${tx`tamanho`} <b class="sz-${d.sizing.grade}">${gradeWord(d.sizing.grade)}</b>` : ''}</span>
        <b>${actWord(d)}: ${d.title}</b><span class="muted">${d.text || ''}</span>${d.street !== 'preflop' && d.why ? `<span class="rd-why">${d.why}</span>` : ''}${d.sizing && d.sizing.grade !== 'good' ? `<span class="muted">${tx`Tamanho:`} ${d.sizing.text}</span>` : ''}</span>
      </button>`).join('') : `<p class="muted">${tx`Nenhuma decisão nesse filtro.`}</p>`}</div>`;
  $('rgBack').onclick = () => { realSel = null; renderReal(); };
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { realFilter = b.dataset.f; renderRealGame(); });
  const open = hi => { const vh = realReplayHand(g, hi); if (!vh) return; replay = { h: vh, i: firstStep(vh), showAll: false, back: () => { replay = null; renderReal(); } }; renderReplay(); };
  el.querySelectorAll('[data-hi]').forEach(b => { b.onclick = () => open(+b.dataset.hi); b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(+b.dataset.hi); } }; });
}
// mão importada → formato do visualizador (o herói vai para o lugar 0)
function realReplayHand(g, hi) {
  const h = g.hands[hi]; if (!h || !h.raw) return null;
  const r = E.replayHand(h.raw, { iters: 400 });
  if (!r.g) return null;
  const G = r.g, n = G.players.length, hs = r.heroSeat, rot = k => (k + hs) % n;
  const snaps = G.snaps.map(s => Object.assign({}, s, { seat: s.seat < 0 ? s.seat : (s.seat - hs + n) % n, p: [...Array(n).keys()].map(k => s.p[rot(k)]) }));
  for (const d of r.decisions) {
    if (snaps[d.snap]) snaps[d.snap].fb = { street: E.STREET_LABEL[d.street], act: actWord(d), grade: d.grade, title: d.title, text: d.text, why: d.street !== 'preflop' ? d.why : '', sizing: d.sizing };
  }
  const shown = Object.keys(h.raw.shows).map(nm => G.players.findIndex(p => p.name === nm)).filter(k => k >= 0 && k !== hs).map(k => (k - hs + n) % n);
  return { real: true, no: hi + 1, names: [...Array(n).keys()].map(k => k === 0 ? tx`Você` : G.players[rot(k)].name.slice(0, 8)), labels: Array(n).fill(''),
    pos: [...Array(n).keys()].map(k => G.posOf(rot(k)) || ''), holes: [...Array(n).keys()].map(k => G.players[rot(k)].hole.slice()), snaps, shown, net: h.net, grades: h.decisions.map(d => d.grade) };
}
