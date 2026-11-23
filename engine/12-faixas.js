// ---------- Faixas modernas (aproximações próprias, 6 jogadores e heads-up, 100 BB) ----------
// Notação: 22+ (pares do 22 para cima), 77-JJ, A2s+ (A2s até AKs), KTs+ (KTs até KQs), ATo-AJo, KQo, AK (s e o).
// ":0.5" no fim de um item = jogada mista (metade das vezes).
const RC13 = 'AKQJT98765432';
const rv = ch => 12 - RC13.indexOf(ch);
const clsName = (hi, lo, kind) => hi === lo ? RC13[12 - hi] + RC13[12 - lo] : RC13[12 - hi] + RC13[12 - lo] + kind;
function parseRange(str) {
  const out = {};
  const add = (n, f) => { out[n] = Math.max(out[n] || 0, f); };
  for (let tok of str.split(',').map(t => t.trim()).filter(Boolean)) {
    let f = 1;
    if (tok.includes(':')) { const [a, b] = tok.split(':'); tok = a; f = parseFloat(b); }
    const plus = tok.endsWith('+'); if (plus) tok = tok.slice(0, -1);
    if (tok.includes('-')) {
      const [a, b] = tok.split('-');
      if (a[0] === a[1]) { const x = rv(a[0]), y = rv(b[0]); for (let r = Math.min(x, y); r <= Math.max(x, y); r++) add(clsName(r, r), f); }
      else { const hi = rv(a[0]), k = a[2] || '', x = rv(a[1]), y = rv(b[1]); for (let r = Math.min(x, y); r <= Math.max(x, y); r++) for (const kk of k ? [k] : ['s', 'o']) add(clsName(hi, r, kk), f); }
      continue;
    }
    if (tok.length === 2 && tok[0] === tok[1]) { const x = rv(tok[0]); for (let r = x; r <= (plus ? 12 : x); r++) add(clsName(r, r), f); continue; }
    const hi = rv(tok[0]), lo = rv(tok[1]), kinds = tok[2] ? [tok[2]] : ['s', 'o'];
    for (const kk of kinds) for (let r = lo; r <= (plus ? hi - 1 : lo); r++) add(clsName(hi, r, kk), f);
  }
  return out;
}
const CLASS_W = n => n.length === 2 ? 6 : n[2] === 's' ? 4 : 12;
const rangePct = map => Object.entries(map).reduce((a, [n, f]) => a + CLASS_W(n) * f, 0) / 1326;
function classOf(c1, c2) {
  const a = rankOf(c1), b = rankOf(c2), hi = Math.max(a, b), lo = Math.min(a, b);
  return clsName(hi, lo, suitOf(c1) === suitOf(c2) ? 's' : 'o');
}

