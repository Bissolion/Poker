// Teste de fumaça no navegador: abre o jogo em 360 px, joga mãos e abre as telas principais.
// Falha se houver erro de JavaScript ou rolagem lateral.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('fumaca')) {
        sessionStorage.setItem('fumaca', '1');
        localStorage.setItem('mesa-treino-cfg-v1', JSON.stringify({ cfg: { format: 'cash', table: '6', rival: 'lag', skill: 'normal', per: 8 }, prefs: { speed: 'turbo', sound: false, showStrength: true } }));
      }
    } catch (e) {}
  });
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
  await page.click('#btnGame'); await page.click('#btnSetupClose');
  await page.click('#btnStudy');
  for (const aba of ['hands', 'ranges', 'quiz', 'session']) { await page.click(`[data-tab=${aba}]`); if (await largura()) lateral = true; }
  await browser.close();
  const falhas = [];
  if (maos < 10) falhas.push(`só ${maos} mãos jogadas`);
  if (lateral) falhas.push('rolagem lateral em 360 px');
  if (erros.length) falhas.push('erros: ' + erros.slice(0, 3).join(' | '));
  if (falhas.length) { console.error('FUMAÇA FALHOU:', falhas.join('; ')); process.exit(1); }
  console.log(`fumaça ok: ${maos} mãos, telas abertas, sem erros`);
})();
