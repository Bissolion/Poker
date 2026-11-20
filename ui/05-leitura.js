// Leitura da mão e da mesa, sempre visível, independente do coach
function reading() {
  const g = game, h = g.players[0];
  const board = anim ? g.board.slice(0, anim.len) : g.board;
  if (board.length < 3 || h.hole.length < 2) return null;
  const key = h.hole.join(',') + '|' + board.join(',');
  if (readCache.key !== key) readCache = { key, board, made: E.madeHand(h.hole, board), draws: E.heroDraws(h.hole, board), read: E.boardRead(board, h.hole) };
  return readCache;
}
const xBtn = '<button type="button" class="str-x" data-str="close" aria-label="Fechar">×</button>';
const ORDER = ['Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência', 'Flush', 'Full house', 'Quadra', 'Straight flush'];
const LABEL_TIP = {
  Seca: 'Poucos projetos possíveis: quem tem a melhor mão agora tende a continuar na frente, e apostas pequenas bastam.',
  Molhada: 'Muitos projetos possíveis: com mão feita, aposte mais para cobrar caro de quem quer completar.',
  Perigosa: 'Já existem mãos fortes possíveis: um par ou dois pares valem bem menos aqui.',
  Pareada: 'Com par na mesa, trinca, full house e quadra ficam possíveis: cuidado com apostas grandes.',
};
function strengthHTML() {
  const g = game, h = g.players[0];
  if (!prefs.showStrength || h.out || h.hole.length < 2) return '';
  const [a, b] = h.hole, br = E.chenBreakdown(a, b), combo = E.comboName(a, b);
  const rd = reading();
  // quadro da esquerda: força antes do flop, sua combinação depois
  let left;
  if (!rd || h.folded) {
    const top = `<span class="str-top">Força <b class="str-n">${fmtN(br.total)}</b><span class="str-combo">${combo}</span></span>`;
    left = strOpen === 'force' || (strOpen === 'hand' && (!rd || h.folded)) ? forcePop(br, combo, top)
      : `<button type="button" class="str" data-str="force" aria-expanded="false" aria-label="Força da mão ${combo}: ${br.total} de 20. Toque para ver a fórmula">${top}<span class="str-calc">${br.calc}</span></button>`;
  } else {
    const m = rd.made, d = rd.draws, r = rd.read;
    const ahead = (r.tot - r.beat - r.tie) / r.tot;
    const sub = d ? `${d.name} · ${d.outs} outs` : m.boardOnly ? 'Está na mesa: vale para todos' : r.heroNuts ? 'Melhor mão possível' : `À frente de ${pct(ahead)} das mãos`;
    left = strOpen === 'hand' ? handPop(rd, br, combo)
      : strOpen === 'force' ? forcePop(br, combo, `<span class="str-top">Força <b class="str-n">${fmtN(br.total)}</b><span class="str-combo">${combo}</span></span>`)
      : `<button type="button" class="str" data-str="hand" aria-expanded="false" aria-label="Sua mão: ${m.name}. Toque para detalhes"><span class="str-top wrap">Você <b class="str-hand">${m.short}</b></span><span class="str-calc">${sub}</span></button>`;
  }
  // quadro da direita: o que a mesa permite
  let right = '';
  if (rd) {
    const r = rd.read;
    right = strOpen === 'board' ? boardPop(rd)
      : `<button type="button" class="str right" data-str="board" aria-expanded="false" aria-label="Mesa ${r.label}. Toque para ver as mãos possíveis"><span class="str-top">Mesa <b class="str-lbl lbl-${r.label}">${r.label}</b></span><span class="str-calc">${r.tags.slice(0, 2).join(' · ') || 'Sem projetos'}</span></button>`;
  }
  // um popover aberto cobre o outro quadro
  if (strOpen === 'board') return right;
  if (strOpen) return left;
  return left + right;
}
function forcePop(br, combo, top) {
  const g = game, pos = g.posOf(0), nAct = g.activeCount(), t = E.preflopRule(br.total, pos, 0, pos === 'BB', nAct).t;
  const ref = pos === 'BB' ? `No <b>Big blind</b>, se ninguém aumentar: aumente com força <b>${t}+</b>, senão passe de graça.` : `Para abrir no <b>${E.POS_LABEL[pos]}</b>${nAct === 2 ? ' (heads-up)' : ''}: força <b>${t}+</b>. Sua mão ${br.total >= t ? 'entra' : 'não entra'}.`;
  return `<div class="str-pop" role="dialog" aria-label="Fórmula da força da mão">
    <div class="str-head">${top}${xBtn}</div>
    <ol class="str-steps">${br.steps.map(x => `<li>${x}</li>`).join('')}</ol>
    <div class="str-sum">${br.calc} <span style="color:var(--muted);font-weight:500">de 20</span></div>
    <p class="str-rules"><b>Fórmula de Chen.</b> Carta mais alta: A = 10, K = 8, Q = 7, J = 6, 10 a 2 valem metade do número. Par: dobra (mínimo 5). Mesmo naipe: +2. Buraco entre as cartas: 1 → −1, 2 → −2, 3 → −4, 4 ou mais → −5. Bônus +1 se seguidas ou com 1 de buraco e as duas abaixo da Q. Arredonde para cima.</p>
    <div class="str-ref">${ref}</div>
  </div>`;
}
function handPop(rd, br, combo) {
  const m = rd.made, d = rd.draws, r = rd.read, core = new Set(m.core);
  const ahead = (r.tot - r.beat - r.tie) / r.tot;
  const cards = m.best5.map(c => card(c, 'sm', core.has(c) ? 'made' : 'dim')).join('');
  const drawHTML = d ? `<p class="str-note"><b>${d.name}: ${d.outs} outs</b>${d.flush && d.straight ? ` (${d.flush} para flush + ${d.straight} para sequência, sem contar as repetidas)` : ''}. Regra do 2 e 4: ${d.outs} × ${d.left === 2 ? 4 : 2} ≈ ${d.approx}% de completar ${d.left === 2 ? 'até o river' : 'no river'} (exato: ${pct(d.exact)}).</p>` : '';
  const boardNote = m.boardOnly ? `<p class="str-note">Essa combinação está toda na mesa, então todo mundo tem. Quem decide é a carta mais alta fora dela (o kicker).</p>` : '';
  const vs = r.heroNuts ? '<b>Você tem a melhor mão possível agora (nuts).</b>' : `Contra uma mão qualquer, você está à frente de <b>${pct(ahead)}</b>: ${r.beat} de ${r.tot} combinações ganham de você${r.tie ? ` e ${r.tie} empatam` : ''}. Isso não leva em conta como os rivais jogaram.`;
  const order = ORDER.map((x, i) => i === m.cat ? `<b>${x}</b>` : x).join(' < ');
  return `<div class="str-pop" role="dialog" aria-label="Sua mão">
    <div class="str-head"><span class="str-top wrap">Você <b class="str-hand">${m.name}</b></span>${xBtn}</div>
    <div class="str-cards">${cards}</div>
    ${boardNote}${drawHTML}
    <p class="str-rules">${vs}</p>
    <p class="str-order">${order}</p>
    <div class="str-ref">Força pré-flop de ${combo}: <b>${fmtN(br.total)}</b> (${br.calc}). <button type="button" class="str-link" data-str="force">Ver a fórmula</button></div>
  </div>`;
}
function boardPop(rd) {
  const r = rd.read;
  const ex = r.nuts.ex ? r.nuts.ex.map(c => card(c, 'sm')).join('') : '';
  return `<div class="str-pop right" role="dialog" aria-label="O que a mesa permite">
    <div class="str-head"><span class="str-top">Mesa <b class="str-lbl lbl-${r.label}">${r.label}</b></span>${xBtn}</div>
    <p class="str-rules">${LABEL_TIP[r.label]}</p>
    <ul class="str-list">${r.items.map(x => `<li class="${x.lv}">${x.text}</li>`).join('')}</ul>
    <div class="str-cards"><span>Melhor mão possível: <b style="color:var(--ink)">${r.nuts.name}</b>, por exemplo com</span>${ex}</div>
    <div class="str-ref">Você: <b>${rd.made.name}</b>${rd.draws ? ` + ${rd.draws.name}` : ''}${r.heroNuts ? ' (a melhor possível)' : ''}.</div>
  </div>`;
}
const skillLabel = () => (E.SKILLS[cfg.skill] || E.SKILLS.normal).label;
function renderStatus() {
  const g = game, el = $('statusbar');
  const opp = cfg.table === 'hu' ? `Heads-up vs <b>${g.players[1].name}</b>` : `<b>${g.activeCount()}</b> na mesa`;
  const me = g.players[0];
  const heroBB = me.out ? '' : `Você: <b>${Math.round((anim ? me.startStack - me.committed + me.bet : me.stack + me.bet) / g.bb)} BB</b>`;
  if (tour) {
    const left = tour.per - (tour.hands % tour.per);
    const nextTxt = tour.level >= E.BLIND_LEVELS.length - 1 ? 'nível final' : left === 1 ? 'última mão do nível' : `sobe em ${left} mãos`;
    el.innerHTML = `<span class="sb-main${tour.flash ? ' flash' : ''}">Torneio · Nível ${tour.level + 1} · <b>${g.sb}/${g.bb}</b> · ${nextTxt} · ${opp}</span><span class="sb-side">${heroBB}</span>`;
    tour.flash = false;
  } else {
    el.innerHTML = `<span class="sb-main">Cash · ${opp} · ${skillLabel()} · <b>${g.sb}/${g.bb}</b></span><span class="sb-side">${heroBB}</span>`;
  }
}

