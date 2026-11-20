const E = Poker;
const SYM = E.SUIT_CH;
const BOTS = [
  { name: 'Marta', k: 'tag' }, { name: 'Diego', k: 'lag' }, { name: 'Seu Zé', k: 'station' },
  { name: 'Helena', k: 'nit' }, { name: 'Rafa', k: 'bal' },
];
const $ = id => document.getElementById(id);
const IS_PWA = !!window.__MESA_PWA;
const PAGES_URL = 'bissolion.github.io/poker';

// ---- estado salvo ----
const KEY = 'mesa-treino-v1', KEY_H = 'mesa-treino-maos-v1', KEY_CFG = 'mesa-treino-cfg-v1', MAX_HANDS = 25;
const blank = () => ({ hands: 0, net: 0, vpip: 0, pfr: 0, good: 0, ok: 0, bad: 0, rebuys: 0, recent: [], tourneys: [], quiz: { pot: [0, 0], outs: [0, 0], win: [0, 0], open: [0, 0], tex: [0, 0], nuts: [0, 0], combos: [0, 0], mdf: [0, 0], streak: 0, best: 0 }, drills: {} });
const DEF_CFG = { format: 'cash', table: '6', rival: 'lag', skill: 'normal', per: 8, prize: '65/35' };
const DEF_PREFS = { speed: 'normal', sound: false, showStrength: true };
let stats = blank(), liveHelp = true, hands = [], cfg = { ...DEF_CFG }, prefs = { ...DEF_PREFS };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
{
  const s = load(KEY, null);
  if (s) { stats = Object.assign(blank(), s.stats || {}); stats.quiz = Object.assign(blank().quiz, stats.quiz || {}); stats.drills = stats.drills || {}; if (!Array.isArray(stats.tourneys)) stats.tourneys = []; if (typeof s.liveHelp === 'boolean') liveHelp = s.liveHelp; }
  const h = load(KEY_H, []); if (Array.isArray(h)) hands = h;
  const c = load(KEY_CFG, null); if (c) { cfg = Object.assign({ ...DEF_CFG }, c.cfg || {}); prefs = Object.assign({ ...DEF_PREFS }, c.prefs || {}); }
}
const save = () => store(KEY, { stats, liveHelp });
const saveHands = () => { if (!store(KEY_H, hands)) { hands = hands.slice(0, 8); store(KEY_H, hands); } };
const saveCfg = () => store(KEY_CFG, { cfg, prefs });
// Registro de decisões e mãos para os vazamentos (cada sessão = uma abertura do app)
const KEY_REG = 'mesa-treino-reg-v1', SESSION = Date.now();
let reg = load(KEY_REG, { decs: [], hands: [] });
if (!reg || !Array.isArray(reg.decs) || !Array.isArray(reg.hands)) reg = { decs: [], hands: [] };
const saveReg = () => { reg.decs = reg.decs.slice(-3000); reg.hands = reg.hands.slice(-1500); if (!store(KEY_REG, reg)) { reg.decs = reg.decs.slice(-800); reg.hands = reg.hands.slice(-400); store(KEY_REG, reg); } };
$('liveHelp').checked = liveHelp;

const SPEEDS = { slow: { label: tx`Lenta`, think: 1300, run: 1500 }, normal: { label: 'Normal', think: 750, run: 1100 }, fast: { label: tx`Rápida`, think: 350, run: 750 }, turbo: { label: tx`Turbo`, think: 90, run: 450 } };
const speed = () => SPEEDS[prefs.speed] || SPEEDS.normal;

