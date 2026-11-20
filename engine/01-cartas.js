// ===== Motor de Texas Hold'em No-Limit =====
// Cartas: inteiros 0..51. rank = c>>2 (0 = 2 ... 12 = A), naipe = c&3 (0 ♠, 1 ♥, 2 ♦, 3 ♣)
const RANK_CH = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_CH = ['♠','♥','♦','♣'];
const rankOf = c => c >> 2;
const suitOf = c => c & 3;
const cardStr = c => RANK_CH[rankOf(c)] + SUIT_CH[suitOf(c)];

function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
