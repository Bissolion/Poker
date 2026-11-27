// Resume os cenários extras (tools/spots/<cenário>/*.json) em tabelas por textura e tipo de mão
// e grava engine/19-spots-dados.js. Uso: node tools/resumir-spots.js
const fs = require('fs');
const path = require('path');
const P = require('../dist/engine.js');
const root = path.join(__dirname, 'spots');
const R = '23456789TJQKA', SU = { s: 0, h: 1, d: 2, c: 3 };
const card = s => R.indexOf(s[0]) * 4 + SU[s[1]];
const cards = s => s.match(/../g).map(card);
const CATS = P.FLOP_CATS;
const blank = keys => Object.fromEntries(CATS.map(c => [c, Object.fromEntries(keys.map(k => [k, 0]))]));
const norm = (o, fb) => {
  const out = {};
  for (const c of CATS) {
    const tot = Object.values(o[c]).reduce((a, b) => a + b, 0);
    out[c] = tot > 0.3 ? Object.fromEntries(Object.entries(o[c]).map(([k, v]) => [k, Math.round(v / tot * 100) / 100])) : fb ? fb[c] : null;
  }
  return out;
};
// tipo da carta do turn em relação ao flop
function turnType(flop, t) {
  const fr = flop.map(c => c >> 2), fs = flop.map(c => c & 3);
  if (fr.includes(t >> 2)) return 'par';
  if (fs.filter(s => s === (t & 3)).length >= 2) return 'naipe';
  if ((t >> 2) > Math.max(...fr)) return 'alta';
  return 'baixa';
}
const out = {}, report = [];
for (const name of fs.existsSync(root) ? fs.readdirSync(root).sort() : []) {
  const files = fs.readdirSync(path.join(root, name)).filter(f => f.endsWith('.json'));
  if (!files.length) continue;
  const acc = {}, turn = { baixa: blank(['check', 'bet']), alta: blank(['check', 'bet']), naipe: blank(['check', 'bet']), par: blank(['check', 'bet']) };
  const get = k => acc[k] || (acc[k] = { n: 0, expl: 0, cbet: blank(['check', 'small', 'big']), defesa: { pequena: blank(['fold', 'call', 'raise']), grande: blank(['fold', 'call', 'raise']) }, share: Object.fromEntries(CATS.map(c => [c, 0])) });
  let pot = 0, stack = 0, aggr = 'ip';
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(root, name, f), 'utf8'));
    pot = d.pot; stack = d.stack; aggr = d.aggr;
    const board = cards(d.flop), key = P.flopTexKey(board), T = [get(key), get('geral')];
    T.forEach(t => { t.n++; t.expl += d.expl; });
    const ag = d.aggr === 'ip' ? 1 : 0, df = 1 - ag;
    const hA = d['hands' + ag].map(cards), hD = d['hands' + df].map(cards);
    const cA = hA.map(h => P.flopCat(h, board)), cD = hD.map(h => P.flopCat(h, board));
    const c = d.cbet, slot = a => a === 'Check' ? 'check' : (+(a.match(/\d+/) || [0])[0]) / d.pot < 0.5 && !/AllIn/.test(a) ? 'small' : 'big';
    hA.forEach((h, i) => { const w = c.nw[i]; if (!w) return; for (const t of T) { t.share[cA[i]] += w; c.actions.forEach((a, k) => { t.cbet[cA[i]][slot(a)] += w * c.s[k * c.n + i]; }); } });
    for (const b of d.def) {
      const size = b.bet / d.pot < 0.5 ? 'pequena' : 'grande', r = b.r;
      hD.forEach((h, i) => { const w = r.nw[i]; if (!w) return; for (const t of T) r.actions.forEach((a, k) => { const sl = a === 'Fold' ? 'fold' : a === 'Call' ? 'call' : 'raise'; t.defesa[size][cD[i]][sl] += w * r.s[k * r.n + i]; }); });
    }
    for (const tu of d.turn || []) {
      const tc = card(tu.card), b4 = [...board, tc], tt = turnType(board, tc), r = tu.r;
      hA.forEach((h, i) => {
        const w = r.nw[i]; if (!w || h.includes(tc)) return;
        const cat = P.flopCat(h, b4);
        r.actions.forEach((a, k) => { turn[tt][cat][a === 'Check' ? 'check' : 'bet'] += w * r.s[k * r.n + i]; });
      });
    }
  }
  const G = acc.geral, geral = { cbet: norm(G.cbet), defesa: { pequena: norm(G.defesa.pequena), grande: norm(G.defesa.grande) },
    total: Math.round(CATS.reduce((a, c) => a + G.cbet[c].small + G.cbet[c].big, 0) / Object.values(G.share).reduce((a, b) => a + b, 0) * 100) / 100 };
  const tex = {};
  for (const k of Object.keys(acc).filter(k => k !== 'geral').sort()) {
    const t = acc[k], tot = Object.values(t.share).reduce((a, b) => a + b, 0);
    tex[k] = { flops: t.n, cbet: norm(t.cbet, geral.cbet), defesa: { pequena: norm(t.defesa.pequena, geral.defesa.pequena), grande: norm(t.defesa.grande, geral.defesa.grande) },
      total: Math.round(CATS.reduce((a, c) => a + t.cbet[c].small + t.cbet[c].big, 0) / tot * 100) / 100 };
  }
  out[name] = { pot, stack, aggr, flops: files.length, expl: Math.round(G.expl / G.n * 10) / 10, geral, tex };
  if (Object.values(turn.baixa).some(o => o.check + o.bet > 0)) {
    const tg = {}; for (const k of Object.keys(turn)) tg[k] = norm(turn[k]);
    out[name].turn = tg;
  }
  report.push(`${name}: ${files.length} flops, erro ${out[name].expl}% do pote, aposta no flop ${Math.round(CATS.reduce((a, c) => a + G.cbet[c].small + G.cbet[c].big, 0) / Object.values(G.share).reduce((a, b) => a + b, 0) * 100)}%`);
}
const js = `// Gerado por tools/resumir-spots.js (cenários extras do solver). Não edite à mão.
// Unidades: décimos de big blind. aggr: quem aumentou por último antes do flop está em posição (ip) ou fora (oop).
// turn: segunda bala no pote de abertura Botão x BB, depois de apostar 3/4 no flop e levar call, por tipo de turn.
const SPOTS = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'engine', '19-spots-dados.js'), js);
report.forEach(r => console.log(r));
