// ---------- Vazamentos: erros que se repetem ----------
// Entradas: decisões (uma por ação sua) e mãos (uma por mão terminada), como a interface registra.
// decisão: { h, st: rua, pos, n: jogadores, r: aumentos antes, tc: havia o que pagar, a: ação, g: nota,
//            opn: você abriu, agg: você foi o último a aumentar antes do flop, cbo: chance de continuation bet,
//            fcb: enfrentando continuation bet }
// mão: { h, pos, n, vpip, pfr, flop: viu o flop, sd: foi ao showdown, won, net: saldo em BB }
const POS6 = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];
// Faixas saudáveis: o que um jogador que segue as tabelas e o coach do app produz contra estes bots
// (medido em 3.000 mãos simuladas), com margem. Vazamento = se afastar da estratégia que o app ensina.
const STAT_DEF = {
  vpip: { name: 'VPIP', lo: 0.16, hi: 0.26, min: 30, fmt: 'pct' },
  pfr: { name: 'PFR', lo: 0.12, hi: 0.21, min: 30, fmt: 'pct' },
  gap: { name: 'Diferença VPIP − PFR', lo: 0, hi: 0.08, min: 30, fmt: 'pct' },
  vpip_UTG: { name: 'VPIP no UTG', lo: 0.10, hi: 0.22, min: 15, fmt: 'pct' },
  vpip_MP: { name: 'VPIP no Middle', lo: 0.11, hi: 0.23, min: 15, fmt: 'pct' },
  vpip_CO: { name: 'VPIP no Cutoff', lo: 0.11, hi: 0.25, min: 15, fmt: 'pct' },
  vpip_BTN: { name: 'VPIP no Botão', lo: 0.22, hi: 0.40, min: 15, fmt: 'pct' },
  vpip_SB: { name: 'VPIP no Small blind', lo: 0.10, hi: 0.25, min: 15, fmt: 'pct' },
  vpip_BB: { name: 'VPIP no Big blind', lo: 0.15, hi: 0.33, min: 15, fmt: 'pct' },
  threebet: { name: '3-bet', lo: 0.03, hi: 0.08, min: 25, fmt: 'pct' },
  fold3bet: { name: 'Desiste contra 3-bet', lo: 0.50, hi: 0.88, min: 12, fmt: 'pct' },
  cbet: { name: 'Continuation bet', lo: 0.40, hi: 0.75, min: 15, fmt: 'pct' },
  foldcbet: { name: 'Desiste contra continuation bet', lo: 0.30, hi: 0.62, min: 15, fmt: 'pct' },
  wtsd: { name: 'Vai ao showdown', lo: 0.38, hi: 0.62, min: 25, fmt: 'pct' },
  wsd: { name: 'Ganha no showdown', lo: 0.45, hi: 1, min: 15, fmt: 'pct' },
  af: { name: 'Agressividade', lo: 1.5, hi: 4.5, min: 25, fmt: 'num' },
  rivercall: { name: 'Calls certos no river', lo: 0.6, hi: 1, min: 10, fmt: 'pct' },
};
// O que cada desvio significa e o que fazer; sel = quais mãos mostrar no replay
const LEAK_TXT = {
  vpip: { high: ['Você entra em mãos demais', 'Mãos fracas jogadas por vontade própria perdem fichas aos poucos, principalmente fora de posição.', 'Siga a grade de faixas e desista mais antes do flop.'], low: ['Você joga mãos de menos', 'Desistir demais entrega os blinds e deixa os rivais roubarem sem resistência.', 'Abra mais do Cutoff e do Botão e defenda mais o Big blind.'] },
  pfr: { high: ['Você aumenta demais antes do flop', 'Aumentar com mãos fracas cria potes grandes em que você está atrás.', 'Aumente com a faixa da tabela; o resto desiste.'], low: ['Você aumenta pouco antes do flop', 'Quem só paga deixa a iniciativa com o rival e ganha menos potes sem showdown.', 'Troque calls por aumentos quando for abrir: abra aumentando, não completando.'] },
  gap: { high: ['Você paga demais em vez de aumentar', 'Uma diferença grande entre VPIP e PFR mostra muitos calls passivos antes do flop, que perdem mais que aumentos.', 'Quando a mão é boa para entrar, entre aumentando; quando não é, desista.'] },
  threebet: { high: ['Você faz 3-bet demais', 'Re-aumentar com mãos fracas custa caro quando o rival devolve um 4-bet.', 'Faça 3-bet com a faixa da tabela: mãos fortes e alguns blefes como A5s.'], low: ['Você quase não faz 3-bet', 'Só pagar aumentos deixa os rivais abrirem à vontade e te põe em potes grandes sem iniciativa.', 'Re-aumente com QQ+, AK e alguns ases do mesmo naipe, principalmente contra aberturas do Botão.'] },
  fold3bet: { high: ['Você desiste demais contra 3-bet', 'Se você abre e quase sempre larga contra re-aumento, os rivais lucram re-aumentando qualquer coisa.', 'Pague ou devolva com a faixa da tabela "Contra 3-bet", principalmente quando abriu de posição final.'], low: ['Você continua demais contra 3-bet', 'Pagar re-aumentos com mãos medianas te põe em potes grandes atrás da faixa forte do rival.', 'Contra 3-bet, continue só com as mãos da tabela.'] },
  cbet: { high: ['Você faz continuation bet demais', 'Apostar todo flop, mesmo em mesa molhada e contra vários rivais, queima fichas quando o rival acertou.', 'Aposte em mesa seca; em mesa molhada ou contra vários rivais, só com mão ou projeto.'], low: ['Você faz pouca continuation bet', 'Quem aumentou antes do flop tem a faixa mais forte; passar demais desperdiça essa vantagem.', 'Em mesa seca contra um rival, aposte pequeno com quase tudo.'] },
  foldcbet: { high: ['Você desiste demais contra continuation bet', 'O rival lucra apostando qualquer flop contra você.', 'Pague com pares, projetos e cartas altas com chance de melhorar; use as pot odds.'], low: ['Você não larga contra continuation bet', 'Pagar com nada no flop leva a decisões caras no turn e no river.', 'Sem par, sem projeto e sem carta alta útil, desista.'] },
  wtsd: { high: ['Você vai ao showdown demais', 'Chegar ao fim com mãos fracas é sinal de calls demais no turn e no river.', 'No turn e no river, pague só quando a equity cobrir as pot odds.'], low: ['Você vai ao showdown de menos', 'Largar demais no fim deixa os rivais blefarem com lucro.', 'Contra apostas no river, use a defesa mínima como guia.'] },
  wsd: { low: ['Você perde muito no showdown', 'Chegar ao showdown e perder mostra calls com mãos piores que a faixa de quem apostou.', 'Antes de pagar no river, veja o que a aposta do rival representa no painel do coach.'] },
  af: { high: ['Você é agressivo demais depois do flop', 'Apostar e aumentar quase sempre fica fácil de explorar: os rivais pagam leve e pegam seus blefes.', 'Passe mais com mão média e deixe os blefes para mesas em que sua história faz sentido.'], low: ['Você é passivo depois do flop', 'Pagar muito e apostar pouco ganha menos com mãos boas e não tira ninguém do pote.', 'Aposte por valor com mão boa e use projetos fortes para semi-blefar.'] },
  rivercall: { low: ['Seus calls no river erram muito', 'O river é a rua mais cara: cada call errado custa a aposta inteira.', 'Compare a equity com as pot odds e veja a faixa do rival antes de pagar.'] },
};
for (const p of POS6) LEAK_TXT['vpip_' + p] = {
  high: [`Você joga demais do ${STAT_DEF['vpip_' + p].name.replace('VPIP no ', '')}`, 'Entrar com mãos de fora da faixa nessa posição perde fichas, principalmente quando ainda há muitos jogadores para agir.', `Abra a grade de faixas na posição ${p} e jogue só o que estiver colorido.`],
  low: [`Você joga de menos do ${STAT_DEF['vpip_' + p].name.replace('VPIP no ', '')}`, p === 'BB' ? 'O Big blind já pagou um blind inteiro: desistir demais entrega fichas.' : 'Desistir de mãos que lucram nessa posição deixa fichas na mesa.', `Abra a grade de faixas na posição ${p} e jogue tudo o que estiver colorido.`],
};
function leakStats(decs, hands) {
  const r = (num, den) => ({ v: den ? num / den : null, n: den });
  const six = hands.filter(h => h.n >= 5), dsix = decs.filter(d => d.n >= 5);
  const S = {};
  S.vpip = r(six.filter(h => h.vpip).length, six.length);
  S.pfr = r(six.filter(h => h.pfr).length, six.length);
  S.gap = { v: S.vpip.v == null ? null : Math.max(0, S.vpip.v - S.pfr.v), n: six.length };
  for (const p of POS6) { const hs = six.filter(h => h.pos === p); S['vpip_' + p] = r(hs.filter(h => h.vpip).length, hs.length); }
  const vsOpen = dsix.filter(d => d.st === 'preflop' && d.r === 1 && !d.opn);
  S.threebet = r(vsOpen.filter(d => d.a === 'raise').length, vsOpen.length);
  const faced3 = decs.filter(d => d.st === 'preflop' && d.r === 2 && d.opn);
  S.fold3bet = r(faced3.filter(d => d.a === 'fold').length, faced3.length);
  const cbo = decs.filter(d => d.cbo);
  S.cbet = r(cbo.filter(d => d.a === 'raise').length, cbo.length);
  const fcb = decs.filter(d => d.fcb);
  S.foldcbet = r(fcb.filter(d => d.a === 'fold').length, fcb.length);
  const saw = hands.filter(h => h.flop);
  S.wtsd = r(saw.filter(h => h.sd).length, saw.length);
  const sd = hands.filter(h => h.sd);
  S.wsd = r(sd.filter(h => h.won).length, sd.length);
  const post = decs.filter(d => d.st !== 'preflop');
  const aggr = post.filter(d => d.a === 'raise').length, calls = post.filter(d => d.a === 'call').length;
  S.af = { v: calls ? aggr / calls : aggr ? 9 : null, n: post.length };
  const rc = decs.filter(d => d.st === 'river' && d.a === 'call');
  S.rivercall = r(rc.filter(d => d.g === 'good').length, rc.length);
  return S;
}
// Mãos ligadas a cada vazamento (para o replay e para medir o resultado real)
function leakHands(id, dir, decs, hands) {
  if (id.startsWith('vpip_')) { const p = id.slice(5); return hands.filter(h => h.n >= 5 && h.pos === p && (dir === 'high' ? h.vpip : !h.vpip)).map(h => h.h); }
  const pick = {
    vpip: () => hands.filter(h => h.n >= 5 && (dir === 'high' ? h.vpip : !h.vpip)).map(h => h.h),
    pfr: () => hands.filter(h => h.n >= 5 && (dir === 'high' ? h.pfr : h.vpip && !h.pfr)).map(h => h.h),
    gap: () => hands.filter(h => h.vpip && !h.pfr).map(h => h.h),
    threebet: () => decs.filter(d => d.st === 'preflop' && d.r === 1 && !d.opn && (dir === 'high' ? d.a === 'raise' : d.a === 'call')).map(d => d.h),
    fold3bet: () => decs.filter(d => d.st === 'preflop' && d.r === 2 && d.opn && (dir === 'high' ? d.a === 'fold' : d.a !== 'fold')).map(d => d.h),
    cbet: () => decs.filter(d => d.cbo && (dir === 'high' ? d.a === 'raise' : d.a !== 'raise')).map(d => d.h),
    foldcbet: () => decs.filter(d => d.fcb && (dir === 'high' ? d.a === 'fold' : d.a !== 'fold')).map(d => d.h),
    wtsd: () => hands.filter(h => h.flop && (dir === 'high' ? h.sd : !h.sd)).map(h => h.h),
    wsd: () => hands.filter(h => h.sd && !h.won).map(h => h.h),
    af: () => decs.filter(d => d.st !== 'preflop' && (dir === 'high' ? d.a === 'raise' : d.a === 'call')).map(d => d.h),
    rivercall: () => decs.filter(d => d.st === 'river' && d.a === 'call' && d.g !== 'good').map(d => d.h),
  }[id];
  return pick ? [...new Set(pick())] : [];
}
// Os vazamentos, do mais grave para o menos grave
function findLeaks(decs, hands) {
  const S = leakStats(decs, hands), out = [];
  for (const [id, def] of Object.entries(STAT_DEF)) {
    const s = S[id];
    if (!s || s.v == null || s.n < def.min) continue;
    const dir = s.v > def.hi ? 'high' : s.v < def.lo ? 'low' : null;
    if (!dir || !(LEAK_TXT[id] || {})[dir]) continue;
    const dist = dir === 'high' ? s.v - def.hi : def.lo - s.v;
    // só conta com evidência: o desvio tem de passar de 1,64 erro-padrão (95% de confiança, unilateral)
    const edge = dir === 'high' ? def.hi : def.lo;
    const se = def.fmt === 'pct' ? Math.sqrt(Math.max(0.02, edge * (1 - edge)) / s.n) : Math.max(0.3, edge * 0.5) / Math.sqrt(s.n / 10);
    const z = dist / se;
    if (z < 1.64) continue;
    const sev = z;
    const hs = leakHands(id, dir, decs, hands), hset = new Set(hs);
    const net = hands.filter(h => hset.has(h.h)).reduce((a, h) => a + h.net, 0);
    const [title, why, todo] = LEAK_TXT[id][dir];
    out.push({ id, dir, title, why, todo, value: s.v, n: s.n, lo: def.lo, hi: def.hi, fmt: def.fmt, name: def.name, sev, hands: hs, net: Math.round(net * 10) / 10 });
  }
  return out.sort((a, b) => b.sev - a.sev);
}
// Registro de uma decisão (antes de aplicar a ação) e de uma mão (depois que terminou)
function decisionRecord(g, seat, type, grade) {
  const L = g.legal(seat), pre = g.street === 'preflop';
  const bettor = L.toCall > 0 ? g.players.find(q => q.seat !== seat && !q.folded && q.bet === g.currentBet) : null;
  return {
    h: g.handNo, st: g.street, pos: g.posOf(seat), n: g.activeCount(), r: g.raises, tc: L.toCall > 0, a: type, g: grade,
    opn: g.pfOpener === seat, agg: g.pfAgg === seat,
    cbo: g.street === 'flop' && g.pfAgg === seat && L.toCall === 0 && g.raises === 0 || undefined,
    fcb: g.street === 'flop' && L.toCall > 0 && g.raises === 1 && bettor && bettor.seat === g.pfAgg || undefined,
  };
}
function handRecord(g, seat, flags) {
  const p = g.players[seat], r = g.result;
  return {
    h: g.handNo, pos: g.posOf(seat) || '', n: g.activeCount(), vpip: !!flags.vpip, pfr: !!flags.pfr,
    flop: !!flags.flop, sd: !!(r.showdown && !p.folded), won: r.net[seat] > 0, net: Math.round(r.net[seat] / g.bb * 10) / 10,
  };
}
