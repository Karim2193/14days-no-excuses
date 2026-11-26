// Helpers d'interface : toast, feuille modale, petits composants réutilisables.
import { esc } from './util.js';

export function toast(msg, tone = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + tone; el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 3200);
}

let onCloseCb = null;
export function sheet(html, { onClose } = {}) {
  const root = document.getElementById('sheet');
  root.innerHTML = `<div class="sheet-bg" data-act="sheet-close"></div><div class="sheet-panel" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  onCloseCb = onClose || null;
  return root.querySelector('.sheet-panel');
}
export function closeSheet() {
  const root = document.getElementById('sheet');
  root.classList.remove('open');
  setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 220);
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
}
export const sheetOpen = () => !document.getElementById('sheet').hidden;

export function confirmSheet(title, text, okLabel = 'Confirmer', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const p = sheet(`<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>
      <div class="row gap"><button class="btn ghost grow" data-x="no">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'} grow" data-x="yes">${esc(okLabel)}</button></div>`,
    { onClose: () => { if (!done) resolve(false); } });
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      done = true; resolve(b.dataset.x === 'yes'); closeSheet();
    });
  });
}

export const card = (inner, cls = '') => `<section class="card ${cls}">${inner}</section>`;
export const stat = (label, value, sub = '', cls = '') => `<div class="stat ${cls}"><div class="stat-l">${esc(label)}</div><div class="stat-v">${value}</div>${sub ? `<div class="stat-s">${sub}</div>` : ''}</div>`;
export const seg = (name, options, current) => `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" class="${v === current ? 'on' : ''}" data-act="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
export const icon = (name) => ICONS[name] || '';

const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  food: svg('<path d="M7 2v8a3 3 0 0 0 6 0V2"/><path d="M10 2v20"/><path d="M17 2c-1.5 2-2 4-2 7h4c0-3-.5-5-2-7z"/><path d="M17 9v13"/>'),
  sport: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>'),
  coach: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
  journal: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  body: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v7M8 22l4-8 4 8M6 11h12"/>'),
  report: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  swap: svg('<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>'),
  scan: svg('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  drop: svg('<path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.3 0z"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3M7 12l2-4 4 1 2 4 3 1"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
};
