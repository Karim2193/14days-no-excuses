// SUIVI QUOTIDIEN : check-in du matin, eau, sommeil, activité, ressenti, contrôle des objectifs, bilan du soir,
// calendrier des 14 jours. Toute journée passée est modifiable (state.date).
import { dateKey, addDays, esc, r0, r1, fmtDate, parseKey, pad, num, fmtKg, nowMinutes } from '../util.js';
import { icon, toast, sheet, closeSheet } from '../ui.js';
import * as store from '../store.js';
import { dayScore, challengeIndex, keyForIndex, totals, SUCCESS, CHALLENGE_DAYS } from '../score.js';
import { isTrainingType, TYPE_LABEL } from '../training.js';
import { waterTarget } from '../nutrition.js';
import { MEALS } from '../meals.js';
import { addWater, removeWater, sleepFromTimes, distanceKm, checklist, dayStatus, eveningReport, reportToText, WATER_MAX_DAY, WATER_MAX_ADD, nowHHMM } from '../tracking.js';
import { bar } from '../charts.js';

export const state = { date: null };
const MOODS = [['top', 'Au top'], ['bien', 'Bien'], ['moyen', 'Moyen'], ['bof', 'Pas terrible'], ['mal', 'Mal']];
const SIGN = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(1).replace('.', ',');

function calendar14(s) {
  const today = dateKey();
  const cells = [];
  for (let i = 1; i <= CHALLENGE_DAYS; i++) {
    const k = keyForIndex(s, i); const st = dayStatus(s, k);
    const cls = ['d14', st.status, st.recovery ? 'rec' : '', k === today ? 'today' : '', k === state.date ? 'sel' : ''].join(' ');
    cells.push(`<button class="${cls}" data-act="j-date" data-k="${k}" ${k > today ? 'disabled' : ''} aria-label="Jour ${i} : ${st.label}${st.recovery ? ', récupération' : ''}">
      <small>J${i}</small><b>${parseKey(k).getDate()}</b><i>${st.status === 'future' ? '' : st.score != null ? st.score : ''}</i>${st.recovery ? '<em>R</em>' : ''}</button>`);
  }
  return `<section class="card"><div class="card-h"><h3>Mes 14 jours</h3><button class="link" data-act="nav" data-v="stats">Statistiques</button></div>
    <div class="cal14">${cells.join('')}</div>
    <div class="legend"><span class="lg ok"></span>complète <span class="lg mid"></span>partielle <span class="lg ko"></span>non renseignée <span class="nw"><span class="lg rec">R</span> récupération</span></div>
    <p class="fine">Touche un jour pour voir et corriger tout son historique.</p></section>`;
}

const scale10 = (d, f, label, hint = '') => `<div class="sc10"><div class="row between"><span>${label}</span><b>${d[f] != null ? d[f] + '/10' : '—'}</b></div>
  <div class="s10">${Array.from({ length: 10 }, (_, x) => x + 1).map((v) => `<button class="${d[f] === v ? 'on' : ''} ${d[f] != null && v <= d[f] ? 'fill' : ''}" data-act="j-scale" data-f="${f}" data-v="${v}" aria-label="${label} ${v} sur 10">${v}</button>`).join('')}</div>${hint ? `<small class="muted">${hint}</small>` : ''}</div>`;

