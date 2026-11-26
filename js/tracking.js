// Suivi quotidien : eau horodatée, sommeil, contrôle quotidien, statut des journées, bilan du soir.
import { dateKey, addDays, hhmmToMin, r0, r1, pad } from './util.js';
import { dayScore, challengeIndex, keyForIndex, totals, workoutProgress, SUCCESS, sportKcal, activityMinutes } from './score.js';
import { isTrainingType, programDay, TYPE_LABEL } from './training.js';
import { waterTarget } from './nutrition.js';

export const WATER_MAX_DAY = 5000;      // au-delà : avertissement (risque d'hyponatrémie, aucun bénéfice)
export const WATER_MAX_ADD = 1500;      // une prise personnalisée ne dépasse pas 1,5 L
export const nowHHMM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function addWater(d, ml, t = nowHHMM()) {
  d.waterLog = d.waterLog || [];
  d.waterLog.push({ t, ml });
  d.water = Math.max(0, d.waterLog.reduce((a, x) => a + (x.ml || 0), 0));
}
export function removeWater(d, i) {
  d.waterLog.splice(i, 1);
  d.water = Math.max(0, d.waterLog.reduce((a, x) => a + (x.ml || 0), 0));
}
// Remplace le total (saisie directe) en gardant un historique cohérent.
export function setWaterTotal(d, ml) {
  const diff = Math.round(ml) - (d.water || 0);
  if (diff !== 0) addWater(d, diff, nowHHMM());
}

export function sleepFromTimes(bedAt, wakeAt) {
  if (!bedAt || !wakeAt) return null;
  let m = hhmmToMin(wakeAt) - hhmmToMin(bedAt);
  if (m <= 0) m += 1440;
  return Math.round((m / 60) * 4) / 4; // au quart d'heure
}

export function distanceKm(s, d) {
  if (d?.distance != null) return { km: d.distance, estimated: false };
  if (!d?.steps) return { km: null, estimated: true };
  const stride = (s.profile.height * 0.415) / 100; // foulée estimée à partir de la taille
  return { km: r1((d.steps * stride) / 1000), estimated: true };
}

export function sessionDuration(d, prog) {
  const w = d?.workout || {};
  if (w.startAt && w.endAt) { let m = hhmmToMin(w.endAt) - hhmmToMin(w.startAt); if (m < 0) m += 1440; return { min: m, measured: true }; }
  return { min: prog ? Math.round(prog.duration * workoutProgress(d, prog).ratio) : 0, measured: false };
}

// Tableau de contrôle : 8 objectifs vérifiés automatiquement à partir des données réelles.
export function checklist(s, k) {
  const sc = dayScore(s, k); const d = s.days[k] || {}; const T = s.targets; const t = sc.totals;
  const prog = sc.prog; const isT = prog && isTrainingType(prog.type);
  const wt = waterTarget(T, isT);
  const goal = s.profile.stepsGoal || T.steps;
  const part = (key) => sc.parts.find((p) => p.key === key);
  return [
    { key: 'weigh', label: 'Pesée effectuée', done: d.weight != null, info: d.weight != null ? `${String(d.weight).replace('.', ',')} kg${d.weighTime ? ' à ' + d.weighTime : ''}` : 'à faire' },
    { key: 'nutri', label: 'Objectif nutritionnel suivi', done: d.foods?.length > 0 && Math.abs(t.kcal / T.kcal - 1) <= 0.1, info: d.foods?.length ? `${r0(t.kcal)} / ${T.kcal} kcal` : 'rien noté' },
    { key: 'prot', label: 'Protéines atteintes', done: t.p >= T.protein * 0.9, info: `${r0(t.p)} / ${T.protein} g` },
    { key: 'water', label: 'Hydratation suivie', done: (d.water || 0) >= wt * 0.9, info: `${((d.water || 0) / 1000).toFixed(1)} / ${(wt / 1000).toFixed(1)} L` },
    { key: 'train', label: isT ? 'Entraînement effectué' : 'Repos planifié respecté', done: part('training')?.pts === 25, info: isT ? (d.workout?.converted ? 'converti en récupération' : `${workoutProgress(d, prog).done}/${workoutProgress(d, prog).total} exercices`) : TYPE_LABEL[prog?.type] || '' },
    { key: 'steps', label: 'Activité quotidienne réalisée', done: (d.steps || 0) >= goal, info: `${(d.steps || 0).toLocaleString('fr-FR')} / ${goal.toLocaleString('fr-FR')} pas` },
    { key: 'sleep', label: 'Sommeil suivi (7 h et plus)', done: d.sleep != null && d.sleep >= 7, info: d.sleep != null ? `${String(d.sleep).replace('.', ',')} h` : 'non renseigné' },
    { key: 'journal', label: 'Journal complété', done: part('journal')?.pts === 10, info: part('journal')?.why || 'complet' },
  ];
}

