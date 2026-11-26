// Persistance : IndexedDB (principal) + copie miroir dans localStorage (secours).
// Sauvegarde automatique (debounce) + sauvegarde forcée à la mise en arrière-plan.
import { dateKey } from './util.js';

const DB_NAME = 'ndne';
const DB_VERSION = 1;
const LS_KEY = 'ndne_state_v1';
export const SCHEMA = 1;

let db = null;
let state = null;
let saveTimer = null;
const listeners = new Set();

export const DEFAULT_REMINDERS = [
  { id: 'pesee', time: '08:30', label: 'Pesée et bilan du matin', text: 'Balance, toilettes faites, avant de manger. Note ton poids.', on: true },
  { id: 'nutri', time: '09:00', label: 'Objectif nutritionnel', text: 'Ton plan du jour est prêt. Chaque repas compte.', on: true },
  { id: 'dej', time: '12:30', label: 'Déjeuner', text: 'Déjeuner du plan. Pèse, note, mange. Pas d\'improvisation.', on: true },
  { id: 'eau', time: '16:00', label: 'Hydratation et collation', text: 'Où en est ta bouteille ? Collation protéinée maintenant.', on: true },
  { id: 'sport', time: '19:00', label: 'Séance sportive', text: 'L\'heure de ta séance. Sac prêt, pas de négociation.', on: true },
  { id: 'bilan', time: '21:30', label: 'Bilan alimentaire et sportif', text: 'Tout est noté ? Repas, eau, pas, séance.', on: true },
  { id: 'discipline', time: '22:30', label: 'Bilan du soir et discipline', text: 'Regarde ton score et prépare demain. Coucher à l\'heure.', on: true },
  { id: 'eau2', time: '11:00', label: 'Hydratation (matin)', text: 'Un verre d\'eau maintenant. Seulement si tu es en retard sur ton rythme.', on: true, conditional: true },
  { id: 'eau3', time: '14:30', label: 'Hydratation (après-midi)', text: 'Rattrape ton retard d\'eau, tranquillement, sans forcer.', on: true, conditional: true },
  { id: 'diner', time: '20:00', label: 'Dîner', text: 'Dîner du plan. Pèse, note, et ferme la cuisine après.', on: true },
  { id: 'journal', time: '22:00', label: 'Journal', text: 'Remplis ton suivi : ressenti, écarts, commentaire. 60 secondes.', on: true },
  { id: 'seance_nv', time: '20:30', label: 'Séance non validée (spécial)', text: 'Ta séance n\'est toujours pas validée.', on: true, conditional: true },
];

export function freshState() {
  return {
    schema: SCHEMA, createdAt: Date.now(), profile: null, targets: null, plan: {}, days: {},
    customFoods: [], recipes: [], recent: [], offCache: {}, shopping: {}, chat: [],
    settings: { reminders: DEFAULT_REMINDERS.map((r) => ({ ...r })), notif: false, apiKey: '', apiModel: 'claude-haiku-5-5', lastFired: {}, theme: 'dark' },
  };
}

export const emptyDay = () => ({
  foods: [], water: 0, steps: null, sleep: null, weight: null, waist: null, chest: null, arm: null, thigh: null,
  energy: null, motivation: null, mood: null, deviation: '', noDeviation: false, comment: '',
  workout: { ex: {}, postponed: 0, completedAt: null, converted: null, startAt: null, endAt: null, rpe: null }, cardio: [], excuses: [],
  // Suivi quotidien (v1.1)
  scale10: true, weighTime: null, sleepQuality: null, bedAt: null, wakeAt: null, wakeups: null, wakeFatigue: null, soreness: null, recovery: null,
  waterLog: [], distance: null, belly: null, hips: null,
});

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('photos')) d.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = (store, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(store, mode); const s = t.objectStore(store); const r = fn(s);
  t.oncomplete = () => resolve(r?.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
});

