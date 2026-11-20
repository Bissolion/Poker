function quizPotOdds(rng = Math.random) {
  const pot = pickOf([60, 80, 100, 120, 150, 200, 240, 300, 400, 500], rng);
  const fr = pickOf([[1 / 3, tx`⅓ do pote`, tx`de ⅓ do pote`], [1 / 2, tx`meio pote`, tx`de meio pote`], [2 / 3, tx`⅔ do pote`, tx`de ⅔ do pote`], [3 / 4, tx`¾ do pote`, tx`de ¾ do pote`], [1, tx`o pote inteiro`, tx`do tamanho do pote`], [2, tx`o dobro do pote`, tx`do dobro do pote`]], rng);
  const bet = Math.max(5, Math.round(pot * fr[0] / 5) * 5);
  const total = pot + 2 * bet, need = Math.round(bet / total * 100);
  const how = tx`Você paga ${bet} para disputar um pote final de ${total} (${pot} + ${bet} do rival + ${bet} seu): ${bet} ÷ ${total} = ${need}%.`;
  if (rng() < 0.55) {
    const pool = [Math.round(bet / pot * 100), Math.round(bet / (pot + bet) * 100), need + 10, need - 8, need + 17, Math.round(need / 2), need + 5].filter(x => x > 2 && x < 98 && x !== need);
    const opts = choices(need, pool, rng, 4, 3);
    return { type: 'pot', prompt: tx`O pote tem ${pot}. O rival aposta ${bet} (${fr[1]}). Qual a equity mínima para pagar?`,
      options: opts.map(x => x + '%'), answer: opts.indexOf(need),
      explain: tx`${how} Atalho: contra uma aposta ${fr[2]}, você precisa de cerca de ${need}%.${bet < pot ? tx` Erro comum: dividir a aposta só pelo pote (${Math.round(bet / pot * 100)}%).` : ''}` };
  }
  let eq = need + pickOf([-16, -11, -7, 7, 11, 16], rng);
  eq = Math.max(4, Math.min(95, eq));
  const ok = eq >= need;
  return { type: 'pot', prompt: tx`O pote tem ${pot} e o rival aposta ${bet} (${fr[1]}). Sua equity é ${eq}%. Pagar é lucrativo?`,
    options: [tx`Pagar: é lucrativo`, tx`Desistir: não compensa`], answer: ok ? 0 : 1,
    explain: tx`${how} Você tem ${eq}%, ${ok ? tx`mais` : tx`menos`} do que precisa: ${ok ? tx`pagar ganha fichas no longo prazo` : tx`pagar perde fichas no longo prazo`}.` };
}

// Cartas que completam flush ou sequência usando suas cartas
function outsSets(hole, board) {
  const all = [...hole, ...board], used = new Set(all);
  const mask = cs => { let m = 0; for (const c of cs) m |= 1 << rankOf(c); return m; };
  const flush = cs => { const sc = [0, 0, 0, 0]; for (const c of cs) sc[suitOf(c)]++; return Math.max(...sc) >= 5; };
  const F = [], S = [];
  for (let c = 0; c < 52; c++) {
    if (used.has(c)) continue;
    const na = [...all, c], nb = [...board, c];
    if (flush(na) && !flush(nb)) F.push(c);
    if (straightHigh(mask(na)) >= 0 && straightHigh(mask(nb)) < 0) S.push(c);
  }
  return { F, S, all: [...new Set([...F, ...S])] };
}
function quizOuts(rng = Math.random) {
  for (let tries = 0; tries < 2000; tries++) {
    const d = shuffle([...Array(52).keys()], rng);
    const hole = [d[0], d[1]], board = d.slice(2, 2 + (rng() < 0.65 ? 3 : 4));
    const cur = catOf(evalHand([...hole, ...board]));
    if (cur >= 4) continue;
    if (new Set(board.map(rankOf)).size < board.length) continue; // sem par na mesa
    const o = outsSets(hole, board), n = o.all.length;
    if (n < 4 || n > 15) continue;
    const left = 5 - board.length, unseen = 52 - 2 - board.length;
    const approx = n * (left === 2 ? 4 : 2);
    const exact = Math.round((left === 2 ? 1 - ((unseen - n) * (unseen - n - 1)) / (unseen * (unseen - 1)) : n / unseen) * 100);
    const parts = [];
    if (o.F.length) parts.push(tx`Flush: ${o.F.length} cartas de ${SUIT_CH[suitOf(o.F[0])]}.`);
    if (o.S.length) {
      const rs = [...new Set(o.S.map(rankOf))].sort((a, b) => b - a).map(r => RANK_CH[r]);
      parts.push(tx`Sequência: ${o.S.length} cartas (qualquer ${rs.join(tx` ou `)}).`);
    }
    const overlap = o.F.length + o.S.length - n;
    const opts = choices(n, [n - 1, n + 1, n - 3, n + 3, 4, 8, 9, 12, 15, n + 2].filter(x => x > 0 && x !== n), rng, 4, 1);
    return { type: 'outs', hole, board, prompt: tx`Quantos outs você tem para completar sequência ou flush?`,
      options: opts.map(String), answer: opts.indexOf(n),
      explain: tx`${parts.join(' ')}${overlap ? tx` ${overlap} ${overlap > 1 ? tx`cartas contam` : tx`carta conta`} nas duas, então o total é ${n}.` : ''} Regra do 2 e 4: ${n} × ${left === 2 ? 4 : 2} ≈ ${approx}% de completar ${left === 2 ? tx`até o river` : tx`no river`} (exato: ${exact}%).` };
  }
  return quizPotOdds(rng);
}