// Statut d'une journée du calendrier : complete | partial | empty | future (+ recovery si jour sans séance)
export function dayStatus(s, k, today = dateKey()) {
  const i = challengeIndex(s, k);
  const prog = i >= 1 && i <= 14 ? programDay(s.profile, i) : null;
  const recovery = prog && !isTrainingType(prog.type);
  if (k > today) return { status: 'future', label: 'À venir', recovery };
  const d = s.days[k];
  const filled = d ? [d.weight != null, d.foods?.length > 0, (d.water || 0) > 0, d.steps != null, d.sleep != null, d.energy != null || d.motivation != null || !!d.comment,
    !prog || !isTrainingType(prog.type) || !!d.workout?.converted || workoutProgress(d, prog).ratio > 0] : [];
  const n = filled.filter(Boolean).length;
  const score = d ? dayScore(s, k).total : 0;
  if (!d || n <= 1 && !(d.foods?.length)) return { status: 'empty', label: 'Non renseignée', recovery, score };
  if (n === filled.length) return { status: 'complete', label: 'Complète', recovery, score };
  return { status: 'partial', label: 'Partielle', recovery, score };
}

// Bilan automatique de fin de journée, avec analyse.
export function eveningReport(s, k) {
  const sc = dayScore(s, k); const d = s.days[k] || {}; const T = s.targets; const t = sc.totals; const p = s.profile;
  const prog = sc.prog; const isT = prog && isTrainingType(prog.type);
  const wp = workoutProgress(d, prog);
  const dur = sessionDuration(d, prog);
  const cl = checklist(s, k);
  const good = []; const missed = []; const improve = [];
  const r = t.kcal / T.kcal;
  if (d.foods?.length && Math.abs(r - 1) <= 0.1) good.push('Calories dans la cible.'); else if (d.foods?.length && r > 1.1) { missed.push(`Calories dépassées de ${r0(t.kcal - T.kcal)} kcal.`); improve.push('Pèse les matières grasses et suis le plan au repas où tu as craqué.'); }
  else if (d.foods?.length && r < 0.9) { missed.push(`${r0(T.kcal - t.kcal)} kcal sous l'objectif${r < 0.75 ? ' : c\'est trop peu, ça coûte du muscle' : ''}.`); improve.push('Mange tous les repas du plan : manger trop peu n\'accélère rien.'); }
  else { missed.push('Aucun repas noté.'); improve.push('Note chaque repas juste après l\'avoir mangé.'); }
  if (t.p >= T.protein * 0.9) good.push(`Protéines OK (${r0(t.p)} g).`); else { missed.push(`Protéines : ${r0(t.p)} / ${T.protein} g.`); improve.push('Une source de protéines à chaque repas (viande, poisson, œufs, skyr, tofu).'); }
  const wt = waterTarget(T, isT);
  if ((d.water || 0) >= wt * 0.9) good.push('Hydratation au niveau.'); else { missed.push(`Eau : ${((d.water || 0) / 1000).toFixed(1)} / ${(wt / 1000).toFixed(1)} L.`); improve.push('Une gourde remplie le matin, une l\'après-midi : pas besoin de forcer d\'un coup.'); }
  if (isT) { if (wp.ratio >= 1 || d.workout?.converted) good.push(d.workout?.converted ? 'Séance convertie en récupération pour raison de santé : bonne décision.' : `Séance faite (${prog.title}).`); else { missed.push(`Séance ${wp.done}/${wp.total} exercices.`); improve.push(`Bloque l'heure de ta séance de demain dès ce soir.`); } }
  else good.push('Jour de récupération respecté.');
  const goal = p.stepsGoal || T.steps;
  if ((d.steps || 0) >= goal) good.push(`${(d.steps || 0).toLocaleString('fr-FR')} pas.`); else { missed.push(`Pas : ${(d.steps || 0).toLocaleString('fr-FR')} / ${goal.toLocaleString('fr-FR')}.`); improve.push('20-30 minutes de marche après le déjeuner ou le dîner.'); }
  if (d.sleep != null && d.sleep >= 7) good.push(`${d.sleep} h de sommeil.`); else { missed.push(d.sleep == null ? 'Sommeil non renseigné.' : `Sommeil court (${d.sleep} h).`); improve.push(`Coucher à ${p.bedTime || '23:00'} au plus tard, écrans coupés 30 min avant.`); }
  const weakest = [...sc.parts].sort((a, b) => (b.max - b.pts) / b.max - (a.max - a.pts) / a.max)[0];
  const tomorrowI = sc.index + 1;
  const tProg = tomorrowI >= 1 && tomorrowI <= 14 ? programDay(p, tomorrowI) : null;
  const priority = weakest && weakest.pts < weakest.max
    ? { nutrition: 'Suivre le plan repas à la lettre et tout noter.', training: tProg && isTrainingType(tProg.type) ? `Faire ${tProg.title}, à l'heure prévue.` : 'Respecter la récupération et marcher.', water: `Atteindre ${(waterTarget(T, tProg && isTrainingType(tProg.type)) / 1000).toFixed(1)} L d'eau, réparti sur la journée.`, activity: `Atteindre ${goal.toLocaleString('fr-FR')} pas.`, sleep: 'Dormir 7 h 30 minimum.', journal: 'Remplir le suivi complet (pesée, ressenti, commentaire).' }[weakest.key]
    : tProg ? (isTrainingType(tProg.type) ? `Refaire une journée parfaite : ${tProg.title}.` : 'Refaire une journée parfaite, récupération comprise.') : 'Garder ce niveau.';
  const startW = p.weight; // poids de départ du profil
  const prevW = s.days[addDays(k, -1)]?.weight ?? null;
  return {
    i: sc.index, k, score: sc.total, success: sc.total >= SUCCESS, weight: d.weight ?? null,
    fromStart: d.weight != null ? r1(d.weight - startW) : null, fromPrev: d.weight != null && prevW != null ? r1(d.weight - prevW) : null,
    kcal: r0(t.kcal), target: T.kcal, rest: r0(T.kcal - t.kcal), p: r0(t.p), c: r0(t.c), f: r0(t.f), fi: r0(t.fi || 0), water: d.water || 0, waterTarget: wt,
    steps: d.steps || 0, km: distanceKm(s, d), training: isT ? (d.workout?.converted ? 'Converti en récupération' : wp.ratio >= 1 ? `Fait : ${prog.title}` : `${wp.done}/${wp.total} exercices`) : TYPE_LABEL[prog?.type] || '—',
    sportMin: dur.min + (d.cardio || []).reduce((a, c) => a + (Number(c.min) || 0), 0), sportKcal: sportKcal(s, d, prog), sleep: d.sleep,
    good, missed, improve: [...new Set(improve)].slice(0, 3), weakest: weakest && weakest.pts < weakest.max ? `${weakest.label} (${weakest.pts}/${weakest.max})` : 'Aucun', priority, checklist: cl, parts: sc.parts,
  };
}

