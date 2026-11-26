// Corps : poids (pesées + moyenne 3 jours), mensurations, photos privées locales.
import { dateKey, esc, fmtKg, fmtDate, num, r1 } from '../util.js';
import { lineChart } from '../charts.js';
import { icon, toast, confirmSheet, sheet } from '../ui.js';
import * as store from '../store.js';
import { weightSeries, measureSeries, challengeIndex } from '../score.js';

export const state = { photos: null, urls: [], pose: 'face' };
export const MEAS = [['waist', 'Tour de taille'], ['belly', 'Tour de ventre (nombril)'], ['hips', 'Tour de hanches'], ['chest', 'Tour de poitrine'], ['arm', 'Tour de bras'], ['thigh', 'Tour de cuisse']];
export const POSES = [['face', 'Face'], ['profil', 'Profil'], ['dos', 'Dos']];

// Comparaison hebdomadaire : départ (1re mesure), fin semaine 1 (dernière mesure J1-J7), fin semaine 2 (J8-J14).
export function weeklyTable(s) {
  const rows = [['weight', 'Poids', 'kg'], ...MEAS.map(([f, l]) => { const x = l.replace('Tour de ', '').replace(' (nombril)', ''); return [f, x[0].toUpperCase() + x.slice(1), 'cm']; })];
  return rows.map(([f, l, u]) => {
    const ser = Object.keys(s.days).filter((k) => s.days[k][f] != null).sort().map((k) => ({ i: challengeIndex(s, k), v: s.days[k][f] })).filter((x) => x.i >= 1 && x.i <= 14);
    const start = f === 'weight' ? (ser.find((x) => x.i === 1)?.v ?? s.profile.weight) : ser[0]?.v ?? null;
    const w1 = ser.filter((x) => x.i <= 7).pop()?.v ?? null; const w2 = ser.filter((x) => x.i >= 8).pop()?.v ?? null;
    const last = w2 ?? w1; const diff = start != null && last != null ? r1(last - start) : null;
    return { f, l, u, start, w1, w2, diff };
  });
}

export function render() {
  const s = store.get(); const p = s.profile; const k = dateKey(); const d = s.days[k] || store.emptyDay();
  const ws = weightSeries(s).filter((x) => x.i >= 1);
  const pts = ws.map((x) => ({ x: x.i, y: x.w, label: `${fmtDate(x.k, false)} : ${x.w} kg` }));
  const trend = ws.map((x, i) => { const a = ws.slice(Math.max(0, i - 2), i + 1); return { x: x.i, y: a.reduce((t, z) => t + z.w, 0) / a.length }; });
  const xMax = Math.max(14, ...ws.map((x) => x.i));
  const first = ws[0]?.w ?? p.weight; const last = ws[ws.length - 1]?.w ?? p.weight;
  const tLast = trend[trend.length - 1]?.y ?? p.weight;
  return `<header class="topbar"><button class="iconbtn" data-act="nav" data-v="home" aria-label="Retour">${icon('back')}</button><div class="title">Corps</div><span></span></header>
  <section class="card"><div class="card-h"><h3>Poids</h3><span class="small muted">${ws.length} pesée(s)</span></div>
    <div class="grid3 kpis"><div><span>Première</span><b>${fmtKg(first)}</b></div><div><span>Dernière</span><b>${fmtKg(last)}</b></div><div><span>Moy. 3 j</span><b>${fmtKg(tLast)}</b></div></div>
    ${lineChart(pts, { xMax, target: p.goalWeight, unit: ' kg', id: 'bw', trend })}
    <div class="legend"><span class="lg line"></span>pesées <span class="lg dash"></span>moyenne 3 jours <span class="lg tgt"></span>cible</div>
    <form class="row gap-s" data-submit="body-weight"><input name="w" type="number" inputmode="decimal" step="0.1" placeholder="Poids du jour (kg)" value="${d.weight ?? ''}" class="grow"><button class="btn primary">OK</button></form>
    <p class="fine">Le poids varie de 0,5 à 1,5 kg d'un jour à l'autre (eau, sel, glucides, digestion). Fie-toi à la moyenne 3 jours et au tour de taille, pas à une pesée isolée.</p></section>
  <section class="card"><h3>Comparaison semaine par semaine</h3>
    <table class="wtable"><thead><tr><th></th><th>Départ</th><th>Sem. 1</th><th>Sem. 2</th><th>Écart</th></tr></thead><tbody>
    ${weeklyTable(s).map((r) => `<tr><td>${esc(r.l)}</td><td>${r.start ?? '—'}</td><td>${r.w1 ?? '—'}</td><td>${r.w2 ?? '—'}</td><td class="${r.diff < 0 ? 'green' : r.diff > 0 ? 'red' : ''}">${r.diff != null ? (r.diff > 0 ? '+' : '') + String(r.diff).replace('.', ',') + ' ' + r.u : '—'}</td></tr>`).join('')}</tbody></table>
    <p class="fine">Mesure-toi une fois par semaine (J1, J7, J14), le matin, au même endroit. Le tour de taille et de ventre baissent souvent avant que la balance bouge.</p></section>
  ${MEAS.map(([f, l], x) => { const ser = measureSeries(s, f).filter((z) => z.i >= 1); const fi = ser[0]?.v, la = ser[ser.length - 1]?.v;
    return `<section class="card"><div class="card-h"><h3>${l}</h3>${ser.length > 1 ? `<span class="small ${la < fi ? 'green' : 'muted'}">${la - fi > 0 ? '+' : ''}${r1(la - fi)} cm</span>` : ''}</div>
    ${ser.length ? lineChart(ser.map((z) => ({ x: z.i, y: z.v, label: `${fmtDate(z.k, false)} : ${z.v} cm` })), { xMax: Math.max(14, ...ser.map((z) => z.i)), unit: ' cm', id: 'm' + x, height: 120, yPad: 1 }) : ''}
    <form class="row gap-s" data-submit="body-meas" data-f="${f}"><input name="v" type="number" inputmode="decimal" step="0.5" placeholder="${l} aujourd'hui (cm)" value="${d[f] ?? ''}" class="grow"><button class="btn primary">OK</button></form></section>`; }).join('')}
  <section class="card"><div class="card-h"><h3>Photos de progression</h3><span class="pill">privées</span></div>
    <p class="small muted">Stockées uniquement sur ce téléphone (jamais envoyées en ligne). Même lumière, même tenue, même angle : face, profil, dos.</p>
    <div class="seg sm" id="pose-seg">${POSES.map(([v, l]) => `<button class="${state.pose === v ? 'on' : ''}" data-act="photo-pose" data-v="${v}">${l}</button>`).join('')}</div>
    <label class="btn primary block filebtn">${icon('camera')} Ajouter une photo « ${POSES.find((x) => x[0] === state.pose)[1].toLowerCase()} »<input type="file" accept="image/*" data-chg="photo-add" hidden></label>
    <div id="photo-cmp"></div>
    <div class="photos" id="photos">${state.photos == null ? '<p class="muted small">Chargement…</p>' : state.photos.length ? '' : '<p class="muted small">Aucune photo pour l\'instant.</p>'}</div></section>`;
}

