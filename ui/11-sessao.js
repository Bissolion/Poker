// Sessão
function renderSession() {
  const s = stats, n = s.good + s.ok + s.bad;
  const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const T = s.tourneys || [];
  const wins = T.filter(t => t.place === 1).length;
  const avg = T.length ? (T.reduce((a, t) => a + t.place, 0) / T.length).toFixed(1).replace('.', DEC) + 'º' : '–';
  $('studyBody').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${s.hands}</div><div class="l">Mãos</div></div>
      <div class="stat"><div class="v ${s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : ''}">${signed(s.net)}</div><div class="l">Saldo no cash</div><div class="h">${Math.round(s.net / 10)} big blinds</div></div>
      <div class="stat"><div class="v">${pc(s.good, n)}</div><div class="l">Decisões boas</div><div class="h">${tx`${n} analisadas`}</div></div>
      <div class="stat"><div class="v">${pc(s.vpip, s.hands)}</div><div class="l">VPIP</div><div class="h">ideal 18–28% em 6</div></div>
      <div class="stat"><div class="v">${pc(s.pfr, s.hands)}</div><div class="l">PFR</div><div class="h">perto do VPIP</div></div>
      <div class="stat"><div class="v">${s.rebuys}</div><div class="l">Recompras</div></div>
    </div>
    ${n ? `<div class="gradebar" role="img" aria-label="${tx`Boas ${s.good}, ok ${s.ok}, erros ${s.bad}`}"><i style="width:${s.good / n * 100}%;background:var(--good)"></i><i style="width:${s.ok / n * 100}%;background:var(--ok)"></i><i style="width:${s.bad / n * 100}%;background:var(--bad)"></i></div>
    <div class="legend"><span style="--c:var(--good)">${tx`Boas ${s.good}`}</span><span style="--c:var(--ok)">Ok ${s.ok}</span><span style="--c:var(--bad)">${tx`Erros ${s.bad}`}</span></div>` : ''}
    ${leaksHTML()}
    <h3>Torneios</h3>
    ${T.length ? `<div class="stats">
      <div class="stat"><div class="v">${T.length}</div><div class="l">Jogados</div></div>
      <div class="stat"><div class="v">${wins}</div><div class="l">Vitórias</div></div>
      <div class="stat"><div class="v">${avg}</div><div class="l">Colocação média</div></div>
    </div>
    ${T.some(t => t.pts != null) ? tx`<p class="muted">Média de prêmio nos torneios com prêmios: <b style="color:var(--ink)">${Math.round(T.filter(t => t.pts != null).reduce((x, t) => x + t.pts, 0) / T.filter(t => t.pts != null).length)} pontos</b> por torneio (100 = vencer sempre).</p>` : ''}
    <div hidden>
    </div>
    <div class="tlist">${T.slice(0, 8).map(t => `<div class="trow"><span class="place${t.place === 1 ? ' first' : ''}">${ordinal(t.place)}</span><span>${tx`de ${t.n}${t.hu ? ' (heads-up)' : ''}`} · ${(E.SKILLS[t.skill] || E.SKILLS.normal).label} · ${plural(t.hands, tx`mão`, tx`mãos`)}${t.pts != null ? tx` · ${t.pts} pts` : ''}</span></div>`).join('')}</div>` : '<p class="muted">Nenhum torneio terminado ainda. Comece um em Jogo → Torneio.</p>'}
    <h3>Últimas decisões</h3>
    <div class="fb">${s.recent.length ? s.recent.map(r => `<div class="fb-item ${r.grade}"><span class="pill ${r.grade}">${GRADE_PT[r.grade]}</span><span class="fb-title">${r.title}</span><span class="fb-meta">${tx`Mão ${r.h}`} · ${r.street} · ${r.combo} · ${r.act}</span></div>`).join('') : '<p class="muted">Jogue algumas mãos para ver seu histórico aqui.</p>'}</div>
    <div><button class="danger" id="btnReset" type="button">Zerar estatísticas e mãos</button></div>`;
  bindLeaks();
  const br = $('btnReset');
  br.onclick = () => {
    if (!br.classList.contains('armed')) { br.classList.add('armed'); br.textContent = tx`Toque de novo para confirmar`; return; }
    stats = blank(); hands = []; replay = null; reg = { decs: [], hands: [] }; save(); saveHands(); saveReg(); renderSession();
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

// Vazamentos, estatísticas por posição e comparação com a sessão anterior
const fmtStat = (v, f) => v == null ? '–' : f === 'num' ? v.toFixed(1).replace('.', DEC) : pct(v);
const statusOf = (s, d) => s.v == null || s.n < d.min ? 'few' : s.v > d.hi ? 'high' : s.v < d.lo ? 'low' : 'ok';
const ST_PILL = { ok: ['good', tx`Na faixa`], high: ['bad', tx`Alto`], low: ['bad', tx`Baixo`], few: ['ok', tx`Poucos dados`] };
let leakCache = [];
function leaksHTML() {
  const L = E.findLeaks(reg.decs, reg.hands), S = E.leakStats(reg.decs, reg.hands), D = E.STAT_DEF;
  leakCache = L;
  const top = L.slice(0, 3);
  const leakCards = top.length ? top.map((l, i) => `<div class="fb-item bad">
      <span class="pill bad">${i + 1}º</span><span class="fb-title">${l.title}</span>
      <span class="fb-meta">${tx`${l.name}: ${fmtStat(l.value, l.fmt)} · faixa ${fmtStat(l.lo, l.fmt)}–${fmtStat(l.hi, l.fmt)} · ${l.n} situações`}</span>
      <span class="fb-text">${l.why} <b style="color:var(--ink)">O que fazer:</b> ${l.todo}</span>
      <span class="fb-size"><b>Resultado</b>${tx`Nessas mãos você ficou com ${l.net > 0 ? '+' : ''}${String(l.net).replace('.', DEC)} BB.`} <button class="str-link" type="button" data-leak="${i}">Ver no replay</button></span>
    </div>`).join('')
    : `<p class="muted">${reg.hands.length < 60 ? tx`Ainda não há dados suficientes: ${reg.hands.length} mãos registradas. Os vazamentos começam a aparecer depois de umas 60 mãos, e só quando o desvio é claro, não sorte.` : tx`Nenhum vazamento claro: suas estatísticas estão dentro do que as tabelas do app produzem.`}</p>`;
  const row = (id, label) => { const s = S[id], d = D[id], st = statusOf(s, d), [cls, txt] = ST_PILL[st]; return `<tr><td>${label || d.name}</td><td class="num">${fmtStat(s.v, d.fmt)}</td><td class="num">${fmtStat(d.lo, d.fmt)}–${fmtStat(d.hi, d.fmt)}</td><td class="num">${s.n}</td><td><span class="pill ${cls}">${txt}</span></td></tr>`; };
  const posRows = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'].map(p => row('vpip_' + p, E.POS_LABEL[p])).join('');
  const gameRows = ['vpip', 'pfr', 'gap', 'threebet', 'fold3bet', 'cbet', 'foldcbet', 'wtsd', 'wsd', 'af', 'rivercall'].map(id => row(id)).join('');
  // esta sessão x a anterior
  const sess = [...new Set(reg.hands.map(h => h.s))].sort((a, b) => b - a);
  const cur = sess[0] === SESSION ? SESSION : null, prev = sess.find(x => x !== SESSION);
  let cmp = '';
  if (cur && prev) {
    const part = id => ({ d: reg.decs.filter(x => x.s === id), h: reg.hands.filter(x => x.s === id) });
    const A = part(cur), B = part(prev);
    const goodPct = d => d.length ? d.filter(x => x.g === 'good').length / d.length : null;
    const bb = h => h.length ? h.reduce((a, x) => a + x.net, 0) / h.length * 100 : null;
    const sa = E.leakStats(A.d, A.h), sb = E.leakStats(B.d, B.h);
    const line = (label, a, b, f, better) => { const diff = a != null && b != null ? a - b : null; const arrow = diff == null || Math.abs(diff) < (f === 'pct' ? 0.01 : 0.5) ? '' : (better(diff) ? '<span class="pos-t">melhorou</span>' : '<span class="neg-t">piorou</span>'); return `<tr><td>${label}</td><td class="num">${fmtStat(b, f)}</td><td class="num">${fmtStat(a, f)}</td><td>${arrow}</td></tr>`; };
    cmp = `<h3>Esta sessão x a anterior</h3><div class="tscroll"><table class="stbl"><thead><tr><th></th><th class="num">Anterior</th><th class="num">Esta</th><th></th></tr></thead><tbody>
      ${line(tx`Decisões boas`, goodPct(A.d), goodPct(B.d), 'pct', x => x > 0)}
      ${line('VPIP', sa.vpip.v, sb.vpip.v, 'pct', x => Math.abs(sa.vpip.v - 0.21) < Math.abs(sb.vpip.v - 0.21))}
      ${line(tx`Calls certos no river`, sa.rivercall.v, sb.rivercall.v, 'pct', x => x > 0)}
      ${line(tx`BB por 100 mãos`, bb(A.h), bb(B.h), 'num', x => x > 0)}
      </tbody></table></div><p class="muted">${tx`${A.h.length} mãos nesta sessão, ${B.h.length} na anterior.`}</p>`;
  }
  return `<h3>Seus vazamentos</h3><div class="fb">${leakCards}</div>
    <h3>Por posição (mesas de 5 e 6)</h3><div class="tscroll"><table class="stbl"><thead><tr><th>Posição</th><th class="num">VPIP</th><th class="num">Faixa</th><th class="num">Mãos</th><th></th></tr></thead><tbody>${posRows}</tbody></table></div>
    <h3>Estatísticas de jogo</h3><div class="tscroll"><table class="stbl"><thead><tr><th>Estatística</th><th class="num">Você</th><th class="num">Faixa</th><th class="num">Amostra</th><th></th></tr></thead><tbody>${gameRows}</tbody></table></div>
    <p class="muted">A faixa é o que um jogador que segue as tabelas e o coach do app produz contra estes bots. Um desvio só vira vazamento quando a amostra é grande o bastante para não ser sorte.</p>
    ${cmp}
    ${weeklyHTML()}
    <div class="seg"><button class="chip" id="csvCopy" type="button">Copiar histórico em CSV</button>${canDownload() ? '<button class="chip" id="csvDown" type="button">Baixar CSV</button>' : ''}<span class="muted" id="csvMsg"></span></div>`;
}
// Evolução semana a semana: treino aqui no app e partidas reais importadas
const weekOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return E.localDay(x); };
function weeklyHTML() {
  if (realGames === null) loadReal().then(() => { if (studyTab === 'session' && !$('study').hidden) renderStudy(); });
  const W = {};
  const get = k => W[k] || (W[k] = { h: [], d: [], real: [] });
  const byHand = {};
  for (const h of reg.hands) { const k = weekOf(new Date(h.s || 0)); get(k).h.push(h); byHand[h.h] = k; }
  for (const d of reg.decs) { const k = byHand[d.h] || weekOf(new Date(d.s || 0)); get(k).d.push(d); }
  for (const g of realGames || []) { const [y, m, dd] = g.date.split('-').map(Number); if (g.score != null) get(weekOf(new Date(y, m - 1, dd))).real.push(g.score); }
  const keys = Object.keys(W).filter(k => k > '2000').sort().slice(-8);
  if (keys.length < 2) return '';
  const rows = keys.map(k => {
    const w = W[k], good = w.d.length ? w.d.filter(x => x.g === 'good').length / w.d.length : null;
    const bb = w.h.length ? w.h.reduce((a, x) => a + (x.net || 0), 0) / w.h.length * 100 : null;
    const vp = w.h.length ? w.h.filter(x => x.vpip).length / w.h.length : null;
    const real = w.real.length ? w.real.reduce((a, b) => a + b, 0) / w.real.length : null;
    return { k, n: w.h.length, good, bb, vp, real, nr: w.real.length };
  });
  const pts = rows.filter(r => r.good != null), Wd = 300, H = 60;
  const spark = pts.length >= 2 ? `<svg class="spark" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${tx`Decisões boas por semana`}"><path class="ln" d="${pts.map((r, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1) * (Wd - 10) + 5).toFixed(1)},${(H - 5 - r.good * (H - 10)).toFixed(1)}`).join('')}"/></svg>` : '';
  const f1 = v => v == null ? '–' : fmtN(Math.round(v * 10) / 10);
  return `<h3>${tx`Evolução por semana`}</h3>${spark}<div class="tscroll"><table class="stbl"><thead><tr><th>${tx`Semana`}</th><th class="num">${tx`Mãos`}</th><th class="num">${tx`Boas`}</th><th class="num">BB/100</th><th class="num">VPIP</th><th class="num">${tx`Nota real`}</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r.k.slice(8, 10)}/${r.k.slice(5, 7)}</td><td class="num">${r.n}</td><td class="num">${r.good == null ? '–' : pct(r.good)}</td><td class="num">${f1(r.bb)}</td><td class="num">${r.vp == null ? '–' : pct(r.vp)}</td><td class="num">${r.real == null ? '–' : f1(r.real) + ` <small>(${r.nr})</small>`}</td></tr>`).join('')}
    </tbody></table></div><p class="muted">${tx`Boas = decisões que o coach aprovou no treino. Nota real = média das partidas importadas em Minhas mãos naquela semana.`}</p>`;
}
function regCSV() {
  const cols = ['h', 's', 'm', 'st', 'pos', 'n', 'r', 'tc', 'a', 'g', 'opn', 'agg', 'cbo', 'fcb'];
  const hcols = ['h', 's', 'm', 'pos', 'n', 'vpip', 'pfr', 'flop', 'sd', 'won', 'net'];
  const esc = v => v == null ? '' : String(v);
  return ['tipo,' + cols.join(','), ...reg.decs.map(d => 'decisao,' + cols.map(c => esc(d[c])).join(',')), '', 'tipo,' + hcols.join(','), ...reg.hands.map(h => 'mao,' + hcols.map(c => esc(h[c])).join(','))].join('\n');
}
function bindLeaks() {
  document.querySelectorAll('[data-leak]').forEach(b => b.onclick = () => {
    const l = leakCache[+b.dataset.leak];
    handFilter = { label: l.title, keys: new Set(l.hands) }; replay = null;
    studyTab = 'hands'; renderStudy();
  });
  const msg = t => { const m = $('csvMsg'); if (m) m.textContent = t; };
  const cp = $('csvCopy');
  if (cp) cp.onclick = () => {
    const txt = regCSV();
    try { navigator.clipboard.writeText(txt).then(() => msg(tx`Copiado.`), () => msg(tx`Não foi possível copiar aqui.`)); } catch (e) { msg(tx`Não foi possível copiar aqui.`); }
  };
  const dn = $('csvDown');
  if (dn) dn.onclick = async () => { const r = await saveFile('mesa-de-treino.csv', regCSV(), 'text/csv'); if (r) msg(r); };
}
