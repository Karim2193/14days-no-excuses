// Point d'entrée : chargement des données, navigation, délégation d'événements, rendu.
import * as store from './store.js';
import * as notify from './notify.js';
import { dateKey, esc } from './util.js';
import { icon, toast, sheet, closeSheet, sheetOpen } from './ui.js';
import { bindTips } from './charts.js';
import { computeTargets } from './nutrition.js';
import { generatePlan } from './meals.js';
import { challengeIndex } from './score.js';
import * as home from './views/home.js';
import * as nutrition from './views/nutrition.js';
import * as sport from './views/sport.js';
import * as coach from './views/coach.js';
import * as suivi from './views/suivi.js';
import * as statsView from './views/stats.js';
import * as body from './views/body.js';
import * as report from './views/report.js';
import * as settings from './views/settings.js';
import { profileForm, readProfileForm, resultsHTML } from './views/onboarding.js';

const VIEWS = { home, nutrition, sport, suivi, coach, body, report, settings, stats: statsView };
const ALIAS = { journal: 'suivi' }; // anciens liens
const NAV_OF = { body: 'suivi', stats: 'suivi', report: 'home', settings: 'home' };
const NAV = [['home', 'Accueil', 'home'], ['nutrition', 'Nutrition', 'food'], ['sport', 'Sport', 'sport'], ['suivi', 'Suivi', 'journal'], ['coach', 'Coach', 'coach']];
const ACTIONS = {};
for (const v of Object.values(VIEWS)) Object.assign(ACTIONS, v.actions || {});

let current = 'home';
let ctx = {};
let onboardStep = { p: null };
const main = () => document.getElementById('main');

function route() {
  let h = (location.hash || '#home').slice(1).split('?')[0];
  h = ALIAS[h] || h;
  current = VIEWS[h] ? h : 'home';
}

let raf = 0;
function scheduleRender() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

function render() {
  const s = store.get();
  const nav = document.getElementById('nav');
  if (!s.profile) { nav.hidden = true; renderOnboarding(); return; }
  nav.hidden = false;
  nav.innerHTML = NAV.map(([id, l, ic]) => `<button class="${(NAV_OF[current] || current) === id ? 'on' : ''}" data-act="nav" data-v="${id}" aria-label="${l}">${icon(ic)}<span>${l}</span></button>`).join('');
  const y = window.scrollY;
  const v = VIEWS[current];
  try {
    main().innerHTML = `<div class="view v-${current}">${v.render(ctx)}</div>`;
  } catch (e) {
    console.error(e);
    main().innerHTML = `<section class="card"><h3>Oups</h3><p class="muted">Erreur d'affichage : ${esc(e.message)}. Tes données sont intactes.</p><button class="btn primary" data-act="nav" data-v="home">Retour à l'accueil</button></section>`;
  }
  ctx = {};
  bindTips(main());
  v.after?.(main());
  window.scrollTo(0, y);
}

function renderOnboarding() {
  const m = main();
  if (!onboardStep.p) {
    m.innerHTML = `<div class="onboard"><div class="ob-hero"><div class="brand big">14 DAYS <i>—</i> NO EXCUSES</div>
      <p>14 jours. Un plan. Zéro excuse. Réponds honnêtement : tes calories, tes macros, tes repas et ton programme sont calculés à partir de ça.</p></div>
      <section class="card">${profileForm({}, {})}</section>
      <p class="fine center">Données stockées uniquement sur ton téléphone. Ce programme ne remplace pas un avis médical : en cas de pathologie, demande l'avis de ton médecin.</p></div>`;
    const form = m.querySelector('#profile-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const { p, errs } = readProfileForm(form);
      const er = m.querySelector('#pf-err');
      if (errs.length) { er.textContent = 'À corriger : ' + errs.join(', '); er.hidden = false; return; }
      onboardStep.p = p; renderOnboarding(); window.scrollTo(0, 0);
    });
  } else {
    m.innerHTML = `<div class="onboard"><div class="ob-hero"><div class="eyebrow">Ton plan</div><h1>Les chiffres</h1></div>
      <section class="card">${resultsHTML(onboardStep.p)}</section>
      <div class="row gap"><button class="btn ghost" id="ob-back">Modifier</button><button class="btn primary grow" id="ob-go">Je m'engage. On commence.</button></div></div>`;
    m.querySelector('#ob-back').onclick = () => { const p = onboardStep.p; onboardStep.p = null; renderOnboarding(); const f = m.querySelector('#profile-form'); for (const [k, v] of Object.entries(p)) { const el = f.elements[k]; if (!el) continue; if (k === 'allergies') f.querySelectorAll('[name=allergies]').forEach((c) => { c.checked = v.includes(c.value); }); else if (v != null) el.value = v; } };
    m.querySelector('#ob-go').onclick = () => {
      const p = onboardStep.p;
      store.update((s) => {
        s.profile = p; s.targets = computeTargets(p); s.plan = generatePlan(s.targets, p);
        const d = store.day(p.startDate <= dateKey() ? dateKey() : p.startDate);
        if (p.startDate === dateKey()) { d.weight = p.weight; if (p.waist) d.waist = p.waist; }
        if (p.trainTime) { const r = s.settings.reminders.find((x) => x.id === 'sport'); if (r) r.time = p.trainTime; }
        const nowM = new Date().getHours() * 60 + new Date().getMinutes();
        for (const r of s.settings.reminders) { const [h, mi] = r.time.split(':').map(Number); if (h * 60 + mi <= nowM) s.settings.lastFired[`${dateKey()}:${r.id}`] = Date.now(); }
      });
      store.saveNow(); onboardStep.p = null; location.hash = '#home'; toast('Challenge lancé. Jour 1.', 'good');
    };
  }
}

