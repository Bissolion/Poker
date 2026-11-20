// Teste de fumaça no navegador: abre o jogo em 360 px, joga mãos e abre as telas principais.
// Falha se houver erro de JavaScript ou rolagem lateral. Roda em português e em inglês;
// no inglês, também falha se sobrar texto em português na tela.
const path = require('path');
const { chromium } = require('playwright');

const PT = /[ãõçáéíóúâêôà]|\b(você|mão|mãos|não|para|desistir|pagar|aumentar|mesa|pote|jogo|faixa|torneio)\b/i;
async function run(browser, lang) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await ctx.addInitScript(LANG => {
    try {
      if (!sessionStorage.getItem('fumaca')) {
        sessionStorage.setItem('fumaca', '1');
        localStorage.setItem('mesa-treino-lang', LANG);
        localStorage.setItem('mesa-treino-cfg-v1', JSON.stringify({ cfg: { format: 'cash', table: '6', rival: 'lag', skill: 'normal', per: 8 }, prefs: { speed: 'turbo', sound: false, showStrength: true } }));
      }
    } catch (e) {}
  }, lang);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  await page.goto('file://' + path.join(__dirname, '..', 'mesa-de-treino.html'));
  const largura = async () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  let maos = 0, lateral = false;
  for (let i = 0; i < 3000 && maos < 10; i++) {
    if (await largura()) lateral = true;
    if (await page.locator('#btnNext').count()) { maos++; await page.click('#btnNext'); continue; }
    if (await page.locator('[data-act]').count()) {
      const tipo = ['call', 'call', 'raise', 'fold'][i % 4];
      const b = page.locator(`[data-act=${tipo}]`);
      await ((await b.isDisabled()) ? page.locator('[data-act=call]') : b).click();
      continue;
    }
    await page.waitForTimeout(40);
  }
  // textos visíveis (sem os nomes dos bots), para achar português na versão em inglês
  const resto = new Set();
  const coleta = async () => { if (lang !== 'en') return; const xs = await page.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || el.closest('[hidden],script,style')) continue; const v = n.nodeValue.trim(); if (v) out.push(v); } document.querySelectorAll('[aria-label]').forEach(e => out.push(e.getAttribute('aria-label'))); return out; }); xs.forEach(x => { if (PT.test(x.replace(/Seu Zé|Português/g, ''))) resto.add(x); }); };
  await coleta();
  await page.click('#btnGame'); await coleta(); await page.click('#btnSetupClose');
  await page.click('#btnStudy');
  for (const aba of ['hands', 'ranges', 'quiz', 'drills', 'session']) {
    await page.click(`[data-tab=${aba}]`); if (await largura()) lateral = true; await coleta();
    if (aba === 'quiz') for (let q = 0; q < 12; q++) { await page.locator('[data-qo]').first().click(); await coleta(); await page.click('#qNext'); }
    if (aba === 'hands' && await page.locator('[data-h]').count()) { await page.locator('[data-h]').first().click(); for (let k = 0; k < 6; k++) { await coleta(); if (await page.locator('#rpNext:not([disabled])').count()) await page.click('#rpNext'); } await page.click('#rpBack'); }
    if (aba === 'ranges') for (const scn of ['open', 'vsopen', 'vs3bet', 'push']) { const b = page.locator(`[data-scn=${scn}]`); if (await b.count()) { await b.click(); await page.locator('[data-n]').nth(30).click(); await coleta(); } }
    if (aba === 'drills') for (const dr of ['abrir', 'pushfold', 'cbet', 'river']) { await page.click(`[data-dr=${dr}]`); for (let k = 0; k < 3; k++) { await coleta(); await page.locator('[data-da]').nth(k % 3).click(); await coleta(); await page.click('#drNext'); } await page.click('#drBack'); }
  }
  await ctx.close();
  const falhas = [];
  if (maos < 10) falhas.push(`só ${maos} mãos jogadas`);
  if (lateral) falhas.push('rolagem lateral em 360 px');
  if (erros.length) falhas.push('erros: ' + erros.slice(0, 3).join(' | '));
  if (resto.size) falhas.push('português na versão em inglês: ' + [...resto].slice(0, 8).join(' | '));
  if (falhas.length) { console.error(`FUMAÇA FALHOU (${lang}):`, falhas.join('; ')); return false; }
  console.log(`fumaça ok (${lang}): ${maos} mãos, telas abertas, sem erros`);
  return true;
}
(async () => {
  const browser = await chromium.launch();
  const ok = [await run(browser, 'pt'), await run(browser, 'en')];
  await browser.close();
  if (ok.includes(false)) process.exit(1);
})();
