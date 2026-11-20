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
  const D = Math.round(depth * 10) / 10, Ds = D.toString().replace('.', DEC);
  const shoveFacing = g.raises >= 1 && g.players.some(q => q.seat !== seat && !q.folded && q.allIn && q.bet === g.currentBet);
  if (g.payouts && shoveFacing) {
    const sp = icmCallSpot(g, seat, g.payouts);
    if (sp) {
      const rec = sp.eq >= sp.needIcm ? 'call' : 'fold', P = x => Math.round(x * 100) + '%';
      const why = tx`Contra o all-in de ${sp.shover}, sua mão tem cerca de ${P(sp.eq)} de equity. Em fichas, bastaria ${P(sp.needChip)}; com os prêmios (ICM), você precisa de ${P(sp.needIcm)}${sp.premium > 0.01 ? tx`: ${P(sp.premium)} a mais, o prêmio de risco de cair do torneio` : ''}.${isBubble(g, g.payouts) ? tx` Na bolha esse prêmio de risco é o maior do torneio.` : ''}`;
      return { rec, why, s, combo, cls, pos, push: true, depth: D, max: null, icm: sp, freq: null };
    }
  }
  if (g.payouts && depth <= PUSH_DEPTH && g.raises === 0) {
    const sp = icmPushSpot(g, seat, g.payouts);
    if (sp) {
      const rec = sp.push ? 'raise' : L.canCheck ? 'check' : 'fold', chip = pushFoldAdvice(cls, depth, behindOf(g, seat));
      const why = tx`Com ${Ds} BB e prêmios em jogo, o coach compara o valor em prêmio de ir all-in e de desistir (ICM). ${combo}: all-in ${sp.push ? tx`vale mais` : tx`vale menos`} que desistir.${chip.ok !== sp.push ? tx` Só em fichas, a resposta seria ${chip.ok ? 'all-in' : tx`desistir`}: os prêmios mudam a decisão.` : ''}`;
      return { rec, why, s, combo, cls, pos, push: true, depth: D, max: chip.max, icm: sp, freq: null };
    }
  }
  if (depth <= PUSH_DEPTH) {
    // Stack curto: all-in ou desistir, pelas tabelas geradas
    let rec, why, r;
    if (g.raises === 0) {
      const k = behindOf(g, seat);
      r = pushFoldAdvice(cls, depth, k);
      rec = r.ok ? 'raise' : L.canCheck ? 'check' : 'fold';
      why = tx`Com ${Ds} BB, a jogada é all-in ou desistir. Com ${k} ${k > 1 ? tx`jogadores` : tx`jogador`} ainda por agir, ${combo} ${r.ok ? tx`entra na faixa de all-in` : tx`fica de fora`}${r.max ? tx` (vale all-in até ${r.max} BB)` : ''}.`;
    } else {
      const k = g.pfAgg >= 0 ? behindOf(g, g.pfAgg) : 1;
      r = pushFoldAdvice(cls, depth, 0, k);
      rec = r.ok ? (L.canRaise ? 'raise' : 'call') : 'fold';
      why = tx`Com ${Ds} BB contra um aumento, continue só com as mãos da faixa de call contra all-in. ${combo} ${r.ok ? tx`entra` : tx`fica de fora`}${r.max ? tx` (vale até ${r.max} BB)` : ''}.`;
    }
    return { rec, why, s, combo, cls, pos, push: true, depth: D, max: r.max, freq: null };
  }
  const { sc, f, fold } = rangeDecision(g, seat);
  const passive = L.canCheck ? 'check' : 'fold';
  const opts = [['raise', f.raise], ['call', f.call], [passive, fold]];
  const rec = opts.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const mixed = Math.max(f.raise, f.call, fold) < 1;
  const verbR = g.raises === 0 ? (L.canCheck ? tx`aumentar` : tx`abrir`) : g.raises === 1 ? '3-bet' : '4-bet';
  const parts = [];
  if (f.raise) parts.push(`${verbR} ${f.raise < 1 ? pct0(f.raise) + tx` das vezes` : ''}`.trim());
  if (f.call) parts.push(tx`pagar ${f.call < 1 ? pct0(f.call) + tx` das vezes` : ''}`.trim());
  const what = parts.length ? parts.join(tx` ou `) : (L.canCheck ? tx`passar` : tx`desistir`);
  const size = g.raises === 0 ? tx`Essa faixa ${L.canCheck ? tx`aumenta` : tx`abre`} ${pct0(rangePct(sc.raise))} das mãos.` : tx`Essa faixa ${rangePct(sc.call) ? tx`paga ${pct0(rangePct(sc.call))} e ` : ''}${verbR === '3-bet' ? tx`faz 3-bet` : tx`faz 4-bet`} com ${pct0(rangePct(sc.raise))} das mãos.`;
  const why = tx`${sc.txt}: com ${combo}, ${what}${mixed && parts.length ? tx` (jogada mista)` : ''}. ${size}`;
  return { rec, why, s, combo, cls, pos, depth: D, freq: { raise: f.raise, call: f.call, fold }, mixed, sc, scTxt: sc.txt };
}

// O que a ação de cada rival diz sobre a mão dele (texto para o coach)
const LV_TXT = { 1: tx`algo no board, ás ou cartas altas`, 1.5: tx`pelo menos um projeto`, 2: tx`um par ou projeto forte`, 2.5: tx`top pair ou melhor (ou blefe)` };
const ST_PT = { flop: tx`no flop`, turn: tx`no turn`, river: tx`no river` };
function readNote(q) {
  const parts = [];
  if (q.minChen >= 12) parts.push(tx`re-aumentou antes do flop`);
  else if (q.minChen >= 10) parts.push(tx`fez 3-bet antes do flop`);
  else if (q.minChen >= 9) parts.push(tx`pagou um re-aumento`);
  else if (q.minChen >= 7) parts.push(tx`aumentou antes do flop`);
  else if (q.minChen >= 5) parts.push(tx`pagou um aumento`);
  for (const r of q.reads || []) parts.push(`${r.lv === 1 ? tx`pagou` : r.raise ? tx`aumentou` : r.lv >= 2.5 ? tx`apostou forte` : tx`apostou`} ${ST_PT[r.st]}`);
  if (!parts.length) return null;
  const top = Math.max(0, ...(q.reads || []).map(r => r.lv));
  const range = top ? LV_TXT[top] : q.minChen >= 10 ? tx`mãos premium` : q.minChen >= 7 ? tx`mãos boas` : tx`mãos jogáveis`;
  return { name: q.name, text: parts.join(', '), range };
}