// Abertura (ninguém entrou) por posição
const RFI_SRC = {
  // mesa de 9: as três primeiras posições, ainda mais fechadas que o UTG de 6
  E1: '66+, A9s+, A5s:0.5, KTs+, QTs+, JTs, AJo+, KQo',
  E2: '55+, A8s+, A5s, KTs+, QTs+, JTs, T9s:0.5, AJo+, KQo',
  E3: '55+, A8s+, A5s-A4s, K9s+, Q9s+, J9s+, T9s, ATo+, KQo, KJo:0.5',
  UTG: '55+, A8s+, A5s-A3s, K9s+, Q9s+, J9s+, T9s, 98s, 87s:0.5, ATo+, KJo+, QJo:0.5',
  MP: '33+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s:0.5, ATo+, KTo+, QTo+, JTo:0.5',
  CO: '33+, A2s+, K7s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 76s, 65s, A8o+, KTo+, QTo+, JTo, A5o:0.5',
  BTN: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, 53s:0.5, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o:0.5',
  SB: '22+, A2s+, K5s+, Q7s+, J7s+, T7s+, 97s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, Q9o+, J9o+, T9o, 98o:0.5',
  // heads-up: o botão (que é também o small blind) abre quase tudo
  HU_BTN: '22+, A2+, K2+, Q2+, J2s+, J4o+, T2s+, T6o+, 92s+, 96o+, 82s+, 86o+, 72s+, 75o+, 62s+, 64o+, 52s+, 54o, 42s+, 32s',
};
// Respostas a uma abertura: { raise (3-bet), call }, por grupo de quem abriu e lugar de quem responde
const VS_OPEN_SRC = {
  // contra abertura de UTG/MP
  early_ip: { raise: 'QQ+, AKs, AKo, A5s:0.5', call: 'JJ-77, AQs-ATs, KQs, KJs, QJs, JTs, T9s, AQo' },
  early_sb: { raise: 'QQ+, AK, AQs, A5s:0.5', call: '' },
  early_bb: { raise: 'QQ+, AKs, AKo, A5s:0.5', call: '22-JJ, A2s-AQs, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, ATo+, KJo+, QJo' },
  // contra abertura de CO/BTN/SB
  late_ip: { raise: 'TT+, AJs+, KQs, AQo+, A5s-A4s:0.5', call: '22-99, A2s-ATs, K9s-KJs, Q9s+, J9s+, T8s+, 98s, 87s, 76s, ATo-AJo, KJo+, QJo' },
  late_sb: { raise: '88+, ATs+, KJs+, QJs, JTs:0.5, AJo+, KQo, A5s-A2s:0.5', call: '' },
  late_bb: { raise: 'TT+, AQs+, AKo, A5s-A4s, KQs:0.5', call: '22-99, A2s-AJs, K2s-KJs, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A2o-AQo, K8o+, Q9o+, J9o+, T8o+, 98o, 87o' },
  // heads-up: big blind contra abertura do botão
  hu_bb: { raise: '88+, A8s+, A5s-A2s, KTs+, QJs, AJo+, KQo', call: '22-77, A2s-A7s, K2s-K9s, Q2s-QTs, J2s+, T3s+, 95s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o-ATo, K2o-KJo, Q5o+, J7o+, T7o+, 97o+, 87o, 76o' },
};
// Quem abriu e levou 3-bet: { raise (4-bet), call }
const VS_3BET_SRC = {
  early: { raise: 'KK+, AKs, A5s:0.3', call: 'QQ-TT, AQs+, AKo, KQs' },
  late: { raise: 'QQ+, AKs, AKo:0.5, A5s:0.4', call: 'JJ-77, ATs+, KJs+, QJs, JTs, T9s, AQo, AKo:0.5' },
  hu: { raise: 'TT+, AQs+, AKo, A5s:0.4', call: '22-99, A2s-AJs, K8s+, Q9s+, J9s+, T8s+, 98s, A8o-AQo, KTo+, QJo' },
  cold: { raise: 'KK+, AKs', call: 'QQ, AKo' }, // 3-bet na frente sem você ter aberto
};
const VS_4BET_SRC = { raise: 'QQ+, AK', call: '' };

const RFI = Object.fromEntries(Object.entries(RFI_SRC).map(([k, v]) => [k, parseRange(v)]));
const parsePair = o => ({ raise: parseRange(o.raise), call: parseRange(o.call) });
const VS_OPEN = Object.fromEntries(Object.entries(VS_OPEN_SRC).map(([k, v]) => [k, parsePair(v)]));
const VS_3BET = Object.fromEntries(Object.entries(VS_3BET_SRC).map(([k, v]) => [k, parsePair(v)]));
const VS_4BET = parsePair(VS_4BET_SRC);

