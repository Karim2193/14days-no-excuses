// Questionnaire de configuration (première ouverture) et édition du profil.
import { esc, dateKey, num } from '../util.js';
import { ACTIVITY, LEVELS, computeTargets, goalAnalysis } from '../nutrition.js';
import { ALLERGENS, DIETS } from '../foods.js';

// Profil réel de Karim (pré-rempli au premier lancement, modifiable).
export const DEFAULT_PROFILE = { age: 23, sex: 'M', height: 174, weight: 77, goalWeight: 74 };

export function profileForm(p = {}, { submitLabel = 'Calculer mon plan', editing = false } = {}) {
  if (!editing && !p.age) p = { ...DEFAULT_PROFILE, ...p };
  const v = (k, d = '') => esc(p[k] ?? d);
  const opt = (list, cur) => list.map(([val, lab]) => `<option value="${val}" ${val === cur ? 'selected' : ''}>${esc(lab)}</option>`).join('');
  const al = new Set(p.allergies || []);
  return `<form id="profile-form" class="form" novalidate>
    <div class="grid2">
      <label>Âge<input name="age" type="number" inputmode="numeric" min="16" max="90" required value="${v('age')}" placeholder="23"></label>
      <label>Sexe<select name="sex">${opt([['M', 'Homme'], ['F', 'Femme']], p.sex || 'M')}</select></label>
      <label>Taille (cm)<input name="height" type="number" inputmode="numeric" min="130" max="230" required value="${v('height')}" placeholder="174"></label>
      <label>Poids actuel (kg)<input name="weight" type="number" inputmode="decimal" step="0.1" min="35" max="250" required value="${v('weight')}" placeholder="77"></label>
      <label>Poids cible (kg)<input name="goalWeight" type="number" inputmode="decimal" step="0.1" min="35" max="250" required value="${v('goalWeight')}" placeholder="74"></label>
      <label>Tour de taille (cm, option)<input name="waist" type="number" inputmode="decimal" step="0.5" value="${v('waist')}" placeholder="80"></label>
    </div>
    <label>Niveau sportif<select name="level">${opt(LEVELS, p.level || 'intermediaire')}</select></label>
    <label>Activité quotidienne (sport compris)<select name="activity">${opt(ACTIVITY.map((a) => [a[0], a[1]]), p.activity || 'modere')}</select></label>
    <label>Séances par semaine<select name="sessions">${opt([['3', '3 séances'], ['4', '4 séances'], ['5', '5 séances'], ['6', '6 séances']], String(p.sessions || 4))}</select></label>
    <div class="grid2">
      <label>Heure d'entraînement<input name="trainTime" type="time" value="${v('trainTime', '18:30')}"></label>
      <label>Heure de coucher<input name="bedTime" type="time" value="${v('bedTime', '23:00')}"></label>
    </div>
    <label>Préférences alimentaires<select name="diet">${opt(DIETS, p.diet || 'omnivore')}</select></label>
    <fieldset><legend>Allergies / intolérances</legend><div class="chips">
      ${ALLERGENS.map(([id, l]) => `<label class="chip"><input type="checkbox" name="allergies" value="${id}" ${al.has(id) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
    </div></fieldset>
    <label>Aliments que tu n'aimes pas (séparés par des virgules)<input name="dislikes" type="text" value="${v('dislikes')}" placeholder="ex : saumon, brocoli, cottage"></label>
    <div class="grid2">
      <label>Objectif de pas / jour<input name="stepsGoal" type="number" inputmode="numeric" min="3000" max="25000" step="500" value="${v('stepsGoal', '10000')}"></label>
      <label>${editing ? 'Début du challenge' : 'Jour 1 du challenge'}<input name="startDate" type="date" value="${v('startDate', dateKey())}"></label>
    </div>
    <p class="err" id="pf-err" hidden></p>
    <button class="btn primary block" type="submit">${esc(submitLabel)}</button>
  </form>`;
}

export function readProfileForm(form) {
  const fd = new FormData(form);
  const p = {
    age: num(fd.get('age')), sex: fd.get('sex'), height: num(fd.get('height')), weight: num(fd.get('weight')),
    goalWeight: num(fd.get('goalWeight')), waist: num(fd.get('waist')), level: fd.get('level'), activity: fd.get('activity'),
    sessions: Number(fd.get('sessions')), trainTime: fd.get('trainTime') || '18:30', bedTime: fd.get('bedTime') || '23:00',
    diet: fd.get('diet'), allergies: fd.getAll('allergies'), dislikes: (fd.get('dislikes') || '').trim(),
    stepsGoal: num(fd.get('stepsGoal')) || 10000, startDate: fd.get('startDate') || dateKey(),
  };
  const errs = [];
  if (!p.age || p.age < 16 || p.age > 90) errs.push('âge (16-90)');
  if (!p.height || p.height < 130 || p.height > 230) errs.push('taille (130-230 cm)');
  if (!p.weight || p.weight < 35 || p.weight > 250) errs.push('poids actuel');
  if (!p.goalWeight || p.goalWeight < 35 || p.goalWeight > 250) errs.push('poids cible');
  if (p.goalWeight && p.weight && p.goalWeight < p.weight * 0.9) errs.push('poids cible : plus de 10 % de perte en 14 jours n\'est pas sûr, choisis une cible plus proche');
  return { p, errs };
}

export function resultsHTML(p) {
  const t = computeTargets(p); const g = goalAnalysis(p, t);
  return `<div class="results">
    <div class="grid3">
      <div class="kpi"><span>Métabolisme de base</span><b>${t.bmr}</b><small>kcal (Mifflin-St Jeor)</small></div>
      <div class="kpi"><span>Dépense totale (TDEE)</span><b>${t.tdee}</b><small>kcal · ×${t.factor}</small></div>
      <div class="kpi hl"><span>Objectif</span><b>${t.kcal}</b><small>kcal / jour</small></div>
    </div>
    <div class="grid3">
      <div class="kpi"><span>Protéines</span><b>${t.protein} g</b><small>${(t.protein / p.weight).toFixed(1)} g/kg</small></div>
      <div class="kpi"><span>Glucides</span><b>${t.carbs} g</b><small>${Math.round(t.carbs * 4 / t.kcal * 100)} %</small></div>
      <div class="kpi"><span>Lipides</span><b>${t.fat} g</b><small>${Math.round(t.fat * 9 / t.kcal * 100)} %</small></div>
    </div>
    <div class="grid2">
      <div class="kpi"><span>Eau</span><b>${(t.water / 1000).toFixed(1)} L</b><small>+0,5 L jours d'entraînement</small></div>
      <div class="kpi"><span>Déficit</span><b>−${t.deficit}</b><small>kcal / jour (≈ ${Math.round(t.deficit / t.tdee * 100)} %)</small></div>
    </div>
    <div class="note"><b>Objectif −${g.wanted} kg en 14 jours.</b> Graisse réellement perdue estimée : ≈ ${g.fat} kg. Sur la balance, on peut voir ≈ ${g.scaleLow} à ${g.scaleHigh} kg, car l'eau et le glycogène baissent aussi en début de déficit. ${esc(g.verdict)}</div>
  </div>`;
}
