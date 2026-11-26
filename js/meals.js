// Générateur de repas : choisit des aliments compatibles (régime, allergies, dégoûts)
// puis résout les quantités pour coller aux objectifs de macros de chaque repas.
import { FOODS, FOOD_BY_ID, dietExcludes, macrosFor } from './foods.js';
import { norm, r0 } from './util.js';

let EXTRA = {};
export const setExtraFoods = (list) => { EXTRA = Object.fromEntries((list || []).map((f) => [f.id, f])); };
export const getFood = (id) => FOOD_BY_ID[id] || EXTRA[id] || null;

export const MEALS = [
  { key: 'b', label: 'Petit-déjeuner', share: 0.25, icon: '☀️' },
  { key: 'l', label: 'Déjeuner', share: 0.32, icon: '🍽️' },
  { key: 's', label: 'Collation', share: 0.13, icon: '🍎' },
  { key: 'd', label: 'Dîner', share: 0.30, icon: '🌙' },
];
// Repas du journal : les 4 repas du plan + une catégorie « Extras » (hors plan : boissons, snacks, écarts…).
export const LOG_MEALS = [...MEALS, { key: 'x', label: 'Extras', share: 0, icon: '🍫' }];
export const MEAL_LABEL = Object.fromEntries(LOG_MEALS.map((m) => [m.key, m.label]));

const SLOTS = {
  b: {
    P: ['skyr', 'oeuf', 'fb0', 'grec', 'whey', 'cottage', 'blanc_oeuf', 'prot_pois'],
    C: ['avoine', 'pain_complet', 'galette_riz', 'muesli'],
    X: [['banane', 'fruits_rouges', 'pomme', 'kiwi', 'orange'], 120],
    F: ['amandes', 'beurre_cacahuete', 'noix', 'chia'],
  },
  l: {
    P: ['poulet', 'boeuf5', 'saumon', 'dinde', 'thon', 'tofu', 'cabillaud', 'rumsteck', 'crevettes', 'porc_filet', 'tempeh', 'pst'],
    C: ['riz', 'pates', 'patate_douce', 'quinoa', 'semoule', 'pdt', 'riz_complet', 'lentilles'],
    X: [['brocoli', 'haricots_verts', 'courgette', 'poivron', 'epinards', 'poelee', 'champignons', 'chou_fleur'], 200],
    F: ['huile_olive', 'avocat', 'huile_colza'],
  },
  s: {
    P: ['skyr', 'fb0', 'grec', 'whey', 'cottage', 'prot_pois'],
    C: [],
    X: [['pomme', 'banane', 'kiwi', 'poire', 'ananas', 'fruits_rouges'], 130],
    F: ['amandes', 'noix', 'cajou', 'choco85', 'graines_courge'],
  },
  d: {
    P: ['cabillaud', 'dinde', 'poulet', 'oeuf', 'saumon', 'boeuf5', 'tofu', 'crevettes', 'thon', 'tempeh', 'porc_filet', 'pst'],
    C: ['patate_douce', 'riz', 'quinoa', 'pdt', 'pates', 'lentilles', 'riz_complet', 'semoule'],
    X: [['courgette', 'haricots_verts', 'brocoli', 'epinards', 'chou_fleur', 'poelee', 'champignons', 'carotte'], 220],
    F: ['huile_olive', 'huile_colza', 'avocat'],
  },
};

// Bornes de quantité (g) par aliment ou catégorie.
const BOUNDS = {
  whey: [20, 45], prot_pois: [20, 45], oeuf: [110, 220], blanc_oeuf: [100, 300], pst: [40, 90],
  avoine: [30, 100], muesli: [30, 80], pain_complet: [35, 140], galette_riz: [18, 54],
  pdt: [150, 450], patate_douce: [150, 400], lentilles: [40, 110],
  huile_olive: [0, 20], huile_colza: [0, 20], avocat: [0, 100], beurre_cacahuete: [0, 30], chia: [0, 25], choco85: [0, 20],
};
const CAT_BOUNDS = { prot: [80, 280], dairy: [100, 350], carb: [35, 140], fat: [0, 35], fruit: [80, 200], veg: [100, 300] };
const boundsOf = (f) => BOUNDS[f.id] || CAT_BOUNDS[f.cat] || [0, 400];

