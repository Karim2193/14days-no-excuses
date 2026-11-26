// Tests unitaires sans dépendance : node tests/unit.mjs
import { computeTargets, bmrMifflin, goalAnalysis } from '../js/nutrition.js';
import { generatePlan, mealTotals, MEALS, shoppingList, replaceInMeal } from '../js/meals.js';
import { programDay, isTrainingType, cardioKcal } from '../js/training.js';
import { dayScore } from '../js/score.js';
import { freshState, emptyDay } from '../js/store.js';
import { localReply, excuseReply, patterns, reminderShouldFire, expectedWater } from '../js/coach.js';
import { addWater, removeWater, sleepFromTimes, distanceKm, checklist, dayStatus, eveningReport, reportToText } from '../js/tracking.js';
import { migrate } from '../js/store.js';

let pass = 0, fail = 0;
const t = (name, cond, info = '') => { if (cond) pass++; else fail++; console.log(`${cond ? 'PASS' : 'FAIL'} · ${name}${info ? ' · ' + info : ''}`); };

const P = { age: 23, height: 174, weight: 77, goalWeight: 74, sex: 'M', activity: 'modere', sessions: 4, level: 'intermediaire', diet: 'omnivore', allergies: [], dislikes: '', startDate: '2026-11-25', stepsGoal: 10000, trainTime: '18:30' };
t('BMR homme Mifflin-St Jeor (77 kg, 174 cm, 23 ans = 1747,5)', Math.abs(bmrMifflin(P) - 1747.5) < 0.01);
t('BMR femme Mifflin-St Jeor', Math.abs(bmrMifflin({ ...P, sex: 'F' }) - 1581.5) < 0.01);
const T = computeTargets(P);
t('TDEE = BMR × 1,55 = 2709', T.tdee === 2709);
t('Déficit modéré (≤ 25 % et ≤ 750 kcal)', T.deficit <= 750 && T.deficit / T.tdee <= 0.25, T.deficit + ' kcal');
t('Jamais sous le métabolisme de base', T.kcal >= T.bmr);
t('Macros = calories (±15)', Math.abs(T.protein * 4 + T.carbs * 4 + T.fat * 9 - T.kcal) <= 15);
const small = computeTargets({ ...P, sex: 'F', weight: 52, height: 158, age: 45, activity: 'sedentaire' });
t('Plancher de sécurité femme (≥ 1300 kcal)', small.kcal >= 1300, small.kcal + ' kcal');
t('Eau 35 ml/kg (77 kg → 2,7 L)', T.water === 2700);
const g = goalAnalysis(P, T);
t('Analyse honnête de l\'objectif -3 kg', g.fat < 3 && g.verdict.length > 10, `graisse ≈ ${g.fat} kg`);

const plan = generatePlan(T, P);
let worst = 0;
for (let d = 1; d <= 14; d++) { const k = MEALS.reduce((a, m) => a + mealTotals(plan[d][m.key].items).kcal, 0); worst = Math.max(worst, Math.abs(k - T.kcal) / T.kcal); }
t('Plan : chaque jour à ±10 % des calories', worst <= 0.1, `écart max ${(worst * 100).toFixed(1)} %`);
for (const diet of ['vegetarien', 'vegan', 'pescetarien', 'sans_porc']) {
  const pl = generatePlan(T, { ...P, diet });
  const ids = Object.values(pl).flatMap((d) => Object.values(d).flatMap((m) => m.items.map((i) => i.id)));
  const bad = { vegetarien: ['poulet', 'dinde', 'boeuf5', 'thon', 'saumon', 'crevettes', 'cabillaud', 'porc_filet', 'rumsteck'], vegan: ['oeuf', 'skyr', 'whey', 'poulet', 'thon'], pescetarien: ['poulet', 'dinde', 'boeuf5', 'porc_filet'], sans_porc: ['porc_filet', 'jambon'] }[diet];
  t(`Plan ${diet} respecté`, !ids.some((i) => bad.includes(i)));
}
const m0 = plan[1].l; const rep = replaceInMeal(m0, 'P', 'dinde', T, P);
const a = mealTotals(m0.items), b = mealTotals(rep.items);
t('Remplacement : protéines du repas conservées (±10 %)', Math.abs(a.p - b.p) / a.p < 0.1, `${a.p.toFixed(0)} → ${b.p.toFixed(0)} g`);
t('Liste de courses semaine 1', shoppingList(plan, 1, 7).rows.length > 15);

