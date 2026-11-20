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
// Quantos jogadores agem depois de uma posição até o big blind (para push/fold)
const ORDER_PRE = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
function behindOf(g, seat) {
  const order = ORDER_PRE.filter(x => g.players.some(q => !q.out && g.posOf(q.seat) === x));
  const i = order.indexOf(g.posOf(seat));
  return Math.max(1, order.length - 1 - i);
}
// Decisão pré-flop pelas tabelas de faixas: devolve as frequências de cada ação e a explicação
function rangeDecision(g, seat) {
  const p = g.players[seat], pos = g.posOf(seat), L = g.legal(seat), nAct = g.activeCount();
  const cls = classOf(p.hole[0], p.hole[1]);
  const opener = g.pfOpener >= 0 ? g.posOf(g.pfOpener) : null;
  const sc = rangeScenario(pos, nAct, g.raises, opener, g.pfOpener === seat, L.canCheck);
  const f = rangeFreq(sc, cls), fold = Math.max(0, 1 - f.raise - f.call);
  return { sc, cls, f, fold };
}
const pct0 = x => Math.round(x * 100) + '%';
function preflopAdvice(g, seat) {
  const p = g.players[seat], pos = g.posOf(seat), L = g.legal(seat), nAct = g.activeCount();
  const s = chen(p.hole[0], p.hole[1]);
  const combo = comboName(p.hole[0], p.hole[1]), cls = classOf(p.hole[0], p.hole[1]);
  const depth = effBB(g, seat);
  const D = Math.round(depth * 10) / 10, Ds = D.toString().replace('.', ',');
  if (depth <= PUSH_DEPTH) {
    // Stack curto: all-in ou desistir, pelas tabelas geradas
    let rec, why, r;
    if (g.raises === 0) {
      const k = behindOf(g, seat);
      r = pushFoldAdvice(cls, depth, k);
      rec = r.ok ? 'raise' : L.canCheck ? 'check' : 'fold';
      why = `Com ${Ds} BB, a jogada é all-in ou desistir. Com ${k} ${k > 1 ? 'jogadores' : 'jogador'} ainda por agir, ${combo} ${r.ok ? 'entra na faixa de all-in' : 'fica de fora'}${r.max ? ` (vale all-in até ${r.max} BB)` : ''}.`;
    } else {
      const k = g.pfAgg >= 0 ? behindOf(g, g.pfAgg) : 1;
      r = pushFoldAdvice(cls, depth, 0, k);
      rec = r.ok ? (L.canRaise ? 'raise' : 'call') : 'fold';
      why = `Com ${Ds} BB contra um aumento, continue só com as mãos da faixa de call contra all-in. ${combo} ${r.ok ? 'entra' : 'fica de fora'}${r.max ? ` (vale até ${r.max} BB)` : ''}.`;
    }
    return { rec, why, s, combo, cls, pos, push: true, depth: D, max: r.max, freq: null };
  }
  const { sc, f, fold } = rangeDecision(g, seat);
  const passive = L.canCheck ? 'check' : 'fold';
  const opts = [['raise', f.raise], ['call', f.call], [passive, fold]];
  const rec = opts.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const mixed = Math.max(f.raise, f.call, fold) < 1;
  const verbR = g.raises === 0 ? (L.canCheck ? 'aumentar' : 'abrir') : g.raises === 1 ? '3-bet' : '4-bet';
  const parts = [];
  if (f.raise) parts.push(`${verbR} ${f.raise < 1 ? pct0(f.raise) + ' das vezes' : ''}`.trim());
  if (f.call) parts.push(`pagar ${f.call < 1 ? pct0(f.call) + ' das vezes' : ''}`.trim());
  const what = parts.length ? parts.join(' ou ') : (L.canCheck ? 'passar' : 'desistir');
  const size = g.raises === 0 ? `Essa faixa ${L.canCheck ? 'aumenta' : 'abre'} ${pct0(rangePct(sc.raise))} das mãos.` : `Essa faixa ${rangePct(sc.call) ? `paga ${pct0(rangePct(sc.call))} e ` : ''}${verbR === '3-bet' ? 'faz 3-bet' : 'faz 4-bet'} com ${pct0(rangePct(sc.raise))} das mãos.`;
  const why = `${sc.txt}: com ${combo}, ${what}${mixed && parts.length ? ' (jogada mista)' : ''}. ${size}`;
  return { rec, why, s, combo, cls, pos, depth: D, freq: { raise: f.raise, call: f.call, fold }, mixed, sc, scTxt: sc.txt };
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
