// ---------- Idiomas: português (o texto do código) e inglês (dicionário em i18n/en.json) ----------
// O texto em português é a própria chave: tx`Pote ${x}` procura "Pote {0}" no dicionário.
// Plural no inglês: {0|hand|hands} escolhe pela quantidade em {0}.
// Contexto: [[jogo]]Mesa separa palavras iguais em português com sentidos diferentes no inglês; o [[...]] some na tela.
const LANG = typeof POKER_LANG !== 'undefined' && POKER_LANG === 'en' ? 'en' : 'pt';
const I18N_EN = typeof POKER_EN !== 'undefined' ? POKER_EN : {};
const I18N_MISSING = new Set();
function i18nKey(strs) { let k = strs[0]; for (let i = 1; i < strs.length; i++) k += '{' + (i - 1) + '}' + strs[i]; return k; }
function i18nFill(tpl, vals) {
  return tpl.replace(/\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_, i, one, many) => one === undefined ? String(vals[i]) : (Number(vals[i]) === 1 ? one : many));
}
function tx(strs, ...vals) {
  const key = i18nKey(strs);
  if (LANG === 'pt') return i18nFill(key, vals).replace(/^\[\[[^\]]*\]\]/, '');
  const tpl = I18N_EN[key];
  if (tpl === undefined) { I18N_MISSING.add(key); return i18nFill(key, vals).replace(/^\[\[[^\]]*\]\]/, ''); }
  return i18nFill(tpl, vals);
}
// Texto pronto (sem variáveis), usado na tradução da página
const tr = s => LANG === 'pt' ? s : (I18N_EN[s] ?? s);
const DEC = LANG === 'en' ? '.' : ',';
