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
    if (c.stackBB && c.stackBB <= PUSH_DEPTH && c.to < c.maxTo) return { grade: 'ok', text: tx`Com ${Math.round(c.stackBB)} BB, prefira all-in: um aumento menor te deixa preso no pote sem tirar ninguém da mão.` };
    if (c.stackBB && c.stackBB <= PUSH_DEPTH) return { grade: 'good', text: tx`All-in com ${Math.round(c.stackBB)} BB: o tamanho certo para stack curto.` };
    if (c.raises === 0) {
      const x = c.to / c.bb, std = c.nAct === 2 ? 2.5 : 3 + c.limpers;
      const stdTxt = std.toString().replace('.', DEC);
      if (c.to >= c.maxTo && x > 25) return { grade: 'ok', text: tx`All-in de ${Math.round(x)} BB para roubar ${c.bb * 1.5} fichas: arrisca muito para ganhar pouco. O padrão é ${stdTxt} BB.` };
      if (x < (c.nAct === 2 ? 1.9 : 2.2)) return { grade: 'ok', text: tx`Aumento mínimo dá ótimas odds para pagarem. O padrão é ${stdTxt} BB${c.limpers ? tx` (3 BB + 1 por limper)` : ''}.` };
      if (x > std + 2.5) return { grade: 'ok', text: tx`${Math.round(x)} BB é grande demais: só mãos fortes continuam. O padrão é ${stdTxt} BB.` };
      return { grade: 'good', text: tx`${(Math.round(x * 2) / 2).toString().replace('.', DEC)} BB é um tamanho padrão de abertura.` };
    }
    const x = c.to / c.currentBet;
    if (x < 2.2) return { grade: 'ok', text: tx`Re-aumento pequeno (${x.toFixed(1).replace('.', DEC)}×) dá odds boas para pagar. Use cerca de 3×.` };
    if (x > 4.5 && c.to < c.maxTo) return { grade: 'ok', text: tx`Re-aumento de ${x.toFixed(1).replace('.', DEC)}× é grande demais: só mãos melhores continuam. Use cerca de 3×.` };
    return { grade: 'good', text: tx`Re-aumento de ${x.toFixed(1).replace('.', DEC)}×, tamanho padrão.` };
  }
  const frac = c.isBet ? c.to / c.pot : (c.to - c.currentBet) / (c.pot + c.toCall);
  const F = P(frac) + (c.isBet ? tx` do pote` : tx` do pote no aumento`);
  const wet = boardWet(c.board);
  const semi = c.st < 0.6 && c.draws && c.draws.some(d => d.outs >= 8);
  if (c.st >= 0.6) {
    if (frac < 0.33) return { grade: 'ok', text: tx`Aposta de ${F} é pequena para mão forte: mãos piores pagariam mais.${wet ? tx` E projetos pagam barato para tentar te passar.` : ''}` };
    if (wet && frac < 0.5) return { grade: 'ok', text: tx`Aposta de ${F} protege pouco: o board tem projetos possíveis. Aposte pelo menos meio pote para cobrar caro deles.` };
    if (frac > 1.3 && c.st < 0.85) return { grade: 'ok', text: tx`Aposta de ${F} é grande demais para esta mão: só mãos melhores pagam.` };
    return { grade: 'good', text: tx`Aposta de ${F}: bom tamanho para valor${wet ? tx` e proteção` : ''}.` };
  }
  if (semi) {
    if (frac < 0.4) return { grade: 'ok', text: tx`Semi-blefe de ${F} é barato de pagar. Apostando mais, você ganha mais vezes na hora e ainda tem outs.` };
    if (frac > 1.2) return { grade: 'ok', text: tx`Semi-blefe de ${F} arrisca muito; 50–80% do pote costuma bastar.` };
    return { grade: 'good', text: tx`Semi-blefe de ${F}: bom tamanho. Você ganha se eles desistirem ou se completar o projeto.` };
  }
  if (c.st < 0.35) {
    if (frac > 1.1) return { grade: 'ok', text: tx`Blefe de ${F} é caro: se der errado, perde muito. 40–75% do pote costuma bastar.` };
    if (frac < 0.3) return { grade: 'ok', text: tx`Blefe de ${F} é barato demais: fica fácil pagar.` };
    return { grade: 'good', text: tx`Tamanho razoável para blefe (${F}).` };
  }
  if (frac > 0.9) return { grade: 'ok', text: tx`Aposta de ${F} com mão média: só mãos melhores continuam. Prefira 33–60% do pote.` };
  return { grade: 'good', text: tx`Aposta de ${F}: tamanho moderado, adequado para mão média.` };
}
const ACT_PT = { fold: tx`desistir`, check: tx`passar`, call: tx`pagar`, raise: tx`aumentar` };

