// Quiz
const QCATS = [['mix', 'Misturado'], ['pot', 'Pot odds'], ['outs', 'Outs'], ['win', 'Qual ganha'], ['open', 'Abrir?'], ['tex', 'Textura'], ['nuts', 'Nuts'], ['combos', 'Combinações'], ['mdf', 'Defesa mínima']];
const QTYPE = { pot: 'Pot odds', outs: 'Contagem de outs', win: 'Qual mão ganha', open: 'Abrir ou desistir', tex: 'Textura da mesa', nuts: 'Melhor mão possível', combos: 'Combinações', mdf: 'Defesa mínima' };
const QGEN = { pot: () => E.quizPotOdds(), outs: () => E.quizOuts(), win: () => E.quizWinner(), open: () => E.quizOpen(), tex: () => E.quizTexture(), nuts: () => E.quizNuts(), combos: () => E.quizCombos(), mdf: () => E.quizMDF() };
const QKEYS = Object.keys(QGEN);
function newQuestion() {
  const t = quiz.cat === 'mix' ? QKEYS[Math.floor(Math.random() * QKEYS.length)] : quiz.cat;
  quiz.q = QGEN[t]();
  quiz.picked = null;
}
function renderQuiz() {
  const el = $('studyBody'), z = stats.quiz;
  if (!quiz.q) newQuestion();
  const q = quiz.q, done = quiz.picked != null;
  const tot = QKEYS.reduce((a, k) => [a[0] + z[k][0], a[1] + z[k][1]], [0, 0]);
  const catScore = k => z[k][1] ? `${z[k][0]}/${z[k][1]}` : '–';
  let felt = '';
  if (q.type === 'open') felt = `<div class="qfelt"><div class="qrow"><span class="qlabel">Você</span>${q.hole.map(c => card(c, 'md')).join('')}</div></div>`;
  if (q.type === 'tex' || q.type === 'nuts') felt = `<div class="qfelt"><div class="qrow"><span class="qlabel">Mesa</span>${q.board.map(c => card(c, 'md')).join('')}</div></div>`;
  if (q.type === 'outs') felt = `<div class="qfelt"><div class="qrow"><span class="qlabel">Mesa</span>${q.board.map(c => card(c, 'md')).join('')}</div><div class="qrow"><span class="qlabel">Você</span>${q.hole.map(c => card(c, 'md')).join('')}</div></div>`;
  if (q.type === 'win') {
    const hand = k => {
      const best = done ? new Set(q.best[k]) : null;
      const name = done ? `<span class="qhand-name">${E.handName(E.evalHand([...q.hands[k], ...q.board]))}</span>` : '';
      return `<div class="qrow"><span class="qlabel">Mão ${'AB'[k]}</span>${q.hands[k].map(c => card(c, 'md', best ? (best.has(c) ? 'hl' : 'dim') : '')).join('')}${name}</div>`;
    };
    felt = `<div class="qfelt"><div class="qrow"><span class="qlabel">Mesa</span>${q.board.map(c => card(c, 'md')).join('')}</div>${hand(0)}${hand(1)}</div>`;
  }
  const wide = q.options.some(o => o.length > 8) || q.options.length === 3;
  const optCls = k => !done ? '' : k === q.answer ? ' right' : k === quiz.picked ? ' wrong' : '';
  const right = done && quiz.picked === q.answer;
  el.innerHTML = `
    <div class="seg" role="group" aria-label="Tipo de pergunta">${QCATS.map(([k, l]) => `<button type="button" class="chip" data-qc="${k}" aria-pressed="${k === quiz.cat}">${l}</button>`).join('')}</div>
    <div class="qscore"><span>Acertos <b>${tot[0]}/${tot[1]}</b></span><span>Sequência <b>${z.streak}</b> (recorde ${z.best})</span><span>${QKEYS.filter(k => z[k][1]).map(k => `${QCATS.find(c => c[0] === k)[1]} ${catScore(k)}`).join(' · ')}</span></div>
    <div class="qcard">
      <span class="qtype">${QTYPE[q.type]}</span>
      ${felt}
      <div class="qprompt">${q.prompt}</div>
      <div class="qopts${wide ? ' wide' : ''}">${q.options.map((o, k) => `<button type="button" class="qopt${optCls(k)}" data-qo="${k}" ${done ? 'disabled' : ''}>${o}</button>`).join('')}</div>
      ${done ? `<div class="qexp${right ? '' : ' miss'}"><b>${right ? 'Certo!' : `Resposta: ${q.options[q.answer]}`}</b><span>${q.explain}</span></div>
      <button class="primary" id="qNext" type="button">Próxima pergunta</button>` : ''}
    </div>`;
  el.querySelectorAll('[data-qc]').forEach(b => b.onclick = () => { quiz.cat = b.dataset.qc; newQuestion(); renderQuiz(); });
  el.querySelectorAll('[data-qo]').forEach(b => b.onclick = () => {
    if (quiz.picked != null) return;
    quiz.picked = +b.dataset.qo;
    const ok = quiz.picked === q.answer;
    z[q.type][1]++; if (ok) { z[q.type][0]++; z.streak++; z.best = Math.max(z.best, z.streak); sfx.chip(); } else { z.streak = 0; sfx.fold(); }
    save(); renderQuiz();
    const n = $('qNext'); if (n) n.focus();
  });
  const n = $('qNext'); if (n) n.onclick = () => { newQuestion(); renderQuiz(); };
}