// Em mesas com menos gente, as posições que existem pegam a faixa equivalente
function posAlias(pos, nAct) {
  if (nAct === 5 && pos === 'UTG') return 'MP';
  // mesa de 7 a 9: os 6 últimos lugares jogam como na mesa de 6; os primeiros, mais fechado
  if (nAct >= 7) return { UTG: nAct === 7 ? 'E3' : 'E1', UTG1: nAct === 8 ? 'E3' : 'E2', UTG2: 'E3', LJ: 'UTG', HJ: 'MP' }[pos] || pos;
  return pos;
}
const EARLY = new Set(['UTG', 'MP', 'E1', 'E2', 'E3']);
const POS_TXT = { E1: 'UTG', E2: 'UTG+1', E3: 'UTG+2', UTG1: 'UTG+1', UTG2: 'UTG+2', LJ: 'Lojack', HJ: 'Hijack', UTG: 'UTG', MP: 'Middle', CO: 'Cutoff', BTN: tx`Botão`, SB: 'Small blind', BB: 'Big blind' };

// Cenário pré-flop para quem vai agir: qual tabela vale e como explicar
// raises: aumentos até agora; opener: posição de quem abriu; heroOpened: se o próprio jogador abriu
function rangeScenario(pos, nAct, raises, opener, heroOpened, canCheck) {
  const hu = nAct === 2, p = posAlias(pos, nAct), op = opener ? posAlias(opener, nAct) : null;
  if (raises === 0) {
    if (hu) return pos === 'BB' ? { key: 'hu_bb_check', raise: VS_OPEN.hu_bb.raise, call: {}, txt: tx`Big blind no heads-up, sem aumento: aumente com as mãos de 3-bet; senão passe de graça` }
      : { key: 'HU_BTN', raise: RFI.HU_BTN, call: {}, txt: tx`Abrir do botão no heads-up` };
    if (pos === 'BB') return { key: 'bb_check', raise: VS_OPEN.late_bb.raise, call: {}, txt: tx`Big blind sem aumento: aumente as melhores mãos; as outras passam de graça` };
    return { key: 'RFI_' + p, raise: RFI[p] || RFI.CO, call: {}, txt: tx`Abrir do ${POS_TXT[pos] || pos}` };
  }
  if (raises === 1) {
    if (hu) return { key: 'hu_bb', ...VS_OPEN.hu_bb, txt: tx`Big blind contra abertura do botão no heads-up` };
    const grp = op && EARLY.has(op) ? 'early' : 'late';
    const seat = pos === 'BB' ? 'bb' : pos === 'SB' ? 'sb' : 'ip';
    const where = { bb: tx`do Big blind`, sb: tx`do Small blind`, ip: tx`em posição` }[seat];
    return { key: `${grp}_${seat}`, ...VS_OPEN[`${grp}_${seat}`], txt: tx`Contra abertura do ${POS_TXT[opener] || tx`rival`}, ${where}` };
  }
  if (raises === 2) {
    if (!heroOpened) return { key: 'cold', ...VS_3BET.cold, txt: tx`Aumento e re-aumento na sua frente` };
    if (hu) return { key: 'hu_3bet', ...VS_3BET.hu, txt: tx`Você abriu e levou 3-bet no heads-up` };
    const grp = EARLY.has(p) ? 'early' : 'late';
    return { key: `3bet_${grp}`, ...VS_3BET[grp], txt: tx`Você abriu do ${POS_TXT[pos] || pos} e levou 3-bet` };
  }
  return { key: '4bet', ...VS_4BET, txt: tx`Contra 4-bet ou mais` };
}
// Frequências da mão no cenário
function rangeFreq(sc, cls) { return { raise: sc.raise[cls] || 0, call: sc.call[cls] || 0 }; }

// Push/fold pelas tabelas geradas (00-dados.js)
function pushFoldAdvice(cls, depth, kBehind, facingShoveFromK) {
  const D = Math.max(1, Math.round(depth));
  if (facingShoveFromK) { const m = (CALL_MAX[Math.min(5, facingShoveFromK)] || {})[cls] || 0; return { ok: m >= D, max: m }; }
  const m = (PUSH_MAX[Math.min(5, Math.max(1, kBehind))] || {})[cls] || 0;
  return { ok: m >= D, max: m };
}
const HAND_POS = Object.fromEntries(HAND_RANK.map((c, i) => [c, i / 168])); // 0 = melhor, 1 = pior