function limpersFor(seat) { const g = game; return g.players.filter(q => q.seat !== seat && !q.folded && q.bet === g.bb && g.posOf(q.seat) !== 'BB').length; }
function presetsFor(L) {
  const g = game, bb = g.bb, hu = g.activeCount() === 2;
  if (g.street === 'preflop' && g.raises === 0) return (hu ? [['2 BB', 2 * bb], ['2,5 BB', 2.5 * bb], ['3 BB', 3 * bb]] : [['2,5 BB', 2.5 * bb], ['3 BB', 3 * bb], ['4 BB', 4 * bb]]).concat([['All-in', L.maxTo]]);
  if (g.street === 'preflop') return [['3×', g.currentBet * 3], ['4×', g.currentBet * 4], ['All-in', L.maxTo]];
  const pot = g.pot();
  const f = x => L.isBet ? pot * x : g.currentBet + (pot + L.toCall) * x;
  return [['⅓', f(1 / 3)], ['½', f(.5)], ['¾', f(.75)], ['Pote', f(1)], ['All-in', L.maxTo]];
}
const roundTo = () => game.bb >= 50 ? 10 : 5;
const clampTo = (v, L) => v >= L.maxTo ? L.maxTo : Math.max(L.minTo, Math.min(L.maxTo, Math.round(v / roundTo()) * roundTo()));
function sizeNote(L, to) {
  const g = game;
  if (g.street === 'preflop') {
    if (g.raises === 0) return `= ${(Math.round(to / g.bb * 10) / 10).toString().replace('.', ',')} BB`;
    return `= ${(to / g.currentBet).toFixed(1).replace('.', ',')}× o aumento`;
  }
  const pot = g.pot();
  return L.isBet ? `= ${pct(to / pot)} do pote` : `aumento de ${pct((to - g.currentBet) / (pot + L.toCall))} do pote`;
}
const raiseLabelFor = (L, to) => to >= L.maxTo ? `All-in<small>${L.maxTo}</small>` : L.isBet ? `Apostar<small>${to}</small>` : `Aumentar<small>para ${to}</small>`;

