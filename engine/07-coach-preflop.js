// ---------- Coach ----------
const OPEN_T = { UTG: 9, MP: 8, CO: 7, BTN: 6, SB: 7, BB: 9 };
// Regra pré-flop única, usada pelo coach e pela grade de faixas.
// t = força mínima para continuar; rr = força mínima para (re)aumentar
function preflopRule(s, pos, raises, canCheck, nAct = 6) {
  let rec, t, rr;
  if (raises === 0) {
    t = nAct === 2 ? (pos === 'BTN' ? 3 : 8) : OPEN_T[pos] - (nAct <= 3 ? 1 : 0);
    rr = t; rec = s >= t ? 'raise' : canCheck ? 'check' : 'fold';
  } else if (raises === 1) {
    if (nAct === 2) { t = 4; rr = 10; }
    else { t = pos === 'BB' ? 7 : (pos === 'BTN' || pos === 'CO') ? 9 : 10; rr = 12; }
    rec = s >= rr ? 'raise' : s >= t ? 'call' : 'fold';
  } else {
    if (nAct === 2) { t = 9; rr = 12; } else { t = 12; rr = 14; }
    rec = s >= rr ? 'raise' : s >= t ? 'call' : 'fold';
  }
  return { rec, t, rr };
}
function preflopAdvice(g, seat) {
  const p = g.players[seat], pos = g.posOf(seat), L = g.legal(seat), nAct = g.activeCount();
  const s = chen(p.hole[0], p.hole[1]);
  const combo = comboName(p.hole[0], p.hole[1]);
  const depth = effBB(g, seat);
  const D = Math.round(depth * 10) / 10;
  if (depth <= PUSH_DEPTH) {
    // Stack curto: all-in ou desistir
    let t, rec, why;
    const Ds = D.toString().replace('.', ',');
    if (g.raises === 0) {
      t = pushThreshold(depth, pos, nAct);
      rec = s >= t ? 'raise' : L.canCheck ? 'check' : 'fold';
      why = `Com ${Ds} BB, a jogada é all-in ou desistir: um aumento normal compromete quase tudo sem tirar ninguém da mão. Nesta posição, vá all-in com força ${t}+. ${combo} tem ${s}.`;
    } else {
      t = callShoveThreshold(depth, nAct);
      rec = s >= t ? (L.canRaise ? 'raise' : 'call') : 'fold';
      why = `Com ${Ds} BB contra um aumento, só continue all-in com força ${t}+. ${combo} tem ${s}.`;
    }
    return { rec, why, s, t, combo, pos, push: true, depth: D };
  }
  const { rec, t, rr } = preflopRule(s, pos, g.raises, L.canCheck, nAct);
  const hu = nAct === 2 ? ' No heads-up as faixas são bem mais largas: contra um rival só, mãos medianas ganham valor.' : '';
  let why;
  if (g.raises === 0) {
    if (L.canCheck) why = s >= t ? `${combo} (força ${s}) é forte o bastante para aumentar do Big blind.` : `${combo} (força ${s}): passe de graça e veja o flop.`;
    else why = `No ${POS_LABEL[pos]}, o padrão é abrir com força ${t} ou mais. ${combo} tem força ${s}.${hu}`;
  } else if (g.raises === 1) {
    why = s >= rr ? `${combo} (força ${s}) é forte: volte a aumentar (3-bet).` : `Contra um aumento, pague com força ${t}+ nesta posição e re-aumente com ${rr}+. ${combo} tem ${s}.${hu}`;
  } else {
    why = `Contra re-aumentos, continue só com mãos muito fortes (${t}+; re-aumente com ${rr}+). ${combo} tem ${s}.`;
  }
  return { rec, why, s, t, combo, pos, depth: D };
}

// O que a ação de cada rival diz sobre a mão dele (texto para o coach)
const LV_TXT = { 1: 'algo no board, ás ou cartas altas', 1.5: 'pelo menos um projeto', 2: 'um par ou projeto forte', 2.5: 'top pair ou melhor (ou blefe)' };
const ST_PT = { flop: 'no flop', turn: 'no turn', river: 'no river' };
function readNote(q) {
  const parts = [];
  if (q.minChen >= 12) parts.push('re-aumentou antes do flop');
  else if (q.minChen >= 10) parts.push('fez 3-bet antes do flop');
  else if (q.minChen >= 9) parts.push('pagou um re-aumento');
  else if (q.minChen >= 7) parts.push('aumentou antes do flop');
  else if (q.minChen >= 5) parts.push('pagou um aumento');
  for (const r of q.reads || []) parts.push(`${r.lv === 1 ? 'pagou' : r.raise ? 'aumentou' : r.lv >= 2.5 ? 'apostou forte' : 'apostou'} ${ST_PT[r.st]}`);
  if (!parts.length) return null;
  const top = Math.max(0, ...(q.reads || []).map(r => r.lv));
  const range = top ? LV_TXT[top] : q.minChen >= 10 ? 'mãos premium' : q.minChen >= 7 ? 'mãos boas' : 'mãos jogáveis';
  return { name: q.name, text: parts.join(', '), range };
}