export async function after(root) {
  const el = root.querySelector('#photos'); if (!el) return;
  const list = await store.listPhotos().catch(() => []);
  state.urls.forEach((u) => URL.revokeObjectURL(u)); state.urls = [];
  state.photos = list;
  const cmp = root.querySelector('#photo-cmp');
  if (!list.length) { el.innerHTML = '<p class="muted small">Aucune photo pour l\'instant.</p>'; return; }
  const urlOf = new Map(list.map((ph) => { const u = URL.createObjectURL(ph.blob); state.urls.push(u); return [ph.id, u]; }));
  // Avant / après : première et dernière photo de chaque pose, côte à côte.
  if (cmp) cmp.innerHTML = POSES.map(([v, l]) => { const ps = list.filter((ph) => (ph.pose || 'face') === v).sort((a, b) => a.createdAt - b.createdAt); if (ps.length < 2) return '';
    const a = ps[0], b = ps[ps.length - 1];
    return `<div class="cmp"><h4>${l} : avant / maintenant</h4><div class="cmp-row"><figure><img src="${urlOf.get(a.id)}" alt="${l} ${esc(a.date)}" data-act="photo-view"><figcaption>${fmtDate(a.date, false)}</figcaption></figure><figure><img src="${urlOf.get(b.id)}" alt="${l} ${esc(b.date)}" data-act="photo-view"><figcaption>${fmtDate(b.date, false)}</figcaption></figure></div></div>`; }).join('');
  el.innerHTML = list.map((ph) => { const u = urlOf.get(ph.id); return `<figure><img src="${u}" alt="Photo du ${esc(ph.date)}" loading="lazy" data-act="photo-view" data-id="${ph.id}"><figcaption>${fmtDate(ph.date, false)} · ${POSES.find((x) => x[0] === (ph.pose || 'face'))?.[1] || ''}<button class="iconbtn sm" data-act="photo-del" data-id="${ph.id}" aria-label="Supprimer">${icon('trash')}</button></figcaption></figure>`; }).join('');
}

// Réduit la photo (max 1280 px) pour économiser le stockage du téléphone.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } catch { return file; }
}

export const actions = {
  'body-weight'(form) { const v = num(form.w.value); if (v == null || v < 30 || v > 300) { toast('Poids invalide', 'bad'); return; } store.update(() => { const d = store.day(); d.weight = v; if (!d.weighTime) d.weighTime = new Date().toTimeString().slice(0, 5); }); toast('Pesée enregistrée', 'good'); },
  'body-meas'(form) { const v = num(form.v.value); if (v == null || v < 10 || v > 250) { toast('Mesure invalide', 'bad'); return; } store.update(() => { store.day()[form.dataset.f] = v; }); toast('Mesure enregistrée', 'good'); },
  async 'photo-add'(el) {
    const file = el.files?.[0]; if (!file) return false;
    try { const blob = await shrink(file); await store.addPhoto(dateKey(), blob, '', state.pose); toast('Photo enregistrée sur l\'appareil', 'good'); state.photos = null; store.update(() => {}); } catch (e) { toast('Impossible d\'enregistrer la photo', 'bad'); }
    return false;
  },
  async 'photo-del'(el) { if (await confirmSheet('Supprimer la photo ?', 'Elle sera définitivement effacée de cet appareil.', 'Supprimer', true)) { await store.deletePhoto(el.dataset.id); store.update(() => {}); } return false; },
  'photo-pose'(el) { state.pose = el.dataset.v; },
  'photo-view'(el) { sheet(`<img src="${el.src}" class="photo-full" alt=""><button class="btn ghost block" data-act="sheet-close">Fermer</button>`); return false; },
};