function renderActions() {
  const g = game, el = $('actions');
  if (anim) { el.innerHTML = `<div class="status"><b>All-in.</b> Revelando as cartas…</div>`; return; }
  if (g.handOver) {
    const r = g.result, net = r.net[0], h = g.players[0], w = r.winners.slice().sort((a, b) => b.amount - a.amount);
    let big, sub, cls = '';
    const meWin = w.find(x => x.seat === 0), top = w[0];
    if (meWin) { big = w.length > 1 ? `Pote dividido: +${meWin.amount}` : `Você ganhou ${meWin.amount}`; sub = meWin.hand ? meWin.hand : 'Todos desistiram.'; }
    else { big = `${g.players[top.seat].name} leva ${top.amount}`; sub = (top.hand ? `com ${top.hand}` : 'Todos desistiram.') + (w.length > 1 ? ` (${w.slice(1).map(x => `${g.players[x.seat].name} +${x.amount}`).join(', ')})` : ''); }
    sub += ` · seu saldo na mão: <b>${signed(net)}</b>`;
    const outs = lastOut.filter(o => o.seat !== 0);
    if (outs.length) sub += `<br>${outs.map(o => `${o.name} foi eliminado em ${ordinal(o.place)}`).join(' · ')}`;
    let nextLabel = h.stack === 0 ? 'Recomprar 1000' : 'Próxima mão';
    if (tour && tour.over) {
      cls = ' huge';
      big = tour.place === 1 ? 'Você venceu o torneio!' : `Você terminou em ${ordinal(tour.place)}`;
      sub = `${tour.place === 1 ? `Campeão entre ${tour.n} jogadores em ${plural(tour.hands, 'mão', 'mãos')}.` : `De ${tour.n} jogadores, depois de ${plural(tour.hands, 'mão', 'mãos')}.`} Na última mão: ${meWin ? 'você levou ' + meWin.amount : g.players[top.seat].name + ' levou ' + top.amount}.`;
      nextLabel = 'Novo torneio';
    }
    el.innerHTML = `<div class="result">
      <div class="big${cls}">${big}</div>
      <div class="sub">${sub}</div>
      <div class="result-btns">
        <button class="second" id="btnReplay" type="button">Rever mão</button>
        <button class="next" id="btnNext" type="button">${nextLabel}</button>
      </div>
    </div>`;
    $('btnNext').onclick = () => tour && tour.over ? newGame(cfg) : nextHand();
    $('btnReplay').onclick = () => { replay = { idx: 0, i: firstStep(hands[0]), showAll: false }; openStudy('hands'); };
    return;
  }
  const mine = g.toAct === 0 && decision;
  const h = g.players[0];
  if (!mine) {
    const who = g.players[g.toAct];
    const msg = h.folded ? `Você desistiu. ${who ? who.name + ' está decidindo…' : ''}` : h.allIn ? `Você está all-in. ${who ? who.name + ' está decidindo…' : ''}` : `${who ? who.name : ''} está decidindo…`;
    el.innerHTML = `<div class="status">${msg}</div>
      <div class="btns"><button class="act fold" disabled>Desistir</button><button class="act" disabled>Passar</button><button class="act raise" disabled>Aumentar</button></div>`;
    return;
  }
  const L = decision.L, rec = liveHelp ? decision.rec : null;
  if (!raiseTo) raiseTo = clampTo(defaultRaise(L), L);
  const callLabel = L.canCheck ? 'Passar' : `Pagar<small>${L.toCall}${L.toCall >= h.stack ? ' (all-in)' : ''}</small>`;
  const sizer = L.canRaise && L.maxTo > L.minTo ? `<div class="sizer">
      <div class="presets">${presetsFor(L).map(([lab, v]) => `<button type="button" class="chip" data-to="${clampTo(v, L)}" aria-pressed="${clampTo(v, L) === raiseTo}">${lab}</button>`).join('')}<span class="sz-note" id="szNote">${sizeNote(L, raiseTo)}</span></div>
      <input type="range" id="raiseRange" min="${L.minTo}" max="${L.maxTo}" step="${roundTo()}" value="${raiseTo}" aria-label="Tamanho da aposta">
    </div>` : '';
  el.innerHTML = `${sizer}
    <div class="btns">
      <button type="button" class="act fold ${rec === 'fold' ? 'rec' : ''}" data-act="fold">Desistir</button>
      <button type="button" class="act ${(rec === 'call' || rec === 'check') ? 'rec' : ''}" data-act="call">${callLabel}</button>
      <button type="button" class="act raise ${rec === 'raise' ? 'rec' : ''}" data-act="raise" ${L.canRaise ? '' : 'disabled'}>${L.canRaise ? raiseLabelFor(L, raiseTo) : 'Aumentar'}</button>
    </div>`;
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => heroAct(b.dataset.act));
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => { raiseTo = +b.dataset.to; renderActions(); });
  const rr = $('raiseRange');
  if (rr) rr.oninput = () => {
    raiseTo = clampTo(+rr.value, L);
    el.querySelector('[data-act=raise]').innerHTML = raiseLabelFor(L, raiseTo);
    $('szNote').textContent = sizeNote(L, raiseTo);
    el.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', +c.dataset.to === raiseTo));
  };
}
function defaultRaise(L) {
  const g = game, d = decision;
  if (d && d.adv && d.adv.push) return L.maxTo;
  if (g.street === 'preflop') return g.raises === 0 ? g.bb * (g.activeCount() === 2 ? 2.5 : 3 + limpersFor(0)) : g.currentBet * 3;
  const pot = g.pot();
  return L.isBet ? pot * 0.66 : g.currentBet + (pot + L.toCall) * 0.75;
}

