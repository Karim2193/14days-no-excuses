// Service worker : app 100 % hors ligne (cache des fichiers) + clic sur notification.
// IMPORTANT : incrémenter VERSION à chaque déploiement. Les données (IndexedDB) ne sont jamais touchées.
const VERSION = 'ndne-v1.1.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/util.js', './js/tracking.js', './js/foods.js', './js/nutrition.js', './js/meals.js', './js/training.js', './js/score.js',
  './js/coach.js', './js/store.js', './js/charts.js', './js/notify.js', './js/ui.js', './js/off.js',
  './js/views/home.js', './js/views/nutrition.js', './js/views/sport.js', './js/views/coach.js', './js/views/suivi.js', './js/views/stats.js',
  './js/views/body.js', './js/views/report.js', './js/views/settings.js', './js/views/onboarding.js',
  './js/vendor/zxing.min.js', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API externes : réseau direct
  // Réseau d'abord pour la page (mises à jour rapides), cache en secours ; cache d'abord pour le reste.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); } return r; })));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./index.html#home');
  }));
});