function gradePreflop(adv, action, L) {
  const a = action === 'check' && !L.canCheck ? 'call' : action;
  if (a === 'fold' && L.canCheck) return { grade: 'bad', title: tx`Desistiu de graça`, text: tx`Você podia passar sem pagar nada. Desistir nunca é melhor que passar de graça.` };
  if (a === adv.rec || (a === 'check' && adv.rec === 'fold')) return { grade: 'good', title: tx`Boa decisão`, text: adv.why };
  if (adv.push) {
    const near = adv.max && Math.abs(adv.max - adv.depth) <= 2;
    if (near) return { grade: 'ok', title: tx`No limite`, text: adv.why };
    return { grade: 'bad', title: tx`O ideal era ${adv.rec === 'raise' ? 'all-in' : ACT_PT[adv.rec]}`, text: adv.why };
  }
  const f = adv.freq, fa = a === 'raise' ? f.raise : a === 'call' ? f.call : f.fold;
  if (fa >= 0.25) return { grade: 'good', title: tx`Jogada mista: também vale`, text: adv.why };
  if (fa > 0) return { grade: 'ok', title: tx`Às vezes, mas não o mais comum`, text: adv.why };
  if (a === 'call' && f.raise > 0) return { grade: 'ok', title: tx`Pagar em vez de aumentar`, text: adv.why };
  if (a === 'raise' && f.call > 0) return { grade: 'ok', title: tx`Aumentou em vez de pagar`, text: adv.why };
  if (a === 'fold') return { grade: f.raise + f.call >= 1 ? 'bad' : 'ok', title: tx`Desistiu; o ideal era ${ACT_PT[adv.rec]}`, text: adv.why };
  // jogou uma mão de fora da faixa: perto da borda é aceitável
  const near = adv.cls && HAND_POS[adv.cls] !== undefined && f.raise + f.call === 0 && edgeNear(adv);
  return near ? { grade: 'ok', title: tx`Fora da faixa, mas perto da borda`, text: adv.why } : { grade: 'bad', title: tx`Fora da faixa: o ideal era ${ACT_PT[adv.rec]}`, text: adv.why };
}
// A mão está a até 5% (na ordem de força) da mão mais fraca que a faixa joga?
function edgeNear(adv) {
  const sc = adv.sc;
  if (!sc) return false;
  const inRange = Object.keys({ ...sc.raise, ...sc.call });
  if (!inRange.length) return false;
  const pct = rangePct({ ...sc.call, ...sc.raise });
  return HAND_POS[adv.cls] <= pct + 0.05;
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
    for (let s = 0; s < 4; s++) if (sc[s] === 4 && hole.some(c => suitOf(c) === s)) out.push({ name: tx`Projeto de flush`, outs: 9 });
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
    if (n >= 2) out.push({ name: tx`Sequência aberta`, outs: 8 });
    else if (n === 1) out.push({ name: tx`Gutshot (sequência por dentro)`, outs: 4 });
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
    if (action === 'fold') return { grade: 'bad', title: tx`Desistiu de graça`, text: tx`Ninguém apostou: passar não custa nada e você continua na mão.` };
    if (action === 'check') return st >= 0.75 ? { grade: 'ok', title: tx`Deixou valor na mesa`, text: tx`Sua mão é forte (${E} de equity). Apostar faz rivais com mãos piores pagarem.` } : { grade: 'good', title: tx`Check razoável`, text: tx`Com ${E} de equity, passar controla o tamanho do pote.` };
    if (st >= 0.6) return { grade: 'good', title: tx`Aposta de valor`, text: tx`Com ${E} de equity, você está à frente da maioria das mãos rivais. Apostar cobra delas.` };
    if (st < 0.35) return { grade: 'ok', title: tx`Blefe`, text: tx`Só ${E} de equity. Blefe funciona às vezes contra jogadores cautelosos, mas o “Paga tudo” quase nunca desiste.` };
    return { grade: 'ok', title: tx`Aposta com mão média`, text: tx`${E} de equity. Mãos médias muitas vezes preferem passar: quem paga sua aposta costuma ter mão melhor.` };
  }
  if (action === 'fold') {
    if (eq >= need + 0.08) return { grade: 'bad', title: tx`Desistiu de mão lucrativa`, text: tx`Você precisava de ${N} de equity para pagar e tinha ${E}. No longo prazo, pagar dá lucro.` };
    if (eq >= need - 0.03) return { grade: 'ok', title: tx`Decisão no limite`, text: tx`Precisava de ${N}, tinha ${E}. Pagar ou desistir dão resultado parecido.` };
    return { grade: 'good', title: tx`Boa desistência`, text: tx`Precisava de ${N} de equity para pagar e tinha só ${E}.` };
  }
  if (action === 'call') {
    if (eq >= need + 0.03) return { grade: 'good', title: tx`Call lucrativo`, text: tx`Precisava de ${N} e tinha ${E}. As pot odds justificam pagar.` };
    if (eq >= need - 0.07) return { grade: 'ok', title: tx`Call no limite`, text: tx`Precisava de ${N}, tinha ${E}.${draw ? tx` Se acertar, você pode ganhar mais nas próximas ruas (odds implícitas).` : ''}` };
    return { grade: 'bad', title: tx`Pagou caro demais`, text: tx`Precisava de ${N} de equity e tinha ${E}. Pagar isso repetidamente perde fichas.` };
  }
  if (st >= 0.75) return { grade: 'good', title: tx`Aumento por valor`, text: tx`Com ${E} de equity, aumentar faz mãos piores colocarem mais fichas.` };
  if (eq >= need) return { grade: 'ok', title: tx`Pagar já bastava`, text: tx`Com ${E} de equity, pagar era lucrativo (precisava de ${N}). Aumentar com mão média isola você contra mãos melhores.` };
  return { grade: 'ok', title: tx`Aumento como blefe`, text: tx`Só ${E} de equity (precisava de ${N} para pagar). Blefe-aumento é arriscado; guarde para quando os rivais mostram fraqueza.` };
}
