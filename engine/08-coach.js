// ---------- Tamanho da aposta ----------
function boardWet(board) {
  if (board.length < 3 || board.length >= 5) return false;
  const sc = [0, 0, 0, 0];
  for (const c of board) sc[suitOf(c)]++;
  if (Math.max(...sc) >= 2) return true;
  const rs = [...new Set(board.map(rankOf))].sort((a, b) => a - b);
  for (let i = 0; i + 2 < rs.length; i++) if (rs[i + 2] - rs[i] <= 4) return true;
  return false;
}
// c: {street, raises, to, currentBet, pot, toCall, isBet, bb, limpers, maxTo, st, draws, board}
function gradeSizing(c) {
  const P = x => Math.round(x * 100) + '%';
  if (c.street === 'preflop') {
    if (c.stackBB && c.stackBB <= PUSH_DEPTH && c.to < c.maxTo) return { grade: 'ok', text: `Com ${Math.round(c.stackBB)} BB, prefira all-in: um aumento menor te deixa preso no pote sem tirar ninguém da mão.` };
    if (c.stackBB && c.stackBB <= PUSH_DEPTH) return { grade: 'good', text: `All-in com ${Math.round(c.stackBB)} BB: o tamanho certo para stack curto.` };
    if (c.raises === 0) {
      const x = c.to / c.bb, std = c.nAct === 2 ? 2.5 : 3 + c.limpers;
      const stdTxt = std.toString().replace('.', ',');
      if (c.to >= c.maxTo && x > 25) return { grade: 'ok', text: `All-in de ${Math.round(x)} BB para roubar ${c.bb * 1.5} fichas: arrisca muito para ganhar pouco. O padrão é ${stdTxt} BB.` };
      if (x < (c.nAct === 2 ? 1.9 : 2.2)) return { grade: 'ok', text: `Aumento mínimo dá ótimas odds para pagarem. O padrão é ${stdTxt} BB${c.limpers ? ` (3 BB + 1 por limper)` : ''}.` };
      if (x > std + 2.5) return { grade: 'ok', text: `${Math.round(x)} BB é grande demais: só mãos fortes continuam. O padrão é ${stdTxt} BB.` };
      return { grade: 'good', text: `${(Math.round(x * 2) / 2).toString().replace('.', ',')} BB é um tamanho padrão de abertura.` };
    }
    const x = c.to / c.currentBet;
    if (x < 2.2) return { grade: 'ok', text: `Re-aumento pequeno (${x.toFixed(1).replace('.', ',')}×) dá odds boas para pagar. Use cerca de 3×.` };
    if (x > 4.5 && c.to < c.maxTo) return { grade: 'ok', text: `Re-aumento de ${x.toFixed(1).replace('.', ',')}× é grande demais: só mãos melhores continuam. Use cerca de 3×.` };
    return { grade: 'good', text: `Re-aumento de ${x.toFixed(1).replace('.', ',')}×, tamanho padrão.` };
  }
  const frac = c.isBet ? c.to / c.pot : (c.to - c.currentBet) / (c.pot + c.toCall);
  const F = P(frac) + (c.isBet ? ' do pote' : ' do pote no aumento');
  const wet = boardWet(c.board);
  const semi = c.st < 0.6 && c.draws && c.draws.some(d => d.outs >= 8);
  if (c.st >= 0.6) {
    if (frac < 0.33) return { grade: 'ok', text: `Aposta de ${F} é pequena para mão forte: mãos piores pagariam mais.${wet ? ' E projetos pagam barato para tentar te passar.' : ''}` };
    if (wet && frac < 0.5) return { grade: 'ok', text: `Aposta de ${F} protege pouco: o board tem projetos possíveis. Aposte pelo menos meio pote para cobrar caro deles.` };
    if (frac > 1.3 && c.st < 0.85) return { grade: 'ok', text: `Aposta de ${F} é grande demais para esta mão: só mãos melhores pagam.` };
    return { grade: 'good', text: `Aposta de ${F}: bom tamanho para valor${wet ? ' e proteção' : ''}.` };
  }
  if (semi) {
    if (frac < 0.4) return { grade: 'ok', text: `Semi-blefe de ${F} é barato de pagar. Apostando mais, você ganha mais vezes na hora e ainda tem outs.` };
    if (frac > 1.2) return { grade: 'ok', text: `Semi-blefe de ${F} arrisca muito; 50–80% do pote costuma bastar.` };
    return { grade: 'good', text: `Semi-blefe de ${F}: bom tamanho. Você ganha se eles desistirem ou se completar o projeto.` };
  }
  if (c.st < 0.35) {
    if (frac > 1.1) return { grade: 'ok', text: `Blefe de ${F} é caro: se der errado, perde muito. 40–75% do pote costuma bastar.` };
    if (frac < 0.3) return { grade: 'ok', text: `Blefe de ${F} é barato demais: fica fácil pagar.` };
    return { grade: 'good', text: `Tamanho razoável para blefe (${F}).` };
  }
  if (frac > 0.9) return { grade: 'ok', text: `Aposta de ${F} com mão média: só mãos melhores continuam. Prefira 33–60% do pote.` };
  return { grade: 'good', text: `Aposta de ${F}: tamanho moderado, adequado para mão média.` };
}
const ACT_PT = { fold: 'desistir', check: 'passar', call: 'pagar', raise: 'aumentar' };

