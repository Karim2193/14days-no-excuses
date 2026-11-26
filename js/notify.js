// Rappels : ce qui fonctionne réellement sur iPhone.
// 1) Notifications système quand l'app est ouverte ou vient d'être ouverte (iOS 16.4+, app installée sur l'écran d'accueil).
// 2) Rappels manqués affichés à l'ouverture.
// 3) Export calendrier .ics : alarmes natives iOS à l'heure exacte, même app fermée (alternative fiable sans serveur).
import { dateKey, hhmmToMin, nowMinutes, addDays, pad } from './util.js';
import { reminderText, reminderShouldFire } from './coach.js';
import * as store from './store.js';
import { programDay, isTrainingType } from './training.js';

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const notifSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const permission = () => (notifSupported() ? Notification.permission : 'unsupported');

export async function requestPermission() {
  if (!notifSupported()) return 'unsupported';
  const p = await Notification.requestPermission();
  store.update((s) => { s.settings.notif = p === 'granted'; });
  return p;
}

export async function show(title, body, tag) {
  if (permission() !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true });
    return true;
  } catch (e) {
    try { new Notification(title, { body, tag }); return true; } catch { return false; }
  }
}

// Vérifie les rappels dus aujourd'hui ; renvoie ceux qui viennent de se déclencher.
export function check(onFire, now = new Date()) {
  const s = store.get();
  if (!s.profile) return [];
  const k = dateKey(now);
  const m = nowMinutes(now);
  const fired = [];
  for (const r of s.settings.reminders) {
    const due = hhmmToMin(r.todayAt?.k === k ? r.todayAt.t : r.time);
    const key = `${k}:${r.id}`;
    if (m < due || s.settings.lastFired[key]) continue;
    if (!reminderShouldFire(s, r, now)) continue;
    const late = m - due > 20; // ouvert après l'heure → rappel « manqué » affiché dans l'app seulement
    const body = reminderText(s, r, now);
    fired.push({ r, body, late });
    store.update((st) => { st.settings.lastFired[key] = Date.now(); }, { silent: true });
    if (!late) show(`14 DAYS — ${r.label}`, body, r.id);
  }
  // Nettoyage des anciennes clés
  const keep = addDays(k, -3);
  store.update((st) => { for (const key of Object.keys(st.settings.lastFired)) if (key.slice(0, 10) < keep) delete st.settings.lastFired[key]; }, { silent: true });
  if (fired.length && onFire) onFire(fired);
  return fired;
}

let timer = null;
export function start(onFire) {
  stop();
  check(onFire);
  timer = setInterval(() => check(onFire), 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(onFire); });
}
export function stop() { if (timer) clearInterval(timer); timer = null; }

// ——— Calendrier .ics ———
const icsEsc = (t) => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
export function buildICS(s) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//14DAYS NO EXCUSES//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:14 DAYS — NO EXCUSES'];
  const now = new Date();
  const today = dateKey();
  for (let i = 1; i <= 14; i++) {
    const k = addDays(s.profile.startDate, i - 1);
    if (k < today) continue;
    const prog = programDay(s.profile, i);
    for (const r of s.settings.reminders) {
      if (!r.on) continue;
      if (r.conditional && !isTrainingType(prog.type)) continue;
      const [y, mo, d] = k.split('-').map(Number);
      const [h, mi] = r.time.split(':').map(Number);
      const start = new Date(y, mo - 1, d, h, mi);
      if (start < now) continue;
      const end = new Date(start.getTime() + 10 * 60000);
      let desc = r.text;
      if (r.id === 'sport') desc = isTrainingType(prog.type) ? `${prog.title} (~${prog.duration} min). ${r.text}` : 'Jour de récupération : marche + étirements.';
      if (r.id === 'seance_nv') desc = 'Si ta séance n\'est pas validée dans l\'app : tu y vas maintenant. Version express si besoin.';
      lines.push('BEGIN:VEVENT', `UID:${k}-${r.id}@14days-no-excuses`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
        `SUMMARY:${icsEsc(`J${i}/14 · ${r.label}`)}`, `DESCRIPTION:${icsEsc(desc)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(r.label)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
