// ---------- Força pré-flop (fórmula de Chen) ----------
function chen(c1, c2) {
  const r1 = rankOf(c1), r2 = rankOf(c2), hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  const pts = r => r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2;
  let s = pts(hi);
  if (r1 === r2) return Math.max(5, Math.ceil(s * 2));
  if (suitOf(c1) === suitOf(c2)) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return Math.ceil(s);
}
// A mesma conta de chen(), passo a passo, para mostrar na tela
function chenBreakdown(c1, c2) {
  const r1 = rankOf(c1), r2 = rankOf(c2), hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  const RC = '23456789TJQKA';
  const fmt = x => String(x).replace('.', DEC).replace('-', '−');
  const pts = r => r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2;
  const base = pts(hi), H = RC[hi];
  const steps = [tx`Carta mais alta: ${H} vale ${fmt(base)}`];
  if (r1 === r2) {
    const d = base * 2, total = Math.max(5, Math.ceil(d));
    steps.push(tx`Par: ${fmt(base)} × 2 = ${fmt(d)}${d < 5 ? tx`, sobe para o mínimo de 5` : ''}`);
    return { total, steps, calc: `${H}: ${fmt(base)} × 2${d < 5 ? tx` = ${fmt(d)} → mín. 5` : ` = ${total}`}` };
  }
  const suited = suitOf(c1) === suitOf(c2), gap = hi - lo - 1;
  const gp = gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  const bonus = gap <= 1 && hi < 10 ? 1 : 0;
  const raw = base + (suited ? 2 : 0) - gp + bonus, total = Math.ceil(raw);
  steps.push(suited ? tx`Mesmo naipe: +2` : tx`Naipes diferentes: +0`);
  steps.push(gap === 0 ? tx`Cartas seguidas: −0` : tx`Buraco de ${gap} carta${gap > 1 ? 's' : ''} entre elas: −${gp}`);
  steps.push(bonus ? tx`Bônus (seguidas ou 1 buraco, as duas abaixo da Q): +1` : gap <= 1 ? tx`Sem bônus: há carta Q ou maior` : tx`Sem bônus: buraco grande demais`);
  if (raw !== total) steps.push(tx`${fmt(raw)} arredondado para cima: ${fmt(total)}`);
  const terms = [`${H}: ${fmt(base)}`];
  if (suited) terms.push('+2'); if (gp) terms.push(`−${gp}`); if (bonus) terms.push('+1');
  const calc = terms.join(' ') + (raw !== total ? ` = ${fmt(raw)} → ${fmt(total)}` : ` = ${fmt(total)}`);
  return { total, steps, calc };
}
function comboName(c1, c2) {
  const a = rankOf(c1) >= rankOf(c2) ? c1 : c2, b = a === c1 ? c2 : c1;
  const RC = '23456789TJQKA'; // notação de poker: T = 10
  const A = RC[rankOf(a)], B = RC[rankOf(b)];
  if (rankOf(a) === rankOf(b)) return A + B;
  return A + B + (suitOf(a) === suitOf(b) ? 's' : 'o');
}