export function allowedFilter(profile) {
  const ex = new Set([...dietExcludes(profile.diet), ...(profile.allergies || [])]);
  const dislikes = String(profile.dislikes || '').split(/[,;\n]/).map(norm).filter((s) => s.length > 2);
  return (f) => f && !f.tags.some((t) => ex.has(t)) && !dislikes.some((d) => norm(f.n).includes(d) || norm(f.id).includes(d));
}

function candidates(list, ok) {
  return list.map(getFood).filter(ok);
}

// Résolution itérative (Gauss-Seidel) : chaque source ajuste sa quantité sur « son » macro.
export function solve(items, T) {
  const macro = { P: 'p', C: 'c', F: 'f' };
  for (let it = 0; it < 40; it++) {
    for (const item of items) {
      if (!macro[item.role]) continue;
      const f = getFood(item.id); const m = macro[item.role];
      const others = items.reduce((s, o) => (o === item ? s : s + (getFood(o.id)[m] * o.g) / 100), 0);
      const per = f[m] / 100;
      const [lo, hi] = boundsOf(f);
      item.g = Math.max(lo, Math.min(hi, per > 0 ? (T[m] - others) / per : lo));
    }
  }
  for (const item of items) {
    const f = getFood(item.id);
    const step = f.unit && ['oeuf', 'pain_complet', 'galette_riz'].includes(f.id) ? f.unit.g : 5;
    item.g = Math.max(step === 5 ? 0 : step, Math.round(item.g / step) * step);
  }
  return items.filter((i) => i.g >= 3);
}

export function mealTotals(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of items) { const f = getFood(it.id); if (!f) continue; const m = macrosFor(f, it.g); t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; }
  return t;
}

export function mealTarget(targets, key) {
  const m = MEALS.find((x) => x.key === key);
  return { kcal: targets.kcal * m.share, p: targets.protein * m.share, c: targets.carbs * m.share, f: targets.fat * m.share };
}

// Construit un repas. `forced` permet d'imposer un aliment dans un rôle (remplacement).
export function buildMeal(key, targets, profile, seed, forced = {}) {
  const ok = allowedFilter(profile);
  const S = SLOTS[key];
  const T = mealTarget(targets, key);
  const choose = (list, role, off = 0) => {
    if (forced[role]) return getFood(forced[role]);
    let c = candidates(list, ok);
    if (role === 'C' && key === 'b') {
      const p = forced.P || null; // œufs → tartines plutôt que porridge
      if (p === 'oeuf' || p === 'blanc_oeuf') { const t = c.filter((f) => ['pain_complet', 'galette_riz'].includes(f.id)); if (t.length) c = t; }
    }
    if (!c.length) c = candidates(list, (f) => f && !(profile.allergies || []).some((a) => f.tags.includes(a)));
    return c.length ? c[(seed + off) % c.length] : null;
  };
  const P = choose(S.P, 'P');
  if (P && key === 'b' && !forced.P) forced = { ...forced, P: P.id };
  const C = S.C.length ? choose(S.C, 'C', 3) : null;
  const X = forced.X ? getFood(forced.X) : choose(S.X[0], 'X', 1);
  const Fa = choose(S.F, 'F', 2);
  const items = [];
  if (P) items.push({ id: P.id, g: 100, role: 'P' });
  if (C) items.push({ id: C.id, g: 60, role: 'C' });
  if (X) items.push({ id: X.id, g: X.unit && key !== 'l' && key !== 'd' ? X.unit.g : S.X[1], role: 'X' });
  if (Fa) items.push({ id: Fa.id, g: 10, role: 'F' });
  // Collation sans féculent : le fruit porte les glucides, on ajuste sa quantité.
  if (!C && X) { const x = items.find((i) => i.role === 'X'); x.role = 'C'; }
  const solved = solve(items, T);
  if (!C && X) { const x = solved.find((i) => i.id === X.id); if (x) { x.role = 'X'; x.g = Math.max(80, Math.min(250, x.g)); } }
  return { key, seed, items: solved, name: dishName(key, solved), steps: dishSteps(key, solved) };
}