export function reportToText(R) {
  const sign = (x) => (x > 0 ? '+' : '') + String(x).replace('.', ',');
  return [`BILAN DU JOUR ${R.i}/14`,
    `Poids : ${R.weight != null ? String(R.weight).replace('.', ',') + ' kg' : 'non pesé'}${R.fromStart != null ? ` (${sign(R.fromStart)} kg depuis le départ)` : ''}`,
    `Calories : ${R.kcal} / ${R.target} kcal (${R.rest >= 0 ? R.rest + ' restantes' : -R.rest + ' de dépassement'})`,
    `Protéines ${R.p} g · Glucides ${R.c} g · Lipides ${R.f} g · Fibres ${R.fi} g`,
    `Eau : ${(R.water / 1000).toFixed(1)} L · Pas : ${R.steps.toLocaleString('fr-FR')}`,
    `Entraînement : ${R.training} · Durée sportive : ${R.sportMin} min`,
    `Sommeil : ${R.sleep != null ? R.sleep + ' h' : '—'} · Score : ${R.score}/100`,
    '', 'Bien fait : ' + (R.good.join(' ') || '—'), 'Raté : ' + (R.missed.join(' ') || '—'), 'À améliorer demain : ' + (R.improve.join(' ') || '—'),
    'Point faible : ' + R.weakest, 'Priorité de demain : ' + R.priority].join('\n');
}
