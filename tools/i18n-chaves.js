// Lista as chaves de tradução do código: cada tx`...` (com {0}, {1} no lugar das variáveis)
// e os textos fixos do HTML (corpo.html e os trechos entre tags dos modelos da interface).
const fs = require('fs');
const path = require('path');
const ESC = { n: '\n', t: '\t', '`': '`', $: '$', '\\': '\\', "'": "'", '"': '"' };
// Pula uma expressão ${...} a partir de i (logo depois do "${"); devolve o índice depois do "}"
function skipExpr(s, i) {
  let depth = 1;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || c === '"') { const q = c; i++; while (s[i] !== q) i += s[i] === '\\' ? 2 : 1; i++; continue; }
    if (c === '`') { i = readTemplate(s, i + 1).end; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return i + 1;
    i++;
  }
  return i;
}
// Lê um template a partir de i (logo depois da crase); devolve as partes de texto e o fim
function readTemplate(s, i) {
  const parts = ['']; let cur = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') { parts[cur] += ESC[s[i + 1]] ?? s[i + 1]; i += 2; continue; }
    if (c === '`') return { parts, end: i + 1 };
    if (c === '$' && s[i + 1] === '{') { i = skipExpr(s, i + 2); parts.push(''); cur++; continue; }
    parts[cur] += c; i++;
  }
  return { parts, end: i };
}
function txKeys(src) {
  const out = [], re = /(?<![\w$.])tx`/g;
  let m;
  while ((m = re.exec(src))) {
    const { parts } = readTemplate(src, m.index + 3);
    let k = parts[0]; for (let j = 1; j < parts.length; j++) k += '{' + (j - 1) + '}' + parts[j];
    out.push(k);
  }
  return out;
}
// Textos entre tags que não dependem de variáveis
const hasWords = x => /[A-Za-zÀ-ú]{2,}/.test(x);
function htmlTexts(html) {
  const out = [];
  const clean = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const m of clean.matchAll(/>([^<>]+)</g)) { const x = m[1].trim(); if (x && hasWords(x) && !x.includes('${') && !x.includes('}')) out.push(x); }
  for (const m of clean.matchAll(/(?:aria-label|title|placeholder)="([^"$]+)"/g)) if (hasWords(m[1])) out.push(m[1].trim());
  return out;
}
// Textos fixos nos modelos da interface (pedaços sem ${} entre tags)
function templateTexts(src) {
  const out = [];
  const pieces = src.split(/\$\{/);
  for (const p of pieces) for (const m of p.matchAll(/>([^<>`]+)</g)) {
    const x = m[1].trim();
    if (x && hasWords(x) && !/['"]|Math\./.test(x) && !/[{}=]|=>/.test(x)) out.push(x);
  }
  for (const m of src.matchAll(/(?:aria-label)="([^"$]+)"/g)) if (hasWords(m[1])) out.push(m[1].trim());
  return out;
}
function allKeys(dir) {
  const js = ['engine', 'ui'].flatMap(d => fs.readdirSync(path.join(dir, d)).filter(f => f.endsWith('.js')).map(f => path.join(dir, d, f)));
  const tx = new Set(), html = new Set();
  for (const f of js) { const s = fs.readFileSync(f, 'utf8'); txKeys(s).forEach(k => tx.add(k)); if (f.includes(`${path.sep}ui${path.sep}`)) templateTexts(s).forEach(k => html.add(k)); }
  htmlTexts(fs.readFileSync(path.join(dir, 'ui', 'corpo.html'), 'utf8')).forEach(k => html.add(k));
  for (const k of tx) html.delete(k);
  return { tx: [...tx], html: [...html] };
}
module.exports = { txKeys, htmlTexts, allKeys };
if (require.main === module) {
  const dir = path.join(__dirname, '..'), { tx, html } = allKeys(dir);
  const en = fs.existsSync(path.join(dir, 'i18n', 'en.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'i18n', 'en.json'), 'utf8')) : {};
  const miss = [...tx, ...html].filter(k => !(k in en));
  console.log(JSON.stringify(miss, null, 1));
  console.error(`${tx.length} chaves tx, ${html.length} textos fixos, ${miss.length} sem tradução`);
}