// ——— Délégation d'événements ———
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  if (act === 'nav') {
    e.preventDefault();
    if (el.dataset.chat) ctx.chat = true;
    if (sheetOpen()) closeSheet();
    if (location.hash === '#' + el.dataset.v) { route(); render(); window.scrollTo(0, 0); } else { location.hash = '#' + el.dataset.v; }
    return;
  }
  if (act === 'sheet-close') { closeSheet(); return; }
  if (act === 'goto-journal') { suivi.state.date = el.dataset.k > dateKey() ? dateKey() : el.dataset.k; location.hash = '#suivi'; return; }
  if (act === 'j-food') { nutrition.state.date = suivi.state.date || dateKey(); nutrition.state.tab = 'jour'; location.hash = '#nutrition'; return; }
  if (act === 'add-food-quick') { nutrition.state.date = dateKey(); ACTIONS['add-food']({ dataset: {} }); return; }
  const fn = ACTIONS[act]; if (!fn) return;
  e.preventDefault();
  try { const r = await fn(el, e); if (r !== false) scheduleRender(); } catch (err) { console.error(err); toast('Erreur : ' + err.message, 'bad'); }
});
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-chg]'); if (!el) return;
  const fn = ACTIONS[el.dataset.chg]; if (!fn) return;
  try { const r = await fn(el, e); if (r !== false) scheduleRender(); } catch (err) { console.error(err); toast('Erreur : ' + err.message, 'bad'); }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-submit]'); if (!form) return;
  e.preventDefault();
  const fn = ACTIONS[form.dataset.submit]; if (!fn) return;
  try { const r = await fn(form, e); if (r !== false) scheduleRender(); } catch (err) { console.error(err); toast('Erreur : ' + err.message, 'bad'); }
});
window.addEventListener('hashchange', () => { if (sheetOpen()) closeSheet(); route(); render(); window.scrollTo(0, 0); });

// Rappels déclenchés pendant que l'app est ouverte / rappels manqués à l'ouverture
function onReminders(fired) {
  const late = fired.filter((f) => f.late).slice(-3); const now = fired.filter((f) => !f.late);
  for (const f of now) toast(`${f.r.label} : ${f.body}`, 'push');
  if (late.length && !sheetOpen()) {
    sheet(`<h3>${icon('bell')} Rappels de la journée</h3><ul class="insights">${late.map((f) => `<li class="tone-${f.r.conditional ? 'warn' : 'info'}"><b>${esc(f.r.time)} · ${esc(f.r.label)}</b><br>${esc(f.body)}</li>`).join('')}</ul><button class="btn primary block" data-act="sheet-close">Compris</button>`);
  }
}

// Midnight / retour au premier plan : rafraîchit l'affichage si la date a changé
let lastDay = dateKey();
setInterval(() => { if (dateKey() !== lastDay) { lastDay = dateKey(); nutrition.state.date = null; suivi.state.date = null; scheduleRender(); } }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && store.get()?.profile) scheduleRender(); });

async function boot() {
  await store.load();
  // Recalcul après correction de profil (objectifs + programme des jours restants), sans toucher à l'historique.
  if (store.get().needsRecalc && store.get().profile) {
    store.update((st) => {
      st.targets = computeTargets(st.profile);
      st.plan = generatePlan(st.targets, st.profile); // les 14 jours, aucune portion calculée sur l'ancien profil n'est conservée
      delete st.needsRecalc;
    }, { silent: true });
    await store.saveNow();
  }
  route();
  store.subscribe(scheduleRender);
  render();
  document.getElementById('splash')?.remove();
  if (store.get().profile) notify.start(onReminders);
  store.subscribe(() => { if (store.get().profile && !boot.started) { boot.started = true; notify.start(onReminders); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Mise à jour installée : elle sera active à la prochaine ouverture.'); });
      });
    } catch (e) { console.warn('SW', e); }
  }
}
boot.started = !!0;
boot().catch((e) => { console.error(e); document.getElementById('main').innerHTML = `<p style="padding:24px">Erreur de démarrage : ${esc(e.message)}</p>`; });

window.__ndne = { store, notify }; // pour les tests automatisés