function gradePreflop(adv, action, L) {
  const a = action === 'check' && !L.canCheck ? 'call' : action;
  if (a === 'fold' && L.canCheck) return { grade: 'bad', title: 'Desistiu de graça', text: 'Você podia passar sem pagar nada. Desistir nunca é melhor que passar de graça.' };
  if (a === adv.rec) return { grade: 'good', title: 'Boa decisão', text: adv.why };
  const r = adv.rec, gap = adv.s - adv.t;
  if ((r === 'raise' && a === 'call') || (r === 'call' && a === 'raise') || (r === 'check' && a === 'call')) return { grade: 'ok', title: `Aceitável; o ideal era ${ACT_PT[r]}`, text: adv.why };
  if (r === 'check' && a === 'raise') return { grade: 'ok', title: 'Aumento leve', text: adv.why };
  if (a === 'fold') return gap >= 2 ? { grade: 'bad', title: `Desistiu de mão boa; o ideal era ${ACT_PT[r]}`, text: adv.why } : { grade: 'ok', title: `Um pouco apertado; dava para ${ACT_PT[r]}`, text: adv.why };
  return adv.s >= adv.t - 1 ? { grade: 'ok', title: 'Mão no limite', text: adv.why } : { grade: 'bad', title: `Mão fraca demais: o ideal era ${ACT_PT[r]}`, text: adv.why };
}

// Projetos (draws) e outs, para o coach ensinar a regra do 2 e 4
function drawsOf(hole, board) {
  if (board.length < 3 || board.length > 4) return [];
  const all = [...hole, ...board];
  const cur = catOf(evalHand(all));
  const out = [];
  if (cur < 5) {
    const sc = [0, 0, 0, 0];
    for (const c of all) sc[suitOf(c)]++;
    for (let s = 0; s < 4; s++) if (sc[s] === 4 && hole.some(c => suitOf(c) === s)) out.push({ name: 'Projeto de flush', outs: 9 });
  }
  if (cur < 4) {
    let mask = 0; for (const c of all) mask |= 1 << rankOf(c);
    let hm = 0; for (const c of hole) hm |= 1 << rankOf(c);
    let n = 0;
    for (let r = 0; r < 13; r++) {
      if (mask & (1 << r)) continue;
      const m = mask | (1 << r);
      const h = straightHigh(m);
      if (h < 0) continue;
      // a sequência precisa usar alguma carta sua
      let bm = 0; for (const c of board) bm |= 1 << rankOf(c);
      if (straightHigh(bm | (1 << r)) === h) continue;
      n++;
    }
    if (n >= 2) out.push({ name: 'Sequência aberta', outs: 8 });
    else if (n === 1) out.push({ name: 'Gutshot (sequência por dentro)', outs: 4 });
  }
  return out;
}

