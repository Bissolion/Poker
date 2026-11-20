// ---------- Novos tipos de quiz ----------
// Abrir ou desistir: posição e mão, resposta pela tabela (só mãos sem jogada mista)
function quizOpen(rng = Math.random) {
  const pos = pickOf(['UTG', 'MP', 'CO', 'BTN', 'SB'], rng), sc = rangeScenario(pos, 6, 0, null, false, false);
  for (let t = 0; t < 500; t++) {
    const d = shuffle([...Array(52).keys()], rng), cls = classOf(d[0], d[1]), f = sc.raise[cls] || 0;
    if (f > 0 && f < 1) continue;
    // metade das perguntas perto da borda, onde a dúvida é real
    if (rng() < 0.6 && Math.abs(HAND_POS[cls] - rangePct(sc.raise)) > 0.1) continue;
    const ans = f ? 0 : 1;
    return { type: 'open', hole: [d[0], d[1]], prompt: `Todos desistiram até você, no ${POS_LABEL[pos]}. Com ${comboName(d[0], d[1])}, o que fazer?`,
      options: ['Abrir (aumentar)', 'Desistir'], answer: ans,
      explain: `A faixa de abertura do ${POS_LABEL[pos]} tem ${Math.round(rangePct(sc.raise) * 100)}% das mãos, e ${comboName(d[0], d[1])} ${f ? 'está nela' : 'fica de fora'}. Quanto mais jogadores ainda vão agir depois de você, mais apertada é a faixa.` };
  }
  return quizPotOdds(rng);
}
// Textura: seca, molhada, perigosa ou pareada
const TEX = ['Seca', 'Molhada', 'Perigosa', 'Pareada'];
function quizTexture(rng = Math.random) {
  const want = pickOf(TEX, rng);
  for (let t = 0; t < 3000; t++) {
    const d = shuffle([...Array(52).keys()], rng), board = d.slice(0, 3), r = boardRead(board, null);
    if (r.label !== want) continue;
    return { type: 'tex', board, prompt: 'Como é essa mesa (flop)?', options: TEX.slice(), answer: TEX.indexOf(r.label),
      explain: `${r.items.filter(x => x.tag || x.lv !== 'info').map(x => x.text).join(' ') || 'Sem par, sem flush e sem sequência possíveis, e poucos projetos.'} Por isso ela é ${r.label.toLowerCase()}.` };
  }
  return quizPotOdds(rng);
}
// Melhor mão possível (nuts)
function quizNuts(rng = Math.random) {
  for (let t = 0; t < 500; t++) {
    const d = shuffle([...Array(52).keys()], rng), board = d.slice(0, rng() < 0.5 ? 4 : 5), r = boardRead(board, null);
    const nc = catOf(evalHand([...r.nuts.ex, ...board])), right = CAT_PT[nc];
    const pool = CAT_PT.filter((_, i) => i !== nc && i >= 1 && Math.abs(i - nc) <= 3);
    if (pool.length < 3) continue;
    const opts = shuffle([right, ...shuffle(pool.slice(), rng).slice(0, 3)], rng).map(x => x[0].toUpperCase() + x.slice(1));
    return { type: 'nuts', board, prompt: 'Qual é a melhor mão possível com essa mesa?', options: opts, answer: opts.indexOf(right[0].toUpperCase() + right.slice(1)),
      explain: `A melhor mão possível é ${r.nuts.name}, por exemplo com ${r.nuts.ex.map(cardStr).join(' ')}. ${r.items.filter(x => x.lv === 'made').map(x => x.text).join(' ')}` };
  }
  return quizPotOdds(rng);
}
// Combinações de mãos
function quizCombos(rng = Math.random) {
  const Q = [
    ['Quantas combinações de AK existem (mesmo naipe ou não)?', 16, '4 ases × 4 reis = 16: 4 do mesmo naipe e 12 de naipes diferentes.'],
    ['Quantas combinações de um par específico, como 99, existem?', 6, 'São 4 noves; escolhendo 2 deles: 4 × 3 ÷ 2 = 6.'],
    ['Quantas combinações de AK do mesmo naipe (AKs) existem?', 4, 'Uma por naipe: 4.'],
    ['Quantas combinações de AK de naipes diferentes (AKo) existem?', 12, '16 combinações de AK menos as 4 do mesmo naipe = 12.'],
    ['Há um ás na mesa. Quantas combinações de AK sobram para o rival?', 12, 'Sobram 3 ases: 3 × 4 reis = 12.'],
    ['Há um rei na mesa. Quantas combinações de KK sobram?', 3, 'Sobram 3 reis; escolhendo 2: 3 × 2 ÷ 2 = 3.'],
    ['Você tem um ás. Quantas combinações de AA o rival pode ter?', 3, 'Sobram 3 ases: 3 combinações de par.'],
  ];
  const [prompt, ans, why] = pickOf(Q, rng);
  const opts = choices(ans, [3, 4, 6, 8, 9, 12, 16, 24].filter(x => x !== ans), rng, 4, 1);
  return { type: 'combos', prompt, options: opts.map(String), answer: opts.indexOf(ans), explain: why + ' Contar combinações mostra quanto da faixa do rival é cada tipo de mão.' };
}
// Defesa mínima
function quizMDF(rng = Math.random) {
  const fr = pickOf([[1 / 3, '1/3 do pote'], [1 / 2, 'meio pote'], [2 / 3, '2/3 do pote'], [3 / 4, '3/4 do pote'], [1, 'o pote inteiro'], [2, 'o dobro do pote']], rng);
  const mdf = Math.round(1 / (1 + fr[0]) * 100);
  const opts = choices(mdf, [mdf - 15, mdf + 12, mdf - 25, 100 - mdf, Math.round(fr[0] / (1 + 2 * fr[0]) * 100)].filter(x => x > 5 && x < 99 && x !== mdf), rng, 4, 4);
  return { type: 'mdf', prompt: `O rival aposta ${fr[1]} no river. Com que frequência você precisa continuar para ele não lucrar blefando com qualquer coisa?`,
    options: opts.map(x => x + '%'), answer: opts.indexOf(mdf),
    explain: `Defesa mínima = pote ÷ (pote + aposta) = 1 ÷ (1 + ${String(Math.round(fr[0] * 100) / 100).replace('.', ',')}) ≈ ${mdf}%. Quanto maior a aposta, menos você precisa defender.` };
}
