// ---- Jogo (configuração) ----
let draft = null;
const segHTML = (key, opts, val) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="chip" data-k="${key}" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join('')}</div>`;
const SKILL_HINT = { easy: tx`Os bots erram mais, pagam no automático e quase não blefam. Bom para começar.`, normal: tx`Cada bot joga o próprio estilo sem grandes erros.`, hard: tx`Os bots erram pouco, apostam de novo no flop e exploram suas tendências.` };
function openSetup() { draft = { ...cfg }; $('setup').hidden = false; renderSetup(); $('btnSetupClose').focus(); }
function closeSetup() { $('setup').hidden = true; }
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (!$('setup').hidden) renderSetup(); });
function renderSetup() {
  const d = draft;
  const inHand = game && !game.handOver;
  const standalone = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } })();
  const installHTML = IS_PWA
    ? (standalone
      ? '<p class="field-hint">Você está usando o app instalado. Ele funciona sem internet.</p>'
      : `${deferredInstall ? '<button class="second" id="btnInstall" type="button">Instalar na tela inicial</button>' : ''}
         <p class="field-hint">No Android (Chrome): menu ⋮ → <b>Instalar app</b>. No iPhone (Safari): <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>. Depois de instalado, funciona sem internet.</p>`)
    : tx`<p class="field-hint">Esta versão roda dentro do Claude. Para instalar na tela inicial e jogar sem internet, abra a versão publicada em <code>${PAGES_URL}</code> e use <b>Adicionar à tela inicial</b>.</p>`;
  $('setupBody').innerHTML = `
    <div class="setup-block">
      <h3>Novo jogo</h3>
      <div class="field"><span class="field-label">${tx`[[jogo]]Mesa`}</span>${segHTML('table', [['6', tx`6 jogadores`], ['9', tx`9 jogadores`], ['hu', 'Heads-up'], ['spin', 'Spin & Go']], d.table)}
        ${d.table === '9' ? tx`<p class="field-hint">Mesa cheia, como nos torneios grandes: as três primeiras posições (UTG, UTG+1, UTG+2) jogam ainda mais fechado, e os seis últimos lugares usam as faixas da mesa de 6. No torneio, pagam 3 lugares (50/30/20).</p>` : ''}${d.table === 'spin' ? tx`<p class="field-hint">3 jogadores, 500 fichas (25 BB), blinds subindo rápido e só o campeão leva o prêmio sorteado (2x a 100x). Treina o jogo de stack curto e o heads-up final.</p>` : ''}</div>
      ${d.table !== 'spin' ? `<div class="field"><span class="field-label">Formato</span>${segHTML('format', [['cash', 'Cash'], ['tourney', tx`Torneio`]], d.format)}
        <p class="field-hint">${d.format === 'cash' ? tx`Blinds fixos de 5/10 e recompra quando as fichas acabam.` : tx`Começa com 1.500 fichas, os blinds sobem e quem zera está fora. Ganha quem ficar com tudo.`}</p></div>` : ''}
      ${d.table === 'hu' ? `<div class="field"><span class="field-label">Rival</span>${segHTML('rival', BOTS.map(b => [b.k, `${b.name} · ${E.PROFILES[b.k].label}`]), d.rival)}</div>` : ''}
      <div class="field"><span class="field-label">Dificuldade</span>${segHTML('skill', [['easy', tx`Iniciante`], ['normal', 'Normal'], ['hard', tx`Difícil`]], d.skill)}<p class="field-hint">${SKILL_HINT[d.skill]}</p></div>
      ${d.format === 'tourney' && d.table === '6' ? `<div class="field"><span class="field-label">Prêmios (em pontos)</span>${segHTML('prize', [['65/35', tx`65/35 · 2 premiados`], ['50/30/20', tx`50/30/20 · 3 premiados`]], d.prize || '65/35')}<p class="field-hint">Com prêmios, o coach usa o ICM: perto da bolha, sobreviver vale mais que ganhar fichas.</p></div>` : ''}
      ${d.table === 'spin' ? `<div class="field"><span class="field-label">Blinds sobem a cada</span>${segHTML('spinPer', [[3, tx`3 mãos`], [4, tx`4 mãos`], [6, tx`6 mãos`]], d.spinPer || 4)}</div>`
        : d.format === 'tourney' ? `<div class="field"><span class="field-label">Blinds sobem a cada</span>${segHTML('per', [[5, tx`5 mãos`], [8, tx`8 mãos`], [12, tx`12 mãos`]], d.per)}</div>` : ''}
      <button class="primary" id="btnStart" type="button">Começar</button>
      ${inHand ? '<p class="field-hint">A mão em andamento será abandonada.</p>' : ''}
    </div>
    <div class="setup-block">
      <h3>Preferências</h3>
      <div class="field"><span class="field-label">Idioma · Language</span>${segHTML('lang', [['pt', 'Português'], ['en', 'English']], E.LANG)}</div>
      <div class="field"><span class="field-label">Velocidade dos bots</span>${segHTML('speed', Object.entries(SPEEDS).map(([k, v]) => [k, v.label]), prefs.speed)}</div>
      <label class="switch" for="soundOn">Sons <input type="checkbox" id="soundOn" ${prefs.sound ? 'checked' : ''}></label>
      ${voice.available ? `<label class="switch" for="voiceOn">Voz anunciando cada ação (fold, call, raise, all-in) <input type="checkbox" id="voiceOn" ${prefs.voice ? 'checked' : ''}></label>` : ''}
      <label class="switch" for="strOn">Mostrar a leitura da mão e da mesa (força, combinação, projetos) <input type="checkbox" id="strOn" ${prefs.showStrength ? 'checked' : ''}></label>
    </div>
    <div class="setup-block install"><h3>App no celular</h3>${installHTML}</div>`;
  $('setupBody').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k, v = k === 'per' || k === 'spinPer' ? +b.dataset.v : b.dataset.v;
    if (k === 'lang') { if (v !== E.LANG) { try { localStorage.setItem('mesa-treino-lang', v); } catch (e) {} location.reload(); } return; }
    if (k === 'speed') { prefs.speed = v; saveCfg(); } else draft[k] = v;
    renderSetup();
  });
  $('strOn').onchange = e => { prefs.showStrength = e.target.checked; saveCfg(); renderTable(); };
  $('soundOn').onchange = e => { prefs.sound = e.target.checked; saveCfg(); sfx.unlock(); setTimeout(() => sfx.chip(), 60); };
  if ($('voiceOn')) $('voiceOn').onchange = e => { prefs.voice = e.target.checked; saveCfg(); voice.say('Raise'); };
  $('btnStart').onclick = () => { closeSetup(); newGame(draft); };
  const bi = $('btnInstall');
  if (bi) bi.onclick = async () => { try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) {} deferredInstall = null; renderSetup(); };
}