const REC_PT = { fold: 'desistir', check: 'passar', call: 'pagar', raise: 'aumentar' };
const ANIM_ST = { 0: 'antes do flop', 3: 'no flop', 4: 'no turn' };
function renderLive() {
  const el = $('live'), g = game, h = g.players[0];
  if (anim) {
    if (!anim.eq) { el.innerHTML = `<div class="kv"><span>Showdown</span><b>${anim.len === 5 ? 'River' : ''}</b></div><p class="muted">Todas as cartas na mesa. Veja quem ganhou.</p>`; return; }
    const rows = anim.live.map((s, k) => `<div class="eqrow${s === 0 ? ' me' : ''}"><span>${g.players[s].name}</span><span class="bar"><i style="width:${anim.eq[k] * 100}%"></i></span><b>${pct(anim.eq[k])}</b></div>`).join('');
    el.innerHTML = `<div class="kv"><span>Chance de ganhar ${ANIM_ST[anim.len] || ''}</span><b>cartas abertas</b></div><div class="eqbars">${rows}</div>
      <p class="muted">Com todos all-in, não há mais decisões: o resultado depende só das próximas cartas.</p>`;
    return;
  }
  if (g.handOver) { el.innerHTML = `<p class="muted">Mão encerrada. Veja abaixo como foram suas decisões, ou toque em “Rever mão”.</p>`; return; }
  if (h.folded) { el.innerHTML = `<p class="muted">Você está fora desta mão.</p>`; return; }
  if (!(g.toAct === 0 && decision)) {
    const made = g.board.length ? E.handName(E.evalHand([...h.hole, ...g.board])) : E.comboName(h.hole[0], h.hole[1]);
    el.innerHTML = `<div class="kv"><span>Sua mão</span><b>${made}</b></div><p class="muted">${h.allIn ? 'Você está all-in; agora é com as cartas.' : 'Aguardando sua vez.'}</p>`;
    return;
  }
  if (!liveHelp) { el.innerHTML = `<p class="muted">Ajuda ao vivo desligada: decida sozinho. A análise aparece depois da sua jogada.</p>`; return; }
  const d = decision;
  if (d.street === 'preflop') {
    const a = d.adv, s = Math.max(0, a.s), w = Math.min(100, s / 20 * 100), m = Math.max(0, a.t) / 20 * 100;
    const pushRow = a.push ? `<div class="kv"><span>Stack efetivo</span><b class="warn">${a.depth.toString().replace('.', ',')} BB · all-in ou desistir</b></div>` : '';
    el.innerHTML = `<div class="kv"><span>Sua mão</span><b>${a.combo} · força ${a.s} de 20</b></div>
      <div class="kv"><span>Posição</span><b>${E.POS_LABEL[a.pos]}${g.activeCount() < 6 ? ` · ${g.activeCount()} na mesa` : ''}</b></div>${pushRow}
      <div class="meter"><div class="fill ${a.s < a.t ? 'low' : ''}" style="width:${w}%"></div><div class="mark ${m < 12 ? 'edge-l' : ''}" style="left:${m}%"><span>mínimo ${a.t}</span></div></div>
      <div class="scale"><span>0</span><span>20</span></div>
      <div class="rec-line">Sugestão: <b>${a.push && d.rec === 'raise' ? 'all-in' : REC_PT[d.rec]}</b>. ${a.why}${a.push ? '' : ` <button class="link" id="seeRange" type="button">Ver faixa</button>`}</div>`;
    if (!a.push) $('seeRange').onclick = () => { rangeSt = { pos: a.pos, scn: Math.min(2, game.raises), sel: a.combo, hu: game.activeCount() === 2 }; openStudy('ranges'); };
  } else {
    const i = d.info, w = i.eq * 100;
    const markCls = i.need > .85 ? 'edge-r' : i.need < .12 ? 'edge-l' : '';
    const outs = i.draws.length ? Math.min(15, i.draws.reduce((a, x) => a + x.outs, 0) - (i.draws.length > 1 ? 2 : 0)) : 0;
    const drawRow = outs ? `<div class="kv"><span>Projeto</span><b>${i.draws.map(x => x.name).join(' + ')} · ${outs} outs</b></div>
      <div class="rec-line">Regra do 2 e 4: ${outs} outs × ${i.cardsLeft === 2 ? '4' : '2'} ≈ <b>${outs * (i.cardsLeft === 2 ? 4 : 2)}%</b> de chance de completar ${i.cardsLeft === 2 ? 'até o river' : 'no river'}.</div>` : '';
    const reads = i.notes.length ? `<div class="reads"><span class="h">Leitura dos rivais</span>${i.notes.map(n => `<span><b>${n.name}</b> ${n.text}: provável ${n.range}.</span>`).join('')}<span>A equity abaixo já considera essas leituras.</span></div>` : '';
    el.innerHTML = `<div class="kv"><span>Mão feita</span><b>${i.made}</b></div>${drawRow}${reads}
      <div class="kv"><span>Equity contra ${i.nOpp} ${i.nOpp > 1 ? 'rivais' : 'rival'}</span><b>${pct(i.eq)}</b></div>
      <div class="meter"><div class="fill ${i.toCall && i.eq < i.need ? 'low' : ''}" style="width:${w}%"></div>${i.toCall ? `<div class="mark ${markCls}" style="left:${i.need * 100}%"><span>precisa ${pct(i.need)}</span></div>` : ''}</div>
      <div class="scale"><span>0%</span><span>100%</span></div>
      <div class="rec-line">${i.toCall ? `Pote ${i.pot}, para pagar ${i.toCall}: você precisa vencer ${pct(i.need)} das vezes.` : 'Ninguém apostou: passar é de graça.'} Sugestão: <b>${REC_PT[d.rec]}</b>.</div>`;
  }
}
const GRADE_PT = { good: 'Boa', ok: 'Ok', bad: 'Erro' };
const fbHTML = f => `<div class="fb-item ${f.grade}"><span class="pill ${f.grade}">${GRADE_PT[f.grade]}</span><span class="fb-title">${f.title}</span><span class="fb-meta">${f.street} · você: ${f.act}</span><span class="fb-text">${f.text}</span>${f.sizing ? `<span class="fb-size ${f.sizing.grade}"><b>Tamanho</b>${f.sizing.text}</span>` : ''}</div>`;
function renderFb() {
  const el = $('fb');
  if (!handFb.length) { el.innerHTML = game.handOver || game.players[0].folded ? '' : `<p class="muted">Depois de cada jogada sua, a análise aparece aqui.</p>`; return; }
  el.innerHTML = handFb.slice().reverse().map(fbHTML).join('');
}
const STREET_LEN = { Flop: 3, Turn: 4, River: 5 };
function renderLog() {
  let items = game.log.filter(l => l.hand === game.handNo);
  if (anim) items = items.filter(l => !['show', 'win', 'info'].includes(l.kind) && !(l.kind === 'street' && STREET_LEN[l.text.split(':')[0]] > anim.len));
  $('log').innerHTML = items.map(l => `<li class="${l.kind}">${l.text}</li>`).join('');
}

