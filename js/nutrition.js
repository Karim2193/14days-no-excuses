// Calculs nutritionnels : Mifflin-St Jeor, TDEE, déficit raisonnable, macros, hydratation.
import { r0, clamp } from './util.js';

export const ACTIVITY = [
  ['sedentaire', 'Sédentaire (bureau, peu de marche)', 1.2],
  ['leger', 'Légèrement actif (1-3 séances/sem.)', 1.375],
  ['modere', 'Modérément actif (3-5 séances/sem.)', 1.55],
  ['actif', 'Très actif (6-7 séances/sem.)', 1.725],
  ['extreme', 'Extrêmement actif (travail physique + sport)', 1.9],
];
export const LEVELS = [['debutant', 'Débutant (< 6 mois)'], ['intermediaire', 'Intermédiaire (6 mois – 2 ans)'], ['avance', 'Avancé (> 2 ans)']];

export function bmrMifflin({ weight, height, age, sex }) {
  return 10 * weight + 6.25 * height - 5 * age + (sex === 'F' ? -161 : 5);
}

export function computeTargets(p) {
  const bmr = bmrMifflin(p);
  const factor = (ACTIVITY.find((a) => a[0] === p.activity) || ACTIVITY[1])[2];
  const tdee = bmr * factor;
  // Déficit : 20 % du TDEE, plafonné à 750 kcal, jamais sous le métabolisme de base ni sous un plancher de sécurité.
  const floor = Math.max(bmr, p.sex === 'F' ? 1300 : 1600);
  const deficitWanted = Math.min(tdee * 0.2, 750);
  const kcal = Math.round(Math.max(tdee - deficitWanted, floor) / 10) * 10;
  const deficit = Math.max(0, tdee - kcal);
  // Protéines : 2 g/kg (poids ajusté si IMC > 25) pour préserver la masse musculaire.
  const h = p.height / 100;
  const bmi = p.weight / (h * h);
  const ref = bmi > 25 ? 25 * h * h + 0.25 * (p.weight - 25 * h * h) : p.weight;
  const protein = r0(clamp(2.0 * ref, 1.6 * ref, 2.2 * ref));
  let fat = r0(Math.max(0.8 * ref, (kcal * 0.25) / 9));
  let carbs = r0((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 100) { fat = r0((kcal * 0.22) / 9); carbs = r0((kcal - protein * 4 - fat * 9) / 4); }
  const water = Math.round(clamp(p.weight * 35, 2000, 4000) / 100) * 100; // ml, hors bonus entraînement
  const steps = p.activity === 'sedentaire' ? 8000 : 10000;
  // Estimation honnête : 7700 kcal ≈ 1 kg de graisse.
  const fatLoss14 = (deficit * 14) / 7700;
  return {
    bmr: r0(bmr), tdee: r0(tdee), factor, kcal, deficit: r0(deficit), protein, fat, carbs, water, waterTraining: water + 500,
    steps, bmi: Math.round(bmi * 10) / 10, fatLoss14: Math.round(fatLoss14 * 10) / 10,
  };
}

// Analyse réaliste de l'objectif « -3 kg en 14 jours ».
export function goalAnalysis(profile, t) {
  const wanted = profile.weight - profile.goalWeight;
  const fat = t.fatLoss14;
  // Une partie de la baisse initiale vient de l'eau/glycogène/contenu digestif (souvent 0,5 à 1,5 kg).
  const scaleLow = Math.round((fat + 0.5) * 10) / 10;
  const scaleHigh = Math.round((fat + 1.5) * 10) / 10;
  let verdict;
  if (wanted <= 0) verdict = 'Objectif de maintien ou de prise : le programme reste en léger déficit, ajuste ton poids cible si besoin.';
  else if (wanted <= scaleLow) verdict = 'Objectif réaliste avec ce plan si tu tiens la discipline.';
  else if (wanted <= scaleHigh) verdict = 'Objectif ambitieux mais atteignable sur la balance, à condition d\'une exécution quasi parfaite (nutrition, pas, sommeil). Une partie sera de l\'eau, pas uniquement de la graisse.';
  else verdict = 'Objectif très ambitieux pour 14 jours sans méthode dangereuse. Le plan ne réduira pas davantage les calories : vise la régularité, le reste suivra après le challenge.';
  return { wanted: Math.round(wanted * 10) / 10, fat, scaleLow, scaleHigh, verdict };
}

export function waterTarget(t, isTrainingDay) { return isTrainingDay ? t.waterTraining : t.water; }
