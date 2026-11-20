// ---------- Avaliador de mãos (5 a 7 cartas) ----------
function straightHigh(mask) {
  const ext = (mask << 1) | ((mask >> 12) & 1); // ás também vale como 1
  for (let hi = 13; hi >= 4; hi--) if (((ext >> (hi - 4)) & 31) === 31) return hi - 1;
  return -1;
}
function mkScore(cat, ks) {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 16 + (ks[i] === undefined || ks[i] < 0 ? 0 : ks[i] + 1);
  return s;
}
const CAT_BASE = 16 ** 5;
function evalHand(cards) {
  const rc = new Array(13).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) { const r = c >> 2, s = c & 3; rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r; }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const h = straightHigh(sm[fs]); if (h >= 0) return mkScore(8, [h]); }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    const n = rc[r];
    if (n === 4) quads.push(r); else if (n === 3) trips.push(r); else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r);
  }
  const bestOther = (...ex) => { for (let r = 12; r >= 0; r--) if (rc[r] && !ex.includes(r)) return r; return -1; };
  if (quads.length) return mkScore(7, [quads[0], bestOther(quads[0])]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const p = Math.max(trips.length > 1 ? trips[1] : -1, pairs.length ? pairs[0] : -1);
    return mkScore(6, [trips[0], p]);
  }
  if (fs >= 0) { const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (sm[fs] & (1 << r)) ks.push(r); return mkScore(5, ks); }
  const st = straightHigh(mask);
  if (st >= 0) return mkScore(4, [st]);
  if (trips.length) return mkScore(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) return mkScore(2, [pairs[0], pairs[1], bestOther(pairs[0], pairs[1])]);
  if (pairs.length) return mkScore(1, [pairs[0], ...singles.slice(0, 3)]);
  return mkScore(0, singles.slice(0, 5));
}
const catOf = s => Math.floor(s / CAT_BASE);
const kOf = (s, i) => Math.floor(s / 16 ** (4 - i)) % 16 - 1;
function handName(score) {
  const c = catOf(score), R = i => RANK_CH[kOf(score, i)];
  switch (c) {
    case 8: return kOf(score, 0) === 12 ? 'Royal flush' : tx`Straight flush até o ${R(0)}`;
    case 7: return tx`Quadra de ${R(0)}`;
    case 6: return tx`Full house, ${R(0)} com ${R(1)}`;
    case 5: return tx`Flush, ${R(0)} alto`;
    case 4: return tx`Sequência até o ${R(0)}`;
    case 3: return tx`Trinca de ${R(0)}`;
    case 2: return tx`Dois pares, ${R(0)} e ${R(1)}`;
    case 1: return tx`Par de ${R(0)}`;
    default: return tx`Carta alta ${R(0)}`;
  }
}