export function replaceInMeal(meal, role, newId, targets, profile) {
  const forced = {};
  for (const it of meal.items) forced[it.role] = it.id;
  forced[role] = newId;
  return buildMeal(meal.key, targets, profile, meal.seed, forced);
}

export function alternativesFor(meal, role, profile) {
  const ok = allowedFilter(profile);
  const S = SLOTS[meal.key];
  const list = role === 'X' ? S.X[0] : role === 'C' && !S.C.length ? S.X[0] : S[role] || [];
  const current = meal.items.find((i) => i.role === role)?.id;
  return candidates(list, ok).filter((f) => f.id !== current);
}

export function generatePlan(targets, profile, days = 14, start = 0) {
  const plan = {};
  for (let d = start + 1; d <= start + days; d++) {
    plan[d] = {};
    MEALS.forEach((m, i) => { plan[d][m.key] = buildMeal(m.key, targets, profile, d * 3 + i * 5 + (m.key === 'd' ? 2 : 0)); });
  }
  return plan;
}

// ——— Noms de plats et instructions ———
const short = (id) => (getFood(id)?.n || '').replace(/ \(.*\)/, '').replace(/^Pavé de |^Dos de |^Escalope de |^Blanc de /, '').toLowerCase();
function dishName(key, items) {
  const by = (r) => items.find((i) => i.role === r);
  const P = by('P'), C = by('C'), X = by('X');
  if (key === 'b') {
    if (C?.id === 'avoine') return `Porridge protéiné ${short(X?.id) ? '& ' + short(X.id) : ''}`.trim();
    if (P?.id === 'oeuf' || P?.id === 'blanc_oeuf') return `Œufs brouillés & ${short(C?.id) || 'fruit'}`;
    if (C?.id === 'pain_complet') return `Tartines complètes & ${short(P?.id)}`;
    return `Bol ${short(P?.id)}, ${short(C?.id) || 'fruit'} & ${short(X?.id)}`;
  }
  if (key === 's') return `${(getFood(P?.id)?.n || 'Collation').replace(/ \(.*\)/, '')} & ${short(X?.id)}`;
  const pn = short(P?.id), cn = short(C?.id), xn = short(X?.id);
  return key === 'l' ? `Bowl ${pn}, ${cn} & ${xn}` : `Assiette ${pn}, ${xn} & ${cn}`;
}
const COOK_P = {
  poulet: 'Coupe le poulet en morceaux, saisis-le 8-10 min à la poêle avec la moitié de l\'huile, sel, poivre, paprika.',
  dinde: 'Saisis l\'escalope 4 min par face, assaisonne (herbes de Provence, citron).',
  boeuf5: 'Cuis le steak haché 3-4 min par face à feu vif, sans ajout de matière grasse.',
  rumsteck: 'Saisis le rumsteck 2-3 min par face, laisse reposer 3 min avant de trancher.',
  porc_filet: 'Tranche le filet mignon en médaillons, cuis 4 min par face.',
  saumon: 'Cuis le saumon au four 12-15 min à 200 °C (ou poêle côté peau 6 min + 2 min).',
  cabillaud: 'Cuis le cabillaud en papillote 15 min à 200 °C avec citron et aneth.',
  thon: 'Égoutte le thon, émiette-le, assaisonne au citron et poivre.',
  crevettes: 'Réchauffe les crevettes 2 min à la poêle avec ail et persil.',
  tofu: 'Coupe le tofu en cubes, presse-le, fais-le dorer 8 min avec un trait de sauce soja.',
  tempeh: 'Tranche le tempeh, fais-le dorer 3 min par face.',
  pst: 'Réhydrate les protéines de soja 10 min dans de l\'eau bouillante + bouillon, égoutte puis poêle 5 min.',
  oeuf: 'Cuis les œufs (omelette, brouillés ou durs 9 min).',
};
const COOK_C = {
  riz: 'Rince le riz, cuis-le 10-12 min dans 2 volumes d\'eau.', riz_complet: 'Cuis le riz complet 25-30 min à l\'eau.',
  pates: 'Cuis les pâtes 9-11 min dans une eau bouillante salée.', quinoa: 'Rince et cuis le quinoa 12 min (2 volumes d\'eau).',
  semoule: 'Verse le même volume d\'eau bouillante sur la semoule, couvre 5 min, égrène.',
  patate_douce: 'Coupe la patate douce en cubes, rôtis 25 min à 200 °C.', pdt: 'Cuis les pommes de terre 20 min à la vapeur.',
  lentilles: 'Cuis les lentilles 20-25 min à l\'eau frémissante (sel en fin de cuisson).',
};
function dishSteps(key, items) {
  const by = (r) => items.find((i) => i.role === r);
  const P = by('P'), C = by('C'), X = by('X'), Fa = by('F');
  if (key === 'b') {
    const s = [];
    if (C?.id === 'avoine') s.push('Cuis les flocons 3-4 min dans 2-3 fois leur volume d\'eau (ou micro-ondes 2 min).');
    if (C?.id === 'pain_complet') s.push('Toaste les tranches de pain.');
    if (P?.id === 'oeuf' || P?.id === 'blanc_oeuf') s.push('Brouille les œufs 2-3 min à feu doux dans une poêle antiadhésive.');
    else if (P?.id === 'whey' || P?.id === 'prot_pois') s.push(C?.id === 'avoine' ? 'Hors du feu, incorpore la poudre protéinée (évite qu\'elle cuise).' : 'Mélange la poudre protéinée avec 200 ml d\'eau.');
    else if (P) s.push(`Verse le ${short(P.id)} dans un bol.`);
    if (X) s.push(`Ajoute ${short(X.id)} coupé(e) en morceaux.`);
    if (Fa) s.push(`Termine avec ${short(Fa.id)}.`);
    return s;
  }
  if (key === 's') return ['Prépare dans un bol ou une boîte hermétique à emporter.', Fa ? `Pèse ${short(Fa.id)} : c'est là que les calories grimpent vite.` : 'Rien à cuisiner.'];
  const s = [];
  if (C && COOK_C[C.id]) s.push(COOK_C[C.id]); else if (C) s.push(`Prépare ${short(C.id)} (rince et égoutte si conserve).`);
  if (P && COOK_P[P.id]) s.push(COOK_P[P.id]);
  if (X) s.push(`Cuis ${short(X.id)} 6-10 min à la vapeur ou à la poêle.`);
  if (Fa) s.push(Fa.id === 'avocat' ? 'Ajoute l\'avocat en lamelles au moment de servir.' : 'Mesure l\'huile à la cuillère : ne verse pas « à l\'œil ».');
  s.push('Pèse les féculents crus (ou utilise l\'équivalent cuit indiqué).');
  return s;
}

