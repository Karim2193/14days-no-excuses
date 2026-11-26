// Réglages : profil, rappels & notifications, calendrier, coach IA, sauvegarde, installation.
import { esc, dateKey } from '../util.js';
import { icon, toast, confirmSheet, sheet, closeSheet } from '../ui.js';
import * as store from '../store.js';
import * as notify from '../notify.js';
import { profileForm, readProfileForm, resultsHTML } from './onboarding.js';
import { computeTargets } from '../nutrition.js';
import { generatePlan } from '../meals.js';
import { challengeIndex } from '../score.js';

export const APP_VERSION = '1.1.0';

export function render() {
  const s = store.get(); const T = s.targets;
  const perm = notify.permission(); const standalone = notify.isStandalone(); const ios = notify.isIOS();
  const permLabel = { granted: 'Autorisées ✓', denied: 'Refusées (à réactiver dans Réglages iOS → Notifications)', default: 'Pas encore demandées', unsupported: ios && !standalone ? 'Indisponibles hors écran d\'accueil' : 'Non supportées par ce navigateur' }[perm];
  return `<header class="topbar"><button class="iconbtn" data-act="nav" data-v="home" aria-label="Retour">${icon('back')}</button><div class="title">Réglages</div><span></span></header>
  <section class="card"><div class="card-h"><h3>Mes objectifs</h3><button class="link" data-act="set-profile">Modifier le profil</button></div>
    <div class="grid3 kpis"><div><span>Calories</span><b>${T.kcal}</b></div><div><span>Protéines</span><b>${T.protein} g</b></div><div><span>Eau</span><b>${(T.water / 1000).toFixed(1)} L</b></div></div>
    <p class="small muted">BMR ${T.bmr} kcal · TDEE ${T.tdee} kcal · déficit ${T.deficit} kcal · G ${T.carbs} g · L ${T.fat} g</p></section>

  <section class="card"><div class="card-h"><h3>${icon('bell')} Rappels</h3><span class="pill ${perm === 'granted' ? 'green' : ''}">${permLabel}</span></div>
    ${ios && !standalone ? '<p class="note">Pour recevoir des notifications sur iPhone, l\'app doit d\'abord être ajoutée à l\'écran d\'accueil (Safari → Partager → « Sur l\'écran d\'accueil »), puis ouverte depuis l\'icône.</p>' : ''}
    <div class="row gap-s wrap">${perm !== 'granted' && perm !== 'unsupported' ? '<button class="btn primary sm" data-act="notif-ask">Activer les notifications</button>' : ''}<button class="btn ghost sm" data-act="notif-test">Tester une notification</button></div>
    <ul class="reminders">${s.settings.reminders.map((r, i) => `<li><label class="switch"><input type="checkbox" data-chg="rem-on" data-i="${i}" ${r.on ? 'checked' : ''}><span></span></label>
      <input type="time" value="${r.time}" data-chg="rem-time" data-i="${i}" aria-label="Heure ${esc(r.label)}"><div class="grow"><b>${esc(r.label)}</b><input type="text" value="${esc(r.text)}" data-chg="rem-text" data-i="${i}" aria-label="Texte du rappel"></div></li>`).join('')}</ul>
    <details class="limits"><summary>Ce qui fonctionne vraiment sur iPhone</summary>
      <ul class="small">
        <li><b>Notifications de l'app</b> : iOS 16.4 ou plus récent, app ajoutée à l'écran d'accueil, autorisation donnée. Elles se déclenchent à l'heure prévue <b>quand l'app est ouverte ou en arrière-plan récent</b>. Les rappels « séance non validée », hydratation et bilans sont personnalisés selon tes résultats du jour.</li>
        <li><b>Limite iOS</b> : une web app ne peut pas programmer seule une notification à heure fixe quand elle est fermée. Il faudrait un serveur d'envoi (Web Push) qui tourne en permanence, ce qui sort du « 100 % gratuit sans serveur ». Je ne fais donc pas semblant.</li>
        <li><b>Rappels manqués</b> : à chaque ouverture, l'app affiche les rappels passés de la journée.</li>
        <li><b>Alternative fiable, app fermée</b> : ajoute les rappels à ton Calendrier iPhone (bouton ci-dessous). iOS les déclenche à la minute près, même téléphone verrouillé. Ils ne s'adaptent pas à tes résultats : pour ça, ouvre l'app.</li>
      </ul></details>
    <button class="btn primary block" data-act="ics">Ajouter les rappels au Calendrier iPhone (.ics)</button>
    <p class="fine">Le fichier contient un événement avec alarme pour chaque rappel actif, sur les jours restants du challenge. Réexporte-le si tu changes les horaires.</p></section>

  <section class="card"><h3>Coach IA (optionnel)</h3>
    <p class="small muted">Par défaut, le coach fonctionne en local, gratuitement et hors ligne. Si tu veux des réponses rédigées par une IA, colle une clé API Anthropic personnelle (facturation à l'usage chez le fournisseur, quelques centimes par jour). La clé reste uniquement sur ton téléphone.</p>
    <form class="form" data-submit="api-save"><label>Clé API<input name="k" type="password" autocomplete="off" value="${esc(s.settings.apiKey)}" placeholder="sk-ant-…"></label>
      <label>Modèle<input name="m" value="${esc(s.settings.apiModel)}"></label><div class="row gap-s"><button class="btn primary grow">Enregistrer</button>${s.settings.apiKey ? '<button type="button" class="btn ghost" data-act="api-clear">Retirer</button>' : ''}</div></form></section>

  <section class="card"><h3>Mes données</h3>
    <p class="small muted">Tout est stocké sur ce téléphone (IndexedDB + copie de secours), enregistré automatiquement à chaque action et conservé après fermeture et mises à jour. Aucun compte, aucun serveur. Fais un export de temps en temps.</p>
    <div class="row gap-s wrap"><button class="btn primary grow" data-act="export">Exporter (JSON)</button><label class="btn ghost grow filebtn">Importer<input type="file" accept="application/json,.json" data-chg="import" hidden></label></div>
    <button class="btn ghost block sm" data-act="replan">Régénérer le programme alimentaire</button>
    <button class="btn danger block sm" data-act="reset">Tout effacer</button></section>

  <section class="card"><h3>Installer sur l'iPhone</h3><ol class="small steps"><li>Ouvre l'adresse de l'app dans <b>Safari</b>.</li><li>Touche le bouton <b>Partager</b> (carré avec flèche).</li><li>Choisis <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li><li>Ouvre l'app depuis la nouvelle icône, puis active les notifications ici.</li></ol>
    <p class="fine">Version ${APP_VERSION} · ${standalone ? 'lancée depuis l\'écran d\'accueil' : 'lancée dans le navigateur'}</p></section>`;
}

