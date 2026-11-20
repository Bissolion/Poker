// ---------- Leitura da mão e da mesa ----------
// Nome curto da mão para o quadro da mesa
function shortName(score) {
  const c = catOf(score), R = i => RANK_CH[kOf(score, i)];
  switch (c) {
    case 8: return 'Straight flush';
    case 7: return tx`Quadra de ${R(0)}`;
    case 6: return 'Full house';
    case 5: return 'Flush';
    case 4: return tx`Sequência`;
    case 3: return tx`Trinca de ${R(0)}`;
    case 2: return tx`Dois pares, ${R(0)} e ${R(1)}`;
    case 1: return tx`Par de ${R(0)}`;
    default: return tx`Carta alta ${R(0)}`;
  }
}
// O que você tem: categoria, melhores 5 cartas e as cartas que formam a combinação
function madeHand(hole, board) {
  const all = [...hole, ...board], score = evalHand(all), cat = catOf(score);
  const b5 = best5(all);
  const cnt = {}; for (const c of b5) cnt[rankOf(c)] = (cnt[rankOf(c)] || 0) + 1;
  const core = [4, 5, 8].includes(cat) ? b5.slice() : cat === 0 ? [] : b5.filter(c => cnt[rankOf(c)] >= 2);
  const boardOnly = core.length > 0 && core.every(c => board.includes(c));
  // cartas da combinação primeiro, depois as demais, da maior para a menor
  const inCore = new Set(core), byRank = (x, y) => rankOf(y) - rankOf(x);
  const ordered = [...b5.filter(c => inCore.has(c)).sort(byRank), ...b5.filter(c => !inCore.has(c)).sort(byRank)];
  return { score, cat, name: handName(score), short: shortName(score), best5: ordered, core, boardOnly };
}
// Seus projetos (flush draw, straight draw, gutshot) com outs exatos
const DRAW_EN = { 'Projeto de flush': 'Flush draw', 'Sequência aberta': 'Straight draw', 'Gutshot (sequência por dentro)': 'Gutshot' };
function heroDraws(hole, board) {
  if (board.length < 3 || board.length >= 5) return null;
  if (catOf(evalHand([...hole, ...board])) >= 5) return null;
  const d = drawsOf(hole, board), o = outsSets(hole, board);
  if (!d.length || !o.all.length) return null;
  const n = o.all.length, left = 5 - board.length, unseen = 52 - 2 - board.length;
  const exact = left === 2 ? 1 - ((unseen - n) * (unseen - n - 1)) / (unseen * (unseen - 1)) : n / unseen;
  return { name: d.map(x => DRAW_EN[x.name] || x.name).join(' + '), outs: n, flush: o.F.length, straight: o.S.length, approx: n * (left === 2 ? 4 : 2), exact, left };
}
// O que a mesa permite: flush, sequência, full house, draws e a melhor mão possível
function boardRead(board, hole) {
  const n = board.length, RC = '23456789TJQKA', S = SUIT_CH;
  const items = [];
  // Flush
  const sc = [0, 0, 0, 0]; board.forEach(c => sc[suitOf(c)]++);
  const ms = Math.max(...sc), su = sc.indexOf(ms);
  if (ms >= 5) items.push({ tag: tx`Flush na mesa`, lv: 'made', text: tx`Cinco cartas de ${S[su]} na mesa: todos têm flush, e ganha quem tiver a ${S[su]} mais alta.` });
  else if (ms === 4) items.push({ tag: tx`Flush possível`, lv: 'made', text: tx`Quatro cartas de ${S[su]}: quem tem uma ${S[su]} já fez flush.` });
  else if (ms === 3) items.push({ tag: tx`Flush possível`, lv: 'made', text: tx`Três cartas de ${S[su]}: quem tem duas ${S[su]} já fez flush.${n < 5 ? tx` Quem tem uma ${S[su]} tem flush draw.` : ''}` });
  if (n < 5) {
    const two = [0, 1, 2, 3].filter(k => sc[k] === 2);
    if (two.length) items.push({ tag: 'Flush draw', lv: 'draw', text: tx`${two.map(k => tx`Duas de ${S[k]}`).join(' e ')} na mesa: quem tem duas cartas do naipe tem flush draw (9 outs).` });
  }
  // Sequência
  const bm = board.reduce((m, c) => m | (1 << rankOf(c)), 0);
  const has = r => (bm >> r) & 1;
  const completes = m => straightHigh(m) >= 0;
  if (completes(bm)) items.push({ tag: tx`Sequência na mesa`, lv: 'made', text: tx`A mesa já forma uma sequência: todos têm pelo menos ela.` });
  else {
    const singles = [], pairs = [];
    for (let a = 0; a < 13; a++) if (!has(a) && completes(bm | (1 << a))) singles.push(a);
    for (let a = 0; a < 13; a++) for (let b = a + 1; b < 13; b++) {
      if (has(a) || has(b) || singles.includes(a) || singles.includes(b)) continue;
      if (completes(bm | (1 << a) | (1 << b))) pairs.push([b, a]);
    }
    if (singles.length || pairs.length) {
      const ex = [...singles.sort((x, y) => y - x).map(a => `um ${RC[a]}`), ...pairs.sort((x, y) => y[0] - x[0] || y[1] - x[1]).map(([b, a]) => `${RC[b]}-${RC[a]}`)];
      items.push({ tag: tx`Sequência possível`, lv: 'made', text: tx`Faz sequência quem tem ${ex.slice(0, 5).join(', ')}${ex.length > 5 ? ' e outras' : ''}.` });
    }
    if (n < 5) {
      // quantos valores completam a sequência para cada mão possível
      const outsRanks = m => { let k = 0; for (let r = 0; r < 13; r++) if (!((m >> r) & 1) && completes(m | (1 << r))) k++; return k; };
      const open = [], gut = [];
      for (let a = 0; a < 13; a++) for (let b = a; b < 13; b++) {
        const m = bm | (1 << a) | (1 << b);
        if (completes(m) || (has(a) && has(b))) continue;
        const k = outsRanks(m);
        if (!k || k <= outsRanks(bm)) continue; // o projeto precisa usar carta da mão
        (k >= 2 ? open : gut).push(a === b ? `${RC[b]}${RC[a]}` : `${RC[b]}-${RC[a]}`);
      }
      if (open.length) items.push({ tag: 'Straight draw', lv: 'draw', text: tx`Straight draw aberto (8 outs) para quem tem ${open.reverse().slice(0, 4).join(', ')}${open.length > 4 ? ' e outras' : ''}; gutshot (4 outs) para várias outras.` });
      else if (gut.length) items.push({ tag: 'Gutshot', lv: 'draw', text: tx`Só gutshot (sequência por dentro, 4 outs), por exemplo com ${gut.reverse().slice(0, 3).join(', ')}.` });
    }
  }
  // Pares na mesa
  const rc = {}; board.forEach(c => { rc[rankOf(c)] = (rc[rankOf(c)] || 0) + 1; });
  const trips = Object.keys(rc).filter(r => rc[r] >= 3).map(Number);
  const prs = Object.keys(rc).filter(r => rc[r] === 2).map(Number).sort((a, b) => b - a);
  if (trips.length) items.push({ tag: tx`Trinca na mesa`, lv: 'made', text: tx`Trinca de ${RANK_CH[trips[0]]} na mesa: quem tiver o último ${RANK_CH[trips[0]]} faz quadra, e qualquer par faz full house.` });
  else if (prs.length) items.push({ tag: tx`Mesa pareada`, lv: 'made', text: tx`${prs.map(r => tx`Par de ${RANK_CH[r]}`).join(' e ')} na mesa: quem tem ${prs.map(r => `um ${RANK_CH[r]}`).join(' ou ')} fez trinca; full house e quadra ficam possíveis.` });
  else items.push({ tag: null, lv: 'info', text: tx`Sem par na mesa: trinca só com par na mão (set); full house e quadra ainda não são possíveis.` });
  // Melhor mão possível e quantas mãos ganham da sua
  const used = new Set([...board, ...(hole || [])]);
  const rest = []; for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  const hs = hole ? evalHand([...hole, ...board]) : null;
  let nuts = -1, ex = null, beat = 0, tie = 0, tot = 0;
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) {
    const s2 = evalHand([rest[i], rest[j], ...board]); tot++;
    if (s2 > nuts) { nuts = s2; ex = [rest[i], rest[j]]; }
    if (hs != null) { if (s2 > hs) beat++; else if (s2 === hs) tie++; }
  }
  const madeDanger = items.some(x => x.lv === 'made' && /Flush|Sequência/.test(x.tag || ''));
  const label = madeDanger ? tx`Perigosa` : (trips.length || prs.length) ? tx`Pareada` : items.some(x => x.lv === 'draw') ? tx`Molhada` : tx`Seca`;
  return { items, label, tags: items.filter(x => x.tag).map(x => x.tag), nuts: { name: handName(nuts), ex }, beat, tie, tot, heroNuts: hs != null && hs >= nuts };
}