const types = Array.from({ length: 14 }, (_, i) => programDay(P, i + 1).type);
t('Programme : 8 séances sur 14 jours pour 4/sem.', types.filter(isTrainingType).length === 8, types.join(','));
t('Programme : récupération chaque semaine', types.filter((x) => x === 'repos' || x === 'recup').length >= 4);
t('Cardio : estimation positive', cardioKcal('tapis', 1, 30, 77) > 100);

const s = freshState(); s.profile = P; s.targets = T; s.plan = plan;
const key = '2026-11-28'; // J4 = récupération pour 4 séances/sem.
s.days[key] = emptyDay();
const rest = dayScore(s, key);
t('Jour de récupération non pénalisé (25/25)', rest.parts.find((p) => p.key === 'training').pts === 25, programDay(P, 4).type);
s.days[key] = { ...emptyDay(), foods: [{ kcal: T.kcal, p: T.protein, c: 0, f: 0 }], water: 3500, steps: 12000, sleep: 8, weight: 76.5, energy: 7, motivation: 7, noDeviation: true };
t('Journée parfaite = 100/100', dayScore(s, key).total === 100);
t('Coach : jamais de restriction dangereuse', !/jeûne de|ne mange pas|saute le repas/i.test(localReply(s, 'je veux perdre 3kg vite')));
t('Coach : maladie → repos sans pénalité', excuseReply('malade', s).action === 'convert');
// ——— Suivi quotidien ———
t('Sommeil 23:30 → 07:00 = 7,5 h', sleepFromTimes('23:30', '07:00') === 7.5);
t('Sommeil 00:15 → 06:45 = 6,5 h', sleepFromTimes('00:15', '06:45') === 6.5);
const wd = emptyDay(); addWater(wd, 250, '08:00'); addWater(wd, 500, '10:00'); removeWater(wd, 0);
t('Eau : historique et total cohérents', wd.water === 500 && wd.waterLog.length === 1 && wd.waterLog[0].t === '10:00');
t('Distance estimée depuis les pas', distanceKm(s, { steps: 10000 }).km === 7.2 && distanceKm(s, { distance: 5 }).km === 5);
t('Contrôle : 8 objectifs, journée parfaite = 7 cochés sur 8 sans pas', (() => { const c = checklist(s, key); return c.length === 8 && c.filter((x) => x.done).length === 8; })(), JSON.stringify(checklist(s, key).map((c) => c.done)));
t('Statut d\'une journée complète', dayStatus(s, key, '2026-11-29').status === 'complete', dayStatus(s, key, '2026-11-29').status);
const R = eveningReport(s, key);
t('Bilan du soir : score, sections et priorité', R.score === 100 && R.i === 4 && R.good.length >= 4 && typeof R.priority === 'string' && reportToText(R).startsWith('BILAN DU JOUR 4/14'));
const s2 = freshState(); s2.profile = P; s2.targets = T; s2.plan = plan;
for (const [k, kc] of [['2026-11-25', 1200], ['2026-11-26', 1250], ['2026-11-27', 1150]]) s2.days[k] = { ...emptyDay(), foods: [{ kcal: kc, p: 60, c: 100, f: 30 }], sleep: 5.5, water: 1000 };
const pk = patterns(s2, new Date(2026, 10, 28, 12)).map((x) => x.key);
t('Coach : repère sous-alimentation, protéines basses, sommeil court, eau', ['under', 'prot', 'sleep', 'water'].every((x) => pk.includes(x)), pk.join(','));
t('Rythme d\'eau attendu à 14 h 30 ≈ 50 %', Math.abs(expectedWater(2700, new Date(2026, 10, 28, 14, 30)) - 1350) < 10);
const old = freshState(); old.profile = P; old.targets = T; old.plan = plan; old.days['2026-11-25'] = { foods: [], energy: 4, motivation: 3, water: 1500 };
const mig = migrate(JSON.parse(JSON.stringify(old)));
t('Migration v1.1 : échelles /5 → /10, eau → historique, rien de perdu', mig.days['2026-11-25'].energy === 8 && mig.days['2026-11-25'].motivation === 6 && mig.days['2026-11-25'].water === 1500 && mig.days['2026-11-25'].waterLog[0].ml === 1500);
const mig2 = migrate(JSON.parse(JSON.stringify(mig)));
t('Migration idempotente (pas de double conversion)', mig2.days['2026-11-25'].energy === 8);
console.log(`\n${pass}/${pass + fail} tests unitaires réussis`);
process.exit(fail ? 1 : 0);