export function cookedHint(it) {
  const f = getFood(it.id);
  if (!f || !f.cook || f.state !== 'cru') return '';
  return `≈ ${r0(it.g * f.cook)} g cuit`;
}

export function shoppingList(plan, fromDay, toDay) {
  const agg = {};
  for (let d = fromDay; d <= toDay; d++) {
    const day = plan[d]; if (!day) continue;
    for (const k of Object.keys(day)) for (const it of day[k].items) agg[it.id] = (agg[it.id] || 0) + it.g;
  }
  const rows = Object.entries(agg).map(([id, g]) => {
    const f = getFood(id);
    return { id, f, g, cost: f?.price ? (g / 1000) * f.price : 0 };
  }).sort((a, b) => (a.f.cat + a.f.n).localeCompare(b.f.cat + b.f.n));
  return { rows, total: rows.reduce((s, r) => s + r.cost, 0) };
}

export function batchPrep(plan, fromDay, nDays) {
  const agg = {};
  for (let d = fromDay; d < fromDay + nDays; d++) {
    const day = plan[d]; if (!day) continue;
    for (const k of ['l', 'd']) for (const it of day[k]?.items || []) {
      if (!['P', 'C', 'X'].includes(it.role)) continue;
      (agg[it.id] = agg[it.id] || { g: 0, n: 0 }); agg[it.id].g += it.g; agg[it.id].n++;
    }
  }
  return Object.entries(agg).map(([id, v]) => ({ id, f: getFood(id), ...v }));
}