const ORD = LANG === 'en' ? ['1st', '2nd', '3rd', '4th', '5th'] : ['1ª', '2ª', '3ª', '4ª', '5ª'];
function kickDesc(cat, i) {
  switch (cat) {
    case 1: return i === 0 ? tx`o par maior` : tx`o kicker (carta lateral)`;
    case 2: return i === 0 ? tx`o par mais alto` : i === 1 ? tx`o segundo par` : tx`o kicker (carta lateral)`;
    case 3: return i === 0 ? tx`a trinca maior` : tx`o kicker (carta lateral)`;
    case 4: case 8: return tx`a carta mais alta da sequência`;
    case 6: return i === 0 ? tx`a trinca do full house` : tx`o par do full house`;
    case 7: return i === 0 ? tx`a quadra` : tx`o kicker`;
    default: return tx`a ${ORD[i]} carta mais alta`;
  }
}
function quizWinner(rng = Math.random) {
  for (let tries = 0; tries < 3000; tries++) {
    const d = shuffle([...Array(52).keys()], rng);
    const board = d.slice(0, 5), A = [d[5], d[6]], B = [d[7], d[8]];
    const sa = evalHand([...A, ...board]), sb = evalHand([...B, ...board]);
    const ca = catOf(sa), cb = catOf(sb);
    if (ca < 1 || cb < 1 || Math.abs(ca - cb) > 1) continue;
    if (ca !== cb && rng() < 0.6) continue; // prefere desempates na mesma categoria
    const answer = sa > sb ? 0 : sb > sa ? 1 : 2;
    let why;
    if (ca !== cb) why = tx`${CAT_PT[Math.max(ca, cb)][0].toUpperCase() + CAT_PT[Math.max(ca, cb)].slice(1)} vence ${CAT_PT[Math.min(ca, cb)]}.`;
    else if (answer === 2) why = tx`As duas formam a mesma melhor combinação de 5 cartas, então dividem o pote. Só as 5 melhores cartas contam.`;
    else {
      let i = 0; while (kOf(sa, i) === kOf(sb, i)) i++;
      why = tx`Mesma categoria (${CAT_PT[ca]}): desempata ${kickDesc(ca, i)}, ${RANK_CH[kOf(sa, i)]} contra ${RANK_CH[kOf(sb, i)]}.`;
    }
    return { type: 'win', board, hands: [A, B], best: [best5([...A, ...board]), best5([...B, ...board])],
      prompt: tx`Qual mão ganha?`, options: [tx`Mão A`, tx`Mão B`, tx`Empate`], answer,
      explain: `A: ${handName(sa)}. B: ${handName(sb)}. ${why}` };
  }
  return quizPotOdds(rng);
}
