// ---- Estudo ----
function openStudy(tab) { studyTab = tab; $('study').hidden = false; renderStudy(); $('btnClose').focus(); }
function closeStudy() { $('study').hidden = true; }
function renderStudy() {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === studyTab));
  if (studyTab === 'hands') renderHands();
  else if (studyTab === 'ranges') renderRanges();
  else if (studyTab === 'quiz') renderQuiz();
  else if (studyTab === 'drills') renderDrills();
  else if (studyTab === 'real') renderReal();
  else renderSession();
}

// Mãos + replay
const firstStep = h => { if (!h) return 0; const i = h.snaps.findIndex(s => s.k === 'act'); return i > 0 ? i - 1 : 0; };
function replayView(h, i, showAll) {
  const s = h.snaps[i];
  const showIdx = h.snaps.findIndex(x => x.k === 'show');
  const revealed = showIdx >= 0 && i >= showIdx;
  const wins = new Set(); h.snaps.slice(0, i + 1).forEach(x => { if (x.k === 'win') wins.add(x.seat); });
  const seats = h.names.map((name, k) => {
    const [stack, bet, f, a, tag, out] = s.p[k];
    const mode = out ? 'none' : k === 0 || showAll ? 'up' : f ? 'none' : (revealed && h.shown.includes(k)) ? 'up' : 'back';
    return { name, label: h.labels[k], pos: out ? '' : h.pos[k], stack, bet, folded: !!f, allIn: !!a, out: !!out, tag: wins.has(k) ? tx`Vence` : tag, hole: h.holes[k], mode, turn: s.seat === k && s.k !== 'win', win: wins.has(k) };
  });
  const end = s.k === 'show' || s.k === 'win';
  return { seats, board: s.b, pot: s.pot, street: end ? (h.shown.length ? 'Showdown' : tx`Fim da mão`) : s.k === 'hand' ? tx`Início` : E.STREET_LABEL[s.st], hl: new Set() };
}
function renderHands() {
  const el = $('studyBody');
  if (replay && hands[replay.idx]) return renderReplay();
  replay = null;
  if (!hands.length && !handFilter) { el.innerHTML = `<p class="muted">Jogue uma mão para poder revê-la aqui, passo a passo, com as notas do coach em cada decisão sua.</p>`; return; }
  const shown = hands.map((h, k) => [h, k]).filter(([h]) => !handFilter || handFilter.keys.has(h.key));
  const head = handFilter ? `<div class="rp-opts"><span class="muted">${tx`${handFilter.label}: ${shown.length} ${shown.length === 1 ? tx`mão guardada` : tx`mãos guardadas`}${shown.length ? '' : tx` (só as últimas 25 ficam para o replay)`}.`}</span><button class="chip" id="hfAll" type="button">Mostrar todas</button></div>` : tx`<p class="muted">Últimas ${hands.length} mãos. Toque para rever passo a passo.</p>`;
  el.innerHTML = `${head}<div class="hands">${shown.map(([h, k]) => `
    <button class="hand-row" type="button" data-h="${k}">
      <span class="hr-no">${tx`Mão ${h.no}`}${h.mode ? `<small>${h.mode}</small>` : ''}</span>
      <span class="hr-cards">${h.holes[0].map(c => card(c, 'sm')).join('')}</span>
      <span class="hr-mid"><span class="pos${h.pos[0] === 'BTN' ? ' btn' : ''}">${h.pos[0]}</span><span class="dots">${h.grades.map(g => `<i class="dot ${g}"></i>`).join('')}</span></span>
      <span class="hr-net ${h.net > 0 ? 'pos-t' : h.net < 0 ? 'neg-t' : ''}">${signed(h.net)}</span>
    </button>`).join('')}</div>`;
  const hf = $('hfAll'); if (hf) hf.onclick = () => { handFilter = null; renderHands(); };
  el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const k = +b.dataset.h; replay = { idx: k, i: firstStep(hands[k]), showAll: false }; renderHands(); });
}
function nextMistake(h, from) { for (let k = from + 1; k < h.snaps.length; k++) { const f = h.snaps[k].fb; if (f && f.grade !== 'good') return k; } return -1; }
function renderReplay() {
  const el = $('studyBody'), h = replay.h || hands[replay.idx], n = h.snaps.length, i = replay.i, s = h.snaps[i];
  const nm = nextMistake(h, i);
  const combo = E.comboName(h.holes[0][0], h.holes[0][1]);
  el.innerHTML = `
    <div class="rp-head"><button class="ghost" id="rpBack" type="button">← ${h.real ? tx`Partida` : tx`Mãos`}</button><span class="rp-title">${tx`Mão ${h.no} · <b>${combo}</b> no ${h.pos[0]}`} · <b class="${h.net > 0 ? 'pos-t' : h.net < 0 ? 'neg-t' : ''}">${signed(h.net)}</b></span></div>
    <div class="table mini">${tableHTML(replayView(h, i, replay.showAll), 'md')}</div>
    <div class="step"><span class="step-n">${i + 1}/${n}</span><span>${s.t}</span></div>
    ${s.fb ? fbHTML(s.fb) : ''}
    <div class="ctrls">
      <button class="ctl" id="rpFirst" type="button" aria-label="Início" ${i === 0 ? 'disabled' : ''}>⏮</button>
      <button class="ctl" id="rpPrev" type="button" aria-label="Voltar" ${i === 0 ? 'disabled' : ''}>◀</button>
      <button class="ctl" id="rpNext" type="button" aria-label="Avançar" ${i >= n - 1 ? 'disabled' : ''}>▶</button>
      <button class="ctl" id="rpLast" type="button" aria-label="Fim" ${i >= n - 1 ? 'disabled' : ''}>⏭</button>
    </div>
    <div class="rp-opts">
      ${h.real ? `<span class="muted">${tx`Cartas dos rivais só aparecem quando foram mostradas.`}</span>` : `<label class="switch" for="rpAll">Ver cartas de todos <input type="checkbox" id="rpAll" ${replay.showAll ? 'checked' : ''}></label>`}
      <button class="chip" id="rpErr" type="button" ${nm < 0 ? 'disabled' : ''}>Próximo erro →</button>
    </div>`;
  const go = k => { replay.i = Math.max(0, Math.min(n - 1, k)); renderReplay(); };
  $('rpBack').onclick = () => { if (replay.back) return replay.back(); replay = null; renderHands(); };
  $('rpFirst').onclick = () => go(0); $('rpPrev').onclick = () => go(i - 1);
  $('rpNext').onclick = () => go(i + 1); $('rpLast').onclick = () => go(n - 1);
  $('rpErr').onclick = () => { if (nm >= 0) go(nm); };
  if ($('rpAll')) $('rpAll').onchange = e => { replay.showAll = e.target.checked; renderReplay(); };
}

