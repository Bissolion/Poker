// Sessão
function renderSession() {
  const s = stats, n = s.good + s.ok + s.bad;
  const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const T = s.tourneys || [];
  const wins = T.filter(t => t.place === 1).length;
  const avg = T.length ? (T.reduce((a, t) => a + t.place, 0) / T.length).toFixed(1).replace('.', ',') + 'º' : '–';
  $('studyBody').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${s.hands}</div><div class="l">Mãos</div></div>
      <div class="stat"><div class="v ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}">${signed(s.net)}</div><div class="l">Saldo no cash</div><div class="h">${Math.round(s.net / 10)} big blinds</div></div>
      <div class="stat"><div class="v">${pc(s.good, n)}</div><div class="l">Decisões boas</div><div class="h">${n} analisadas</div></div>
      <div class="stat"><div class="v">${pc(s.vpip, s.hands)}</div><div class="l">VPIP</div><div class="h">ideal 18–28% em 6</div></div>
      <div class="stat"><div class="v">${pc(s.pfr, s.hands)}</div><div class="l">PFR</div><div class="h">perto do VPIP</div></div>
      <div class="stat"><div class="v">${s.rebuys}</div><div class="l">Recompras</div></div>
    </div>
    ${n ? `<div class="gradebar" role="img" aria-label="Boas ${s.good}, ok ${s.ok}, erros ${s.bad}"><i style="width:${s.good / n * 100}%;background:var(--good)"></i><i style="width:${s.ok / n * 100}%;background:var(--ok)"></i><i style="width:${s.bad / n * 100}%;background:var(--bad)"></i></div>
    <div class="legend"><span style="--c:var(--good)">Boas ${s.good}</span><span style="--c:var(--ok)">Ok ${s.ok}</span><span style="--c:var(--bad)">Erros ${s.bad}</span></div>` : ''}
    <h3>Torneios</h3>
    ${T.length ? `<div class="stats">
      <div class="stat"><div class="v">${T.length}</div><div class="l">Jogados</div></div>
      <div class="stat"><div class="v">${wins}</div><div class="l">Vitórias</div></div>
      <div class="stat"><div class="v">${avg}</div><div class="l">Colocação média</div></div>
    </div>
    <div class="tlist">${T.slice(0, 8).map(t => `<div class="trow"><span class="place${t.place === 1 ? ' first' : ''}">${ordinal(t.place)}</span><span>de ${t.n}${t.hu ? ' (heads-up)' : ''} · ${(E.SKILLS[t.skill] || E.SKILLS.normal).label} · ${plural(t.hands, 'mão', 'mãos')}</span></div>`).join('')}</div>` : '<p class="muted">Nenhum torneio terminado ainda. Comece um em Jogo → Torneio.</p>'}
    <h3>Últimas decisões</h3>
    <div class="fb">${s.recent.length ? s.recent.map(r => `<div class="fb-item ${r.grade}"><span class="pill ${r.grade}">${GRADE_PT[r.grade]}</span><span class="fb-title">${r.title}</span><span class="fb-meta">Mão ${r.h} · ${r.street} · ${r.combo} · ${r.act}</span></div>`).join('') : '<p class="muted">Jogue algumas mãos para ver seu histórico aqui.</p>'}</div>
    <div><button class="danger" id="btnReset" type="button">Zerar estatísticas e mãos</button></div>`;
  const br = $('btnReset');
  br.onclick = () => {
    if (!br.classList.contains('armed')) { br.classList.add('armed'); br.textContent = 'Toque de novo para confirmar'; return; }
    stats = blank(); hands = []; replay = null; save(); saveHands(); renderSession();
  };
}

$('table').addEventListener('click', e => {
  const t = e.target.closest('[data-str]');
  if (!t) return;
  strOpen = t.dataset.str === 'close' ? false : t.dataset.str; renderTable();
  const f = $('table').querySelector(strOpen ? '.str-x' : '.str'); if (f) f.focus();
});
$('btnGame').onclick = openSetup;
$('btnSetupClose').onclick = closeSetup;
$('btnStudy').onclick = () => openStudy(studyTab);
$('btnClose').onclick = closeStudy;
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { studyTab = t.dataset.tab; renderStudy(); });
$('study').addEventListener('click', e => { if (e.target.id === 'study') closeStudy(); });
$('setup').addEventListener('click', e => { if (e.target.id === 'setup') closeSetup(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeStudy(); closeSetup(); if (strOpen) { strOpen = false; renderTable(); } return; }
  if ($('study').hidden) return;
  if (studyTab === 'hands' && replay && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const n = hands[replay.idx].snaps.length;
    replay.i = Math.max(0, Math.min(n - 1, replay.i + (e.key === 'ArrowRight' ? 1 : -1))); renderReplay();
  }
});
$('liveHelp').onchange = e => { liveHelp = e.target.checked; save(); render(); };

newGame(cfg);
