// ---------- Quiz ----------
const CAT_PT = [tx`carta alta`, tx`par`, tx`dois pares`, tx`trinca`, tx`sequência`, tx`flush`, tx`full house`, tx`quadra`, tx`straight flush`];
const pickOf = (a, rng) => a[Math.floor(rng() * a.length)];
function choices(correct, pool, rng, n = 4, minGap = 1) {
  const out = [correct];
  for (const x of shuffle(pool.slice(), rng)) {
    if (out.length >= n) break;
    if (out.every(y => Math.abs(y - x) >= minGap)) out.push(x);
  }
  return shuffle(out, rng);
}
// Melhores 5 cartas (para destacar na explicação)
function best5(cards) {
  if (cards.length <= 5) return cards.slice();
  let best = -1, bc = null;
  const pick = [], n = cards.length;
  const rec = from => {
    if (pick.length === 5) { const sc = evalHand(pick); if (sc > best) { best = sc; bc = pick.slice(); } return; }
    for (let i = from; i <= n - (5 - pick.length); i++) { pick.push(cards[i]); rec(i + 1); pick.pop(); }
  };
  rec(0);
  return bc;
}