export const actions = {
  'set-profile'() {
    const s = store.get();
    const p = sheet(`<h3>Profil</h3>${profileForm(s.profile, { submitLabel: 'Recalculer et enregistrer', editing: true })}`);
    const form = p.querySelector('#profile-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const { p: np, errs } = readProfileForm(form);
      if (errs.length) { const er = p.querySelector('#pf-err'); er.textContent = 'À corriger : ' + errs.join(', '); er.hidden = false; return; }
      const regen = await confirmSheet('Mettre à jour le programme ?', 'Les objectifs sont recalculés. Le programme alimentaire des jours à venir sera régénéré selon ton nouveau profil (les repas déjà notés ne changent pas).', 'Mettre à jour');
      store.update((st) => {
        st.profile = { ...st.profile, ...np }; st.targets = computeTargets(st.profile);
        if (regen) { const from = Math.max(1, challengeIndex(st)); const fresh = generatePlan(st.targets, st.profile); for (let d = from; d <= 14; d++) st.plan[d] = fresh[d]; }
      });
      toast('Profil mis à jour', 'good');
    });
    return false;
  },
  async 'notif-ask'() {
    const r = await notify.requestPermission();
    toast(r === 'granted' ? 'Notifications activées' : r === 'denied' ? 'Refusées : réactive-les dans Réglages iOS' : 'Notifications indisponibles ici', r === 'granted' ? 'good' : 'bad');
    store.update(() => {});
  },
  async 'notif-test'() {
    const ok = await notify.show('14 DAYS — Test', 'Si tu lis ceci, les notifications fonctionnent. Maintenant, au travail.', 'test');
    toast(ok ? 'Notification envoyée' : 'Notification impossible : autorise-les d\'abord (app installée sur l\'écran d\'accueil)', ok ? 'good' : 'bad');
    return false;
  },
  'rem-on'(el) { store.update((s) => { s.settings.reminders[el.dataset.i].on = el.checked; }, { silent: true }); return false; },
  'rem-time'(el) { if (!el.value) return false; store.update((s) => { s.settings.reminders[el.dataset.i].time = el.value; delete s.settings.lastFired[`${dateKey()}:${s.settings.reminders[el.dataset.i].id}`]; }, { silent: true }); toast('Horaire enregistré'); return false; },
  'rem-text'(el) { store.update((s) => { s.settings.reminders[el.dataset.i].text = el.value.trim() || s.settings.reminders[el.dataset.i].text; }, { silent: true }); return false; },
  async ics() {
    const s = store.get(); const txt = notify.buildICS(s);
    const file = new File([txt], '14days-rappels.ics', { type: 'text/calendar' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Rappels 14 DAYS' }); return false; }
    } catch (e) { if (e.name === 'AbortError') return false; }
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = '14days-rappels.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Fichier calendrier généré', 'good'); return false;
  },
  'api-save'(form) { store.update((s) => { s.settings.apiKey = form.k.value.trim(); s.settings.apiModel = form.m.value.trim() || 'claude-haiku-5-5'; }); toast('Réglage du coach enregistré', 'good'); },
  'api-clear'() { store.update((s) => { s.settings.apiKey = ''; }); },
  async export() {
    const txt = store.exportJSON(); const name = `14days-sauvegarde-${dateKey()}.json`;
    const file = new File([txt], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sauvegarde 14 DAYS' }); return false; } } catch (e) { if (e.name === 'AbortError') return false; }
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Sauvegarde exportée', 'good'); return false;
  },
  async import(el) {
    const f = el.files?.[0]; if (!f) return false;
    if (!(await confirmSheet('Importer cette sauvegarde ?', 'Les données actuelles seront remplacées par celles du fichier.', 'Importer', true))) return false;
    try { await store.importJSON(await f.text()); toast('Sauvegarde restaurée', 'good'); } catch (e) { toast('Fichier invalide : ' + e.message, 'bad'); }
    return false;
  },
  async replan() {
    if (!(await confirmSheet('Régénérer le programme ?', 'Les 14 jours de repas seront recréés (repas déjà notés conservés).', 'Régénérer'))) return false;
    store.update((s) => { s.plan = generatePlan(s.targets, s.profile); }); toast('Programme régénéré', 'good'); return false;
  },
  async reset() {
    if (!(await confirmSheet('Tout effacer ?', 'Profil, journal, photos, historique : tout sera supprimé de ce téléphone. Exporte d\'abord si tu veux garder une copie.', 'Tout effacer', true))) return false;
    await store.resetAll(); location.hash = '#home'; toast('Données effacées'); return false;
  },
};