// Migrations : ajoute les champs manquants sans jamais supprimer de données.
export function migrate(s) {
  const base = freshState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  for (const k of Object.keys(base.settings)) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
  const ids = new Set(s.settings.reminders.map((r) => r.id));
  for (const r of DEFAULT_REMINDERS) if (!ids.has(r.id)) {
    s.settings.reminders.push({ ...r });
    // Nouveau rappel ajouté par une mise à jour : on ne le déclenche pas « en retard » le jour même.
    const now = new Date(); const [h, mi] = r.time.split(':').map(Number);
    if (h * 60 + mi <= now.getHours() * 60 + now.getMinutes()) { s.settings.lastFired = s.settings.lastFired || {}; s.settings.lastFired[`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}:${r.id}`] = Date.now(); }
  }
  // Correction du profil (26/11/2026) : remplace d'anciennes valeurs de test (86 kg / 178 cm / 32 ans) par le vrai profil.
  if (s.profile && s.profile.weight === 86 && s.profile.height === 178) {
    s.profile = { ...s.profile, weight: 77, height: 174, age: 23, goalWeight: s.profile.goalWeight === 83 ? 74 : s.profile.goalWeight };
    // Le poids du jour 1 était recopié automatiquement depuis le profil : on corrige cette valeur de départ (le reste du journal est conservé).
    const d1 = s.days[s.profile.startDate];
    if (d1 && d1.weight === 86) d1.weight = 77;
    s.needsRecalc = true;
  }
  for (const k of Object.keys(s.days)) {
    const old = s.days[k];
    const d = { ...emptyDay(), ...old, workout: { ...emptyDay().workout, ...(old.workout || {}) } };
    // v1.1 : énergie/motivation passent de /5 à /10 ; l'eau devient un historique horodaté.
    if (!old.scale10) { if (d.energy != null) d.energy *= 2; if (d.motivation != null) d.motivation *= 2; d.scale10 = true; }
    if (!Array.isArray(old.waterLog)) d.waterLog = d.water > 0 ? [{ t: null, ml: d.water, legacy: true }] : [];
    s.days[k] = d;
  }
  s.schema = SCHEMA;
  return s;
}

export async function load() {
  let fromIdb = null; let fromLs = null;
  try { db = await openDB(); fromIdb = await tx('kv', 'readonly', (s) => s.get('state')); } catch (e) { console.warn('IDB', e); db = null; }
  try { const raw = localStorage.getItem(LS_KEY); if (raw) fromLs = JSON.parse(raw); } catch (e) { console.warn('LS', e); }
  // On garde la version la plus récente des deux copies.
  let s = fromIdb || fromLs;
  if (fromIdb && fromLs && (fromLs.savedAt || 0) > (fromIdb.savedAt || 0)) s = fromLs;
  state = migrate(s || freshState());
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
  return state;
}

export const get = () => state;
export function day(k = dateKey()) { if (!state.days[k]) state.days[k] = emptyDay(); return state.days[k]; }
export const peekDay = (k) => state.days[k] || null;

export function update(fn, { silent = false } = {}) {
  fn(state);
  scheduleSave();
  if (!silent) listeners.forEach((l) => l());
}
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }
export async function saveNow() {
  clearTimeout(saveTimer);
  if (!state) return;
  state.savedAt = Date.now();
  const snapshot = JSON.parse(JSON.stringify(state));
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch (e) { console.warn('LS save', e); }
  if (db) { try { await tx('kv', 'readwrite', (s) => s.put(snapshot, 'state')); } catch (e) { console.warn('IDB save', e); } }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', () => saveNow());
}

// ——— Photos (stockées uniquement sur l'appareil) ———
export async function addPhoto(date, blob, note = '', pose = null) {
  if (!db) throw new Error('Stockage photo indisponible');
  const id = 'ph_' + Date.now();
  await tx('photos', 'readwrite', (s) => s.put({ id, date, blob, note, pose, createdAt: Date.now() }));
  return id;
}
export async function listPhotos() {
  if (!db) return [];
  const all = await tx('photos', 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}
export async function deletePhoto(id) { if (db) await tx('photos', 'readwrite', (s) => s.delete(id)); }

// ——— Export / import ———
export function exportJSON() { return JSON.stringify({ app: '14DAYS-NO-EXCUSES', exportedAt: new Date().toISOString(), state }, null, 2); }
export async function importJSON(text) {
  const data = JSON.parse(text);
  const s = data.state || data;
  if (!s || typeof s !== 'object' || !('days' in s)) throw new Error('Fichier de sauvegarde invalide');
  state = migrate(s);
  await saveNow();
  listeners.forEach((l) => l());
}
export async function resetAll() {
  state = freshState();
  await saveNow();
  if (db) { try { await tx('photos', 'readwrite', (s) => s.clear()); } catch {} }
  listeners.forEach((l) => l());
}