function postflopInfo(g, seat, iters = 1500) {
  const p = g.players[seat], L = g.legal(seat);
  const opps = oppRanges(g, p);
  const eq = equity(p.hole, g.board, opps, iters);
  const pot = g.pot();
  const need = L.toCall > 0 ? L.toCall / (pot + L.toCall) : 0;
  return { eq, need, st: strengthOf(eq, opps.length), nOpp: opps.length, made: handName(evalHand([...p.hole, ...g.board])), notes: g.players.filter(q => q !== p && !q.folded).map(readNote).filter(Boolean), draws: drawsOf(p.hole, g.board), cardsLeft: 5 - g.board.length, toCall: L.toCall, pot };
}
function postflopRec(info) {
  if (info.toCall === 0) return info.st >= 0.62 ? 'raise' : 'check';
  if (info.st >= 0.78) return 'raise';
  return info.eq >= info.need ? 'call' : 'fold';
}
const pct = x => Math.round(x * 100) + '%';
function gradePostflop(info, action, L, street) {
  const { eq, need, st } = info;
  const E = pct(eq), N = pct(need);
  const draw = street !== 'river';
  if (L.canCheck) {
    if (action === 'fold') return { grade: 'bad', title: 'Desistiu de graça', text: 'Ninguém apostou: passar não custa nada e você continua na mão.' };
    if (action === 'check') return st >= 0.75 ? { grade: 'ok', title: 'Deixou valor na mesa', text: `Sua mão é forte (${E} de equity). Apostar faz rivais com mãos piores pagarem.` } : { grade: 'good', title: 'Check razoável', text: `Com ${E} de equity, passar controla o tamanho do pote.` };
    if (st >= 0.6) return { grade: 'good', title: 'Aposta de valor', text: `Com ${E} de equity, você está à frente da maioria das mãos rivais. Apostar cobra delas.` };
    if (st < 0.35) return { grade: 'ok', title: 'Blefe', text: `Só ${E} de equity. Blefe funciona às vezes contra jogadores cautelosos, mas o “Paga tudo” quase nunca desiste.` };
    return { grade: 'ok', title: 'Aposta com mão média', text: `${E} de equity. Mãos médias muitas vezes preferem passar: quem paga sua aposta costuma ter mão melhor.` };
  }
  if (action === 'fold') {
    if (eq >= need + 0.08) return { grade: 'bad', title: 'Desistiu de mão lucrativa', text: `Você precisava de ${N} de equity para pagar e tinha ${E}. No longo prazo, pagar dá lucro.` };
    if (eq >= need - 0.03) return { grade: 'ok', title: 'Decisão no limite', text: `Precisava de ${N}, tinha ${E}. Pagar ou desistir dão resultado parecido.` };
    return { grade: 'good', title: 'Boa desistência', text: `Precisava de ${N} de equity para pagar e tinha só ${E}.` };
  }
  if (action === 'call') {
    if (eq >= need + 0.03) return { grade: 'good', title: 'Call lucrativo', text: `Precisava de ${N} e tinha ${E}. As pot odds justificam pagar.` };
    if (eq >= need - 0.07) return { grade: 'ok', title: 'Call no limite', text: `Precisava de ${N}, tinha ${E}.${draw ? ' Se acertar, você pode ganhar mais nas próximas ruas (odds implícitas).' : ''}` };
    return { grade: 'bad', title: 'Pagou caro demais', text: `Precisava de ${N} de equity e tinha ${E}. Pagar isso repetidamente perde fichas.` };
  }
  if (st >= 0.75) return { grade: 'good', title: 'Aumento por valor', text: `Com ${E} de equity, aumentar faz mãos piores colocarem mais fichas.` };
  if (eq >= need) return { grade: 'ok', title: 'Pagar já bastava', text: `Com ${E} de equity, pagar era lucrativo (precisava de ${N}). Aumentar com mão média isola você contra mãos melhores.` };
  return { grade: 'ok', title: 'Aumento como blefe', text: `Só ${E} de equity (precisava de ${N} para pagar). Blefe-aumento é arriscado; guarde para quando os rivais mostram fraqueza.` };
}