export function render() {
  const s = store.get(); const today = dateKey();
  if (!state.date || state.date > today) state.date = today;
  const k = state.date; const d = s.days[k] || store.emptyDay();
  const p = s.profile; const T = s.targets;
  const sc = dayScore(s, k); const t = totals(d); const prog = sc.prog; const isT = prog && isTrainingType(prog.type);
  const wt = waterTarget(T, isT);
  const field = (f, label, step = '1', ph = '', type = 'number') => `<label>${label}<input type="${type}" ${type === 'number' ? 'inputmode="decimal"' : ''} step="${step}" value="${d[f] ?? ''}" data-chg="j-field" data-f="${f}" placeholder="${ph}"></label>`;
  const startW = p.weight;
  const prevK = Object.keys(s.days).filter((x) => x < k && s.days[x].weight != null).sort().pop();
  const prevW = prevK ? s.days[prevK].weight : null;
  const cl = checklist(s, k); const nDone = cl.filter((c) => c.done).length;
  const dist = distanceKm(s, d);
  const isPast = k < today;
  const evening = isPast || nowMinutes() >= 19 * 60;
  const R = eveningReport(s, k);
  const waterLog = d.waterLog || [];
  const wpct = Math.round(((d.water || 0) / wt) * 100);
  const mealsNoted = MEALS.filter((m) => d.foods.some((f) => f.meal === m.key)).length;

  return `<header class="topbar"><div class="title">Suivi</div><div class="row gap-s"><button class="iconbtn" data-act="nav" data-v="stats" aria-label="Statistiques">${icon('chart')}</button><button class="iconbtn" data-act="nav" data-v="body" aria-label="Corps">${icon('body')}</button></div></header>
  ${calendar14(s)}

  <section class="card day-head"><div class="card-h"><div><h3>${k === today ? 'Aujourd\'hui' : fmtDate(k)}</h3><small class="muted">${sc.index >= 1 && sc.index <= 14 ? `Jour ${sc.index}/14 · ${prog ? esc(TYPE_LABEL[prog.type]) : ''}` : 'Hors challenge'}${isPast ? ' · modification d\'un jour passé' : ''}</small></div>
    <button class="score-badge ${sc.total >= SUCCESS ? 'ok' : sc.total >= 50 ? 'mid' : 'ko'}" id="j-score" data-act="score-detail" data-k="${k}">${sc.total}<small>/100</small></button></div>
    ${isPast ? `<button class="btn ghost sm" data-act="j-date" data-k="${today}">Revenir à aujourd'hui</button>` : ''}
  </section>

  <section class="card" id="j-check"><div class="card-h"><h3>Tableau de contrôle</h3><span class="pill ${nDone === 8 ? 'ok' : ''}">${nDone}/8</span></div>
    <ul class="checklist">${cl.map((c) => `<li class="${c.done ? 'done' : ''}"><span class="cb">${c.done ? icon('check') : ''}</span><span class="grow">${esc(c.label)}</span><small>${esc(c.info)}</small></li>`).join('')}</ul>
    <p class="fine">Coché automatiquement à partir de tes données, rien à cocher à la main.</p></section>

  <section class="card form" id="j-morning"><h3>${icon('sun')} Check-in du matin</h3>
    <div class="grid2">${field('weight', 'Poids (kg)', '0.1', 'ex : 76,8')}<label>Heure de pesée<input type="time" value="${d.weighTime || ''}" data-chg="j-time" data-f="weighTime"></label></div>
    ${d.weight != null ? `<div class="wcmp"><div><span>vs veille</span><b class="${prevW != null && d.weight < prevW ? 'green' : ''}">${prevW != null ? SIGN(r1(d.weight - prevW)) + ' kg' : '—'}</b></div><div><span>vs départ (${fmtKg(startW)})</span><b class="${d.weight < startW ? 'green' : ''}">${SIGN(r1(d.weight - startW))} kg</b></div><div><span>Objectif</span><b>${fmtKg(p.goalWeight)}</b></div></div>
      <p class="fine">Le poids varie de 0,5 à 1,5 kg d'un jour à l'autre (eau, sel, glucides, digestion). Juge la tendance sur plusieurs jours, pas une pesée isolée.</p>` : '<p class="fine">Pèse-toi au réveil, après les toilettes, avant de boire ou manger, toujours dans les mêmes conditions.</p>'}
    <h4>Sommeil</h4>
    <div class="grid2"><label>Coucher<input type="time" value="${d.bedAt || ''}" data-chg="j-time" data-f="bedAt"></label><label>Réveil<input type="time" value="${d.wakeAt || ''}" data-chg="j-time" data-f="wakeAt"></label></div>
    <div class="grid2">${field('sleep', 'Durée (h, calculée)', '0.25', 'auto')}${field('wakeups', 'Réveils nocturnes', '1', '0')}</div>
    ${scale10(d, 'sleepQuality', 'Qualité du sommeil')}
    ${scale10(d, 'wakeFatigue', 'Fatigue au réveil', '1 = en pleine forme, 10 = épuisé')}
    <h4>État du jour</h4>
    ${scale10(d, 'energy', 'Énergie')}${scale10(d, 'motivation', 'Motivation')}${scale10(d, 'recovery', 'Récupération ressentie')}
    ${scale10(d, 'soreness', 'Courbatures', '1 = aucune, 10 = très fortes')}
    <div class="scale"><span>Humeur</span><div class="chips">${MOODS.map(([v, l]) => `<button class="chip ${d.mood === v ? 'on' : ''}" data-act="j-mood" data-v="${v}"><span>${l}</span></button>`).join('')}</div></div>
  </section>

  <section class="card" id="j-water"><div class="card-h"><h3>${icon('drop')} Eau</h3><span class="pill">${wpct} %</span></div>
    <div class="water-big"><b>${((d.water || 0) / 1000).toFixed(2).replace('.', ',')} L</b><span>/ ${(wt / 1000).toFixed(1).replace('.', ',')} L${isT ? ' (jour d\'entraînement)' : ''}</span></div>
    ${bar(d.water || 0, wt, { cls: 'w' })}
    <div class="wbtns">${[150, 250, 330, 500].map((v) => `<button class="btn ghost sm" data-act="j-water" data-v="${v}">+${v} ml</button>`).join('')}<button class="btn ghost sm" data-act="j-water-custom">Autre…</button></div>
    ${(d.water || 0) >= WATER_MAX_DAY ? '<p class="warn">Plus de 5 L aujourd\'hui. Inutile d\'aller au-delà : boire trop d\'eau d\'un coup peut être dangereux (hyponatrémie). Bois selon ta soif maintenant.</p>' : (d.water || 0) >= wt ? '<p class="ok-t">Objectif atteint. Continue selon ta soif, sans forcer.</p>' : ''}
    ${waterLog.length ? `<details><summary>Historique (${waterLog.length} prise${waterLog.length > 1 ? 's' : ''})</summary><ul class="hist">${waterLog.map((w, i) => `<li><span>${w.t ? w.t : 'saisie précédente'}</span><span class="row gap-s"><b>${w.ml > 0 ? '+' : ''}${w.ml} ml</b><button class="iconbtn sm" data-act="j-water-del" data-i="${i}" aria-label="Supprimer">${icon('trash')}</button></span></li>`).join('')}</ul></details>` : ''}
  </section>

  <section class="card form" id="j-activity"><div class="card-h"><h3>${icon('walk')} Activité</h3><button class="link" data-act="nav" data-v="sport">Séance</button></div>
    <div class="grid2">${field('steps', 'Pas', '100', 'pas')}${field('distance', 'Distance (km)', '0.1', dist.km != null ? '≈ ' + String(dist.km).replace('.', ',') : 'km')}</div>
    ${dist.km != null && dist.estimated ? `<p class="fine">Distance estimée : ${String(dist.km).replace('.', ',')} km (foulée ≈ 0,415 × ta taille). Saisis la valeur de l'app Santé si tu l'as.</p>` : ''}
    <div class="summary-grid">
      <div><span>Entraînement</span><b>${R.training}</b></div>
      <div><span>Durée sportive</span><b>${R.sportMin} min</b><small>≈ ${R.sportKcal} kcal (non rajoutées)</small></div>
    </div>
  </section>

  <section class="card"><div class="card-h"><h3>${icon('food')} Nutrition</h3><button class="link" data-act="j-food">Modifier</button></div>
    <div class="summary-grid">
      <div><span>Calories</span><b>${r0(t.kcal)}</b><small>/ ${T.kcal} · ${t.kcal <= T.kcal ? r0(T.kcal - t.kcal) + ' restantes' : r0(t.kcal - T.kcal) + ' en trop'}</small></div>
      <div><span>Protéines</span><b>${r0(t.p)} g</b><small>/ ${T.protein} g</small></div>
      <div><span>Glucides · Lipides</span><b>${r0(t.c)} · ${r0(t.f)} g</b><small>/ ${T.carbs} · ${T.fat} g</small></div>
      <div><span>Fibres · Repas</span><b>${r0(t.fi)} g · ${mealsNoted}/4</b><small>objectif fibres 30 g</small></div>
    </div></section>

  <section class="card form" id="j-journal"><h3>${icon('journal')} Journal</h3>
    <label>Écarts alimentaires<input type="text" value="${esc(d.deviation)}" data-chg="j-text" data-f="deviation" placeholder="ex : 2 bières vendredi soir"></label>
    <label class="checkline"><input type="checkbox" data-chg="j-nodev" ${d.noDeviation ? 'checked' : ''}> Aucun écart aujourd'hui</label>
    <label>Commentaire personnel<textarea rows="3" data-chg="j-text" data-f="comment" placeholder="Comment s'est passée ta journée ?">${esc(d.comment)}</textarea></label>
    <details><summary>Mensurations du jour (cm)</summary><div class="grid2">${field('waist', 'Taille', '0.5')}${field('belly', 'Ventre (nombril)', '0.5')}${field('hips', 'Hanches', '0.5')}${field('chest', 'Poitrine', '0.5')}${field('arm', 'Bras', '0.5')}${field('thigh', 'Cuisse', '0.5')}</div><p class="fine">Une fois par semaine suffit, même heure, mètre ruban non serré.</p></details>
    <p class="fine">Enregistrement automatique à chaque modification.</p>
  </section>

  <section class="card report ${evening ? '' : 'early'}" id="j-report"><div class="card-h"><h3>BILAN DU JOUR ${R.i >= 1 && R.i <= 14 ? R.i + '/14' : ''}</h3><button class="link" data-act="j-copy">Copier</button></div>
    ${evening ? '' : '<p class="fine">Le bilan complet s\'affiche à partir de 19 h. Voici l\'état actuel :</p>'}
    <div class="rep-grid">
      <div><span>Poids</span><b>${R.weight != null ? fmtKg(R.weight) : '—'}</b><small>${R.fromStart != null ? SIGN(R.fromStart) + ' kg depuis le départ' : 'non pesé'}</small></div>
      <div><span>Calories</span><b>${R.kcal}</b><small>${R.rest >= 0 ? R.rest + ' restantes' : -R.rest + ' de dépassement'}</small></div>
      <div><span>P · G · L</span><b>${R.p} · ${R.c} · ${R.f}</b><small>g</small></div>
      <div><span>Eau</span><b>${(R.water / 1000).toFixed(1).replace('.', ',')} L</b><small>/ ${(R.waterTarget / 1000).toFixed(1).replace('.', ',')} L</small></div>
      <div><span>Pas</span><b>${R.steps.toLocaleString('fr-FR')}</b><small>${R.km.km != null ? String(R.km.km).replace('.', ',') + ' km' : ''}</small></div>
      <div><span>Sport</span><b>${R.sportMin} min</b><small>${esc(R.training)}</small></div>
      <div><span>Sommeil</span><b>${R.sleep != null ? String(R.sleep).replace('.', ',') + ' h' : '—'}</b></div>
      <div><span>Score</span><b class="${R.success ? 'green' : ''}">${R.score}/100</b><small>${R.success ? 'journée réussie' : 'réussite à 70'}</small></div>
    </div>
    ${evening ? `<div class="rep-a"><h4 class="green">Bien fait</h4><ul>${R.good.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul>
      <h4 class="red">Raté</h4><ul>${R.missed.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>Rien. Parfait.</li>'}</ul>
      <h4>À améliorer demain</h4><ul>${R.improve.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>Refaire pareil.</li>'}</ul>
      <div class="rep-k"><div><span>Point faible</span><b>${esc(R.weakest)}</b></div><div><span>Priorité de demain</span><b>${esc(R.priority)}</b></div></div></div>` : ''}
  </section>
  ${renderPast(s)}`;
}

function renderPast(s) {
  const keys = Object.keys(s.days).sort().reverse().filter((k) => k <= dateKey()).slice(0, 30);
  if (!keys.length) return '';
  return `<section class="card"><h3>Toutes mes journées</h3><ul class="hist">${keys.map((k) => { const sc = dayScore(s, k); const st = dayStatus(s, k); const d = s.days[k]; return `<li><button data-act="j-date" data-k="${k}"><span>${fmtDate(k)} <small class="st-${st.status}">${st.label}</small>${d.comment ? '<br><small class="muted">' + esc(d.comment.slice(0, 50)) + '</small>' : ''}</span><b class="${sc.total >= SUCCESS ? 'green' : ''}">${sc.total}</b></button></li>`; }).join('')}</ul></section>`;
}

// Re-rendu différé : on attend que l'utilisateur ait quitté le champ en cours de saisie (sinon iOS ferme le clavier).
let deferT = 0;
function deferRender() {
  clearTimeout(deferT);
  deferT = setTimeout(() => {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#main')) { a.addEventListener('blur', deferRender, { once: true }); return; }
    store.update(() => {});
  }, 60);
}

function refreshScore() {
  const el = document.getElementById('j-score'); if (!el) return;
  const sc = dayScore(store.get(), state.date);
  el.innerHTML = `${sc.total}<small>/100</small>`; el.className = `score-badge ${sc.total >= SUCCESS ? 'ok' : sc.total >= 50 ? 'mid' : 'ko'}`;
}

const LIMITS = { weight: [30, 300], steps: [0, 100000], sleep: [0, 16], wakeups: [0, 30], distance: [0, 100], waist: [30, 250], belly: [30, 250], hips: [30, 250], chest: [30, 250], arm: [10, 100], thigh: [20, 150] };

export const actions = {
  'j-date'(el) { state.date = el.dataset.k; window.scrollTo(0, 0); },
  'j-field'(el) {
    const f = el.dataset.f; let v = num(el.value);
    const lim = LIMITS[f];
    if (v != null && lim && (v < lim[0] || v > lim[1])) { toast('Valeur invalide', 'bad'); el.value = store.get().days[state.date]?.[f] ?? ''; return false; }
    store.update(() => {
      const d = store.day(state.date);
      d[f] = v == null ? null : ['steps', 'wakeups'].includes(f) ? Math.round(v) : v;
      if (f === 'weight' && v != null && !d.weighTime && state.date === dateKey()) d.weighTime = nowHHMM();
      if (f === 'sleep') d.sleepManual = v != null;
    }, { silent: true });
    refreshScore(); deferRender(); return false;
  },
  'j-time'(el) {
    const f = el.dataset.f; const v = el.value || null;
    store.update(() => {
      const d = store.day(state.date); d[f] = v;
      if ((f === 'bedAt' || f === 'wakeAt') && d.bedAt && d.wakeAt) { const h = sleepFromTimes(d.bedAt, d.wakeAt); if (h != null && h <= 16) { d.sleep = h; d.sleepManual = false; const inp = document.querySelector('[data-f="sleep"]'); if (inp) inp.value = h; } }
    }, { silent: true });
    refreshScore(); deferRender(); return false;
  },
  'j-text'(el) { store.update(() => { store.day(state.date)[el.dataset.f] = el.value.trim(); }, { silent: true }); refreshScore(); return false; },
  'j-nodev'(el) { store.update(() => { store.day(state.date).noDeviation = el.checked; }); },
  'j-scale'(el) { store.update(() => { const d = store.day(state.date); const v = Number(el.dataset.v); d[el.dataset.f] = d[el.dataset.f] === v ? null : v; }); },
  'j-mood'(el) { store.update(() => { const d = store.day(state.date); d.mood = d.mood === el.dataset.v ? null : el.dataset.v; }); },
  'j-water'(el) { waterAdd(Number(el.dataset.v)); },
  'j-water-custom'() {
    const p = sheet(`<h3>Ajouter de l'eau</h3><form id="wf" class="form"><label>Quantité (ml)<input name="v" type="number" inputmode="numeric" step="10" min="10" max="${WATER_MAX_ADD}" autofocus placeholder="ex : 750"></label>
      <p class="fine">Maximum ${WATER_MAX_ADD} ml par saisie. Mieux vaut boire régulièrement que beaucoup d'un coup.</p><button class="btn primary block">Ajouter</button></form>`);
    p.querySelector('#wf').addEventListener('submit', (e) => {
      e.preventDefault(); const v = num(new FormData(e.target).get('v'));
      if (v == null || v <= 0) { toast('Quantité invalide', 'bad'); return; }
      if (v > WATER_MAX_ADD) { toast(`Maximum ${WATER_MAX_ADD} ml d'un coup`, 'bad'); return; }
      closeSheet(); waterAdd(Math.round(v));
    });
    return false;
  },
  'j-water-del'(el) { store.update(() => removeWater(store.day(state.date), Number(el.dataset.i))); },
  'j-copy'() {
    const txt = reportToText(eveningReport(store.get(), state.date));
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Bilan copié', 'good'), () => { sheet(`<h3>Bilan</h3><textarea rows="14" readonly>${esc(txt)}</textarea><button class="btn ghost block" data-act="sheet-close">Fermer</button>`); });
    return false;
  },
};

export function waterAdd(ml, k = state.date || dateKey()) {
  const before = store.get().days[k]?.water || 0;
  if (before >= WATER_MAX_DAY && ml > 0) { toast('Déjà plus de 5 L aujourd\'hui : inutile d\'en rajouter.', 'bad'); return; }
  store.update(() => addWater(store.day(k), ml, k === dateKey() ? nowHHMM() : null));
  const after = before + ml;
  if (after >= WATER_MAX_DAY) toast('5 L atteints. Ne force plus, bois à ta soif.', 'bad');
  else toast(`+${ml} ml`, 'good');
}
