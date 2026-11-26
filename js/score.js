// Calendrier du challenge, totaux journaliers et score de discipline /100.
import { dateKey, addDays, diffDays, clamp, r0 } from './util.js';
import { programDay, isTrainingType, sessionKcal } from './training.js';
import { waterTarget } from './nutrition.js';

export const CHALLENGE_DAYS = 14;
export const SUCCESS = 70;

export function challengeIndex(s, k = dateKey()) { return s.profile ? diffDays(s.profile.startDate, k) + 1 : 0; }
export const keyForIndex = (s, i) => addDays(s.profile.startDate, i - 1);

export function totals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fi: 0 };
  for (const it of d?.foods || []) { t.kcal += it.kcal; t.p += it.p; t.c += it.c; t.f += it.f; t.fi += it.fi || 0; }
  return t;
}

export function workoutProgress(d, prog) {
  if (!prog) return { done: 0, total: 0, ratio: 0 };
  if (d?.workout?.express && prog.type === 'muscu') {
    const total = Math.min(3, prog.ex.length);
    const done = prog.ex.slice(0, total).filter((_, i) => d.workout.ex?.[i]?.done).length;
    return { done, total, ratio: total ? (done / total) * 0.8 : 0, express: true };
  }
  const total = prog.ex.length;
  const done = prog.ex.filter((_, i) => d?.workout?.ex?.[i]?.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}

// Durée réelle si heure de début et de fin saisies, sinon durée prévue × progression.
export function workoutMinutes(d, prog) {
  const w = d?.workout || {};
  if (w.startAt && w.endAt) { const [a, b] = [w.startAt, w.endAt].map((x) => { const [h, m] = x.split(':').map(Number); return h * 60 + m; }); let m = b - a; if (m < 0) m += 1440; return m; }
  return prog && isTrainingType(prog.type) ? prog.duration * workoutProgress(d, prog).ratio : 0;
}

export function activityMinutes(s, d, prog) {
  let m = 0;
  if (prog && isTrainingType(prog.type)) m += Math.round(workoutMinutes(d, prog));
  for (const c of d?.cardio || []) m += Number(c.min) || 0;
  return m;
}

export function sportKcal(s, d, prog) {
  const kg = s.profile.weight;
  let k = 0;
  if (prog && isTrainingType(prog.type)) k += sessionKcal(prog.met, kg, workoutMinutes(d, prog));
  for (const c of d?.cardio || []) k += c.kcal || 0;
  return r0(k);
}

// Score détaillé : chaque catégorie indique ses points, son max et la raison des points perdus.
export function dayScore(s, k) {
  const d = s.days[k];
  const i = challengeIndex(s, k);
  const prog = i >= 1 ? programDay(s.profile, ((i - 1) % 14) + 1) : null;
  const T = s.targets;
  const parts = [];
  // Nutrition (30)
  const t = totals(d);
  let nut = 0; let why = '';
  if (!d || !d.foods.length) why = 'Aucun aliment noté.';
  else {
    const r = t.kcal / T.kcal;
    const kp = Math.abs(r - 1) <= 0.1 ? 18 : Math.abs(r - 1) <= 0.2 ? 10 : 3;
    const pr = t.p / T.protein;
    const pp = pr >= 0.9 ? 12 : Math.round((12 * pr) / 0.9);
    nut = kp + pp;
    const w = [];
    if (r > 1.1) w.push(`calories dépassées de ${r0(t.kcal - T.kcal)} kcal`);
    if (r < 0.9) w.push(r < 0.75 ? 'calories trop basses (pas de bonus pour la privation)' : `${r0(T.kcal - t.kcal)} kcal sous l'objectif`);
    if (pr < 0.9) w.push(`protéines ${r0(t.p)}/${T.protein} g`);
    why = w.join(', ');
  }
  parts.push({ key: 'nutrition', label: 'Nutrition', pts: nut, max: 30, why });
  // Entraînement / récupération (25)
  let tr = 0; let twhy = '';
  if (!prog) twhy = 'Hors challenge';
  else if (!isTrainingType(prog.type)) { tr = 25; twhy = ''; }
  else if (d?.workout?.converted) { tr = 25; twhy = ''; }
  else { const wp = workoutProgress(d, prog); tr = Math.round(25 * wp.ratio); if (wp.ratio < 1) twhy = `séance ${wp.done}/${wp.total} exercices`; }
  parts.push({ key: 'training', label: prog && !isTrainingType(prog.type) ? 'Récupération planifiée' : 'Entraînement', pts: tr, max: 25, why: twhy });
  // Hydratation (10)
  const wt = waterTarget(T, prog && isTrainingType(prog.type));
  const water = d?.water || 0;
  const wpts = Math.round(10 * clamp(water / wt, 0, 1));
  parts.push({ key: 'water', label: 'Hydratation', pts: wpts, max: 10, why: water < wt ? `${(water / 1000).toFixed(1)} / ${(wt / 1000).toFixed(1)} L` : '' });
  // Activité (15)
  const steps = d?.steps || 0; const goal = s.profile.stepsGoal || T.steps;
  const apts = Math.round(15 * clamp(steps / goal, 0, 1));
  parts.push({ key: 'activity', label: 'Activité (pas)', pts: apts, max: 15, why: steps < goal ? `${steps.toLocaleString('fr-FR')} / ${goal.toLocaleString('fr-FR')} pas` : '' });
  // Sommeil (10)
  const sl = d?.sleep;
  const spts = sl == null ? 0 : sl >= 7 ? 10 : sl >= 6 ? 6 : sl >= 5 ? 3 : 0;
  parts.push({ key: 'sleep', label: 'Sommeil', pts: spts, max: 10, why: sl == null ? 'sommeil non renseigné' : sl < 7 ? `${sl} h (objectif 7 h+)` : '' });
  // Journal (10)
  const j = [d?.weight != null, d?.energy != null, d?.motivation != null, !!(d?.comment || d?.deviation || d?.noDeviation)];
  const jpts = Math.round(2.5 * j.filter(Boolean).length);
  const miss = ['poids', 'énergie', 'motivation', 'commentaire / écarts'].filter((_, x) => !j[x]);
  parts.push({ key: 'journal', label: 'Journal', pts: jpts, max: 10, why: miss.length ? 'manque : ' + miss.join(', ') : '' });
  const total = parts.reduce((a, p) => a + p.pts, 0);
  return { total, parts, prog, totals: t, index: i };
}

// Statistiques sur la période écoulée du challenge.
export function stats(s, today = dateKey()) {
  const iToday = challengeIndex(s, today);
  const last = Math.min(iToday, CHALLENGE_DAYS);
  const rows = [];
  for (let i = 1; i <= Math.max(0, last); i++) {
    const k = keyForIndex(s, i);
    rows.push({ i, k, ...dayScore(s, k), isToday: k === today, hasData: !!s.days[k] });
  }
  const closed = rows.filter((r) => !r.isToday); // journées terminées
  const scored = rows.filter((r) => r.hasData || !r.isToday);
  const pool = closed.length ? closed : rows;
  const last7 = pool.slice(-7);
  const avg7 = last7.length ? Math.round(last7.reduce((a, r) => a + r.total, 0) / last7.length) : 0;
  const avgAll = pool.length ? Math.round(pool.reduce((a, r) => a + r.total, 0) / pool.length) : 0;
  const best = pool.reduce((b, r) => (!b || r.total > b.total ? r : b), null);
  const worst = pool.reduce((b, r) => (!b || r.total < b.total ? r : b), null);
  const successes = rows.filter((r) => r.total >= SUCCESS).length;
  const regularity = pool.length ? Math.round((closed.filter((r) => r.total >= SUCCESS).length / Math.max(1, closed.length)) * 100) : 0;
  // Série en cours (jours réussis consécutifs, aujourd'hui compte s'il est déjà réussi)
  let streak = 0;
  for (let x = rows.length - 1; x >= 0; x--) {
    const r = rows[x];
    if (r.isToday && r.total < SUCCESS) continue;
    if (r.total >= SUCCESS) streak++; else break;
  }
  const missed = closed.filter((r) => r.prog && isTrainingType(r.prog.type) && !s.days[r.k]?.workout?.converted && workoutProgress(s.days[r.k], r.prog).ratio < 0.5);
  const sessionsDone = rows.filter((r) => r.prog && isTrainingType(r.prog.type) && workoutProgress(s.days[r.k], r.prog).ratio >= 0.5).length;
  const sessionsPlanned = Array.from({ length: CHALLENGE_DAYS }, (_, x) => programDay(s.profile, x + 1)).filter((p) => isTrainingType(p.type)).length;
  return { rows, closed, scored, avg7, avgAll, best, worst, successes, regularity, streak, missed, sessionsDone, sessionsPlanned, iToday };
}

export function weightSeries(s) {
  const out = [];
  const start = s.profile.startDate;
  const keys = Object.keys(s.days).filter((k) => s.days[k].weight != null).sort();
  for (const k of keys) out.push({ k, i: diffDays(start, k) + 1, w: s.days[k].weight });
  return out;
}
export function measureSeries(s, field) {
  return Object.keys(s.days).filter((k) => s.days[k][field] != null).sort().map((k) => ({ k, i: diffDays(s.profile.startDate, k) + 1, v: s.days[k][field] }));
}
export function currentWeight(s) {
  const ws = weightSeries(s);
  return ws.length ? ws[ws.length - 1].w : s.profile.weight;
}
// Moyenne mobile 3 jours : plus fiable qu'une pesée isolée.
export function trendWeight(s) {
  const ws = weightSeries(s).slice(-3);
  return ws.length ? ws.reduce((a, x) => a + x.w, 0) / ws.length : s.profile.weight;
}
