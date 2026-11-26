// Nutrition : journal alimentaire + calculateur, programme 14 jours, courses, batch cooking, recettes.
import { dateKey, addDays, esc, r0, uid, norm, num, fmtNum, fmtDate } from '../util.js';
import { FOODS, foodLabel, macrosFor } from '../foods.js';
import { MEALS, LOG_MEALS, MEAL_LABEL, getFood, mealTotals, replaceInMeal, alternativesFor, buildMeal, cookedHint, shoppingList, batchPrep, setExtraFoods } from '../meals.js';
import { bar, ring } from '../charts.js';
import { icon, sheet, closeSheet, toast, seg, confirmSheet } from '../ui.js';
import * as store from '../store.js';
import { totals, challengeIndex, keyForIndex } from '../score.js';
import { deviationReply } from '../coach.js';
import { nowHHMM } from '../tracking.js';
import { lookupBarcode, searchOFF, scanBarcode } from '../off.js';

export const state = { tab: 'jour', date: null, planDay: null, week: 1, prepFrom: null, prepN: 3 };

const entryFrom = (food, g, meal, at = null) => {
  const per = { k: food.k, p: food.p, c: food.c, f: food.f, fi: food.fi || 0 };
  return { uid: uid(), id: food.id || null, name: foodLabel(food), g, per, kcal: (per.k * g) / 100, p: (per.p * g) / 100, c: (per.c * g) / 100, f: (per.f * g) / 100, fi: (per.fi * g) / 100, meal, t: Date.now(), at };
};
const recompute = (e) => { e.kcal = (e.per.k * e.g) / 100; e.p = (e.per.p * e.g) / 100; e.c = (e.per.c * e.g) / 100; e.f = (e.per.f * e.g) / 100; e.fi = ((e.per.fi || 0) * e.g) / 100; };
const atOf = (e) => e.at || (e.t && !e.copied ? new Date(e.t).toTimeString().slice(0, 5) : '');
const macroPct = (t) => { const kc = t.p * 4 + t.c * 4 + t.f * 9; return kc ? { p: Math.round((t.p * 400) / kc), c: Math.round((t.c * 400) / kc), f: Math.round((t.f * 900) / kc) } : { p: 0, c: 0, f: 0 }; };
const macroLine = (m) => `<span class="mac"><b>${r0(m.kcal)}</b> kcal · P ${r0(m.p)} · G ${r0(m.c)} · L ${r0(m.f)}</span>`;

export function allFoods() {
  const s = store.get();
  return [...s.customFoods, ...Object.values(s.offCache || {}), ...FOODS];
}
export function syncExtra() { const s = store.get(); setExtraFoods([...s.customFoods, ...Object.values(s.offCache || {})]); }

export function render() {
  const s = store.get();
  const today = dateKey();
  if (!state.date) state.date = today;
  const ci = Math.min(14, Math.max(1, challengeIndex(s, today)));
  if (!state.planDay) state.planDay = ci;
  syncExtra();
  const tabs = seg('nut-tab', [['jour', 'Journal'], ['plan', 'Programme'], ['courses', 'Courses'], ['prep', 'Batch'], ['recettes', 'Recettes']], state.tab);
  let body = '';
  if (state.tab === 'jour') body = renderLog(s);
  else if (state.tab === 'plan') body = renderPlan(s);
  else if (state.tab === 'courses') body = renderShopping(s);
  else if (state.tab === 'prep') body = renderPrep(s);
  else body = renderRecipes(s);
  return `<header class="topbar"><div class="title">Nutrition</div></header>${tabs}${body}`;
}

// ——— Journal alimentaire / calculateur ———
function renderLog(s) {
  const k = state.date; const d = s.days[k] || store.emptyDay();
  const T = s.targets; const t = totals(d);
  const isToday = k === dateKey();
  const rem = T.kcal - t.kcal;
  const meals = LOG_MEALS.map((m) => {
    const items = d.foods.filter((f) => f.meal === m.key).sort((a, b) => (atOf(a) || '99').localeCompare(atOf(b) || '99'));
    const mt = items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
    return `<section class="card meal">
      <div class="card-h"><h3>${m.icon} ${m.label}</h3><span class="small muted">${r0(mt.kcal)} kcal</span></div>
      ${items.length ? `<ul class="foods">${items.map((e) => `<li>
        <button class="food-main" data-act="edit-entry" data-u="${e.uid}"><span class="fn">${esc(e.name)}</span><span class="fq">${atOf(e) ? atOf(e) + ' · ' : ''}${r0(e.g)} g · ${r0(e.kcal)} kcal · P ${r0(e.p)} G ${r0(e.c)} L ${r0(e.f)}${e.fi ? ' · fibres ' + r0(e.fi) : ''}</span></button>
        <button class="iconbtn sm" data-act="swap-entry" data-u="${e.uid}" aria-label="Remplacer">${icon('swap')}</button>
        <button class="iconbtn sm" data-act="del-entry" data-u="${e.uid}" aria-label="Supprimer">${icon('trash')}</button></li>`).join('')}</ul>` : '<p class="muted small empty">Rien de noté.</p>'}
      <div class="row gap-s wrap">
        <button class="btn sm primary" data-act="add-food" data-meal="${m.key}">${icon('plus')} Ajouter</button>
        ${m.key !== 'x' ? `<button class="btn sm ghost" data-act="eat-plan" data-meal="${m.key}">Repas du plan</button>` : ''}
        <button class="btn sm ghost" data-act="copy-from" data-meal="${m.key}">${icon('copy')} D'un autre jour</button>
        ${items.length ? `<button class="btn sm ghost" data-act="dup-meal" data-meal="${m.key}">Dupliquer</button><button class="btn sm ghost" data-act="save-recipe-from" data-meal="${m.key}">Enregistrer</button>` : ''}
      </div></section>`;
  }).join('');
  return `
  <div class="datebar"><button class="iconbtn" data-act="nut-date" data-v="-1" aria-label="Jour précédent">${icon('back')}</button>
    <div><b>${isToday ? 'Aujourd\'hui' : fmtDate(k)}</b><small>Jour ${challengeIndex(s, k)}/14</small></div>
    <button class="iconbtn flip" data-act="nut-date" data-v="1" aria-label="Jour suivant" ${isToday ? 'disabled' : ''}>${icon('back')}</button></div>
  <section class="card sticky-sum">
    <div class="row gap center-y">${ring(Math.min(1, t.kcal / T.kcal), { size: 92, stroke: 9, label: fmtNum(t.kcal), sub: `/ ${fmtNum(T.kcal)}`, color: t.kcal > T.kcal * 1.1 ? 'var(--red)' : 'var(--green)' })}
      <div class="grow"><div class="kcal-left ${rem < 0 ? 'red' : ''}"><b>${fmtNum(Math.abs(rem))}</b> kcal ${rem >= 0 ? 'restantes' : 'au-dessus'}</div>
      ${bar(t.p, T.protein, { label: 'Protéines', cls: 'p' })}${bar(t.c, T.carbs, { label: 'Glucides', cls: 'c' })}${bar(t.f, T.fat, { label: 'Lipides', cls: 'f' })}${bar(t.fi, 30, { label: 'Fibres', cls: 'fi' })}</div></div>
    ${t.kcal > 0 ? (() => { const pc = macroPct(t); const tp = macroPct({ p: T.protein, c: T.carbs, f: T.fat }); return `<div class="macro-split" aria-label="Répartition des calories"><div class="ms-bar"><span class="p" style="width:${pc.p}%"></span><span class="c" style="width:${pc.c}%"></span><span class="f" style="width:${pc.f}%"></span></div>
      <div class="ms-leg"><span><i class="p"></i>Prot. ${pc.p} %</span><span><i class="c"></i>Gluc. ${pc.c} %</span><span><i class="f"></i>Lip. ${pc.f} %</span><small>cible ${tp.p} / ${tp.c} / ${tp.f} %</small></div></div>`; })() : ''}
    <p class="fine">Les calories du sport ne sont pas ajoutées à ton budget : ce sont des estimations, et les remanger annulerait ton déficit.</p>
  </section>
  ${meals}
  <section class="card"><div class="card-h"><h3>Historique</h3></div>${renderHistory(s)}</section>
  <button class="btn ghost block" data-act="deviation">Signaler un écart alimentaire</button>`;
}

function renderHistory(s) {
  const keys = Object.keys(s.days).filter((k) => s.days[k].foods.length).sort().reverse().slice(0, 10);
  if (!keys.length) return '<p class="muted small">Ton historique apparaîtra ici.</p>';
  return `<ul class="hist">${keys.map((k) => { const t = totals(s.days[k]); return `<li><button data-act="nut-goto" data-k="${k}"><span>${fmtDate(k)}</span><span>${r0(t.kcal)} kcal · P ${r0(t.p)} g</span></button></li>`; }).join('')}</ul>`;
}

// ——— Sélecteur d'aliment réutilisable ———
export function openFoodPicker({ title = 'Ajouter un aliment', meal = null, onPick }) {
  const s = store.get();
  let mealSel = meal || guessMeal();
  const recent = (s.recent || []).map((id) => getFood(id)).filter(Boolean).slice(0, 8);
  const p = sheet(`<h3>${esc(title)}</h3>
    ${meal !== false ? `<div class="seg sm" id="fp-meal">${LOG_MEALS.map((m) => `<button type="button" data-m="${m.key}" class="${m.key === mealSel ? 'on' : ''}">${m.label}</button>`).join('')}</div>` : ''}
    <div class="seg sm" id="fp-mode"><button type="button" data-mode="search" class="on">${icon('search')} Rechercher</button><button type="button" data-mode="scan">${icon('scan')} Code-barres</button><button type="button" data-mode="manual">Manuel</button></div>
    <div id="fp-body"></div>`);
  const bodyEl = p.querySelector('#fp-body');
  p.querySelector('#fp-meal')?.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mealSel = b.dataset.m; p.querySelectorAll('#fp-meal button').forEach((x) => x.classList.toggle('on', x === b)); });
  p.querySelector('#fp-mode').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; p.querySelectorAll('#fp-mode button').forEach((x) => x.classList.toggle('on', x === b)); mode(b.dataset.mode); });
  const choose = (food) => quantityStep(food);
  function mode(m) {
    if (m === 'search') {
      bodyEl.innerHTML = `<input id="fp-q" type="search" placeholder="poulet, riz, skyr, pizza…" autocomplete="off" enterkeyhint="search">
        <div id="fp-res" class="results-list"></div>
        <button type="button" class="btn ghost block sm" id="fp-off">Chercher aussi en ligne (Open Food Facts)</button>`;
      const q = bodyEl.querySelector('#fp-q'); const res = bodyEl.querySelector('#fp-res');
      const list = (arr, label = '') => (arr.length ? (label ? `<div class="list-label">${label}</div>` : '') + arr.map((f) => `<button type="button" class="res" data-id="${esc(f.id)}"><span>${esc(foodLabel(f))}${f.brand ? ` <small>${esc(f.brand)}</small>` : ''}</span><small>${r0(f.k)} kcal · P ${f.p} · G ${f.c} · L ${f.f} /100 g</small></button>`).join('') : '');
      const doSearch = () => {
        const v = norm(q.value);
        if (!v) { res.innerHTML = list(recent, 'Récents') || '<p class="muted small">Tape le nom d\'un aliment.</p>'; return; }
        const words = v.split(/\s+/);
        const hits = allFoods().filter((f) => words.every((w) => norm(foodLabel(f) + ' ' + (f.brand || '')).includes(w))).slice(0, 40);
        res.innerHTML = list(hits) || '<p class="muted small">Aucun résultat local. Essaie la recherche en ligne ou l\'ajout manuel.</p>';
      };
      q.addEventListener('input', doSearch); doSearch();
      res.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) choose(getFood(b.dataset.id) || allFoods().find((f) => f.id === b.dataset.id)); });
      bodyEl.querySelector('#fp-off').addEventListener('click', async (e) => {
        const term = q.value.trim(); if (term.length < 2) { toast('Tape au moins 2 lettres', 'bad'); return; }
        e.target.disabled = true; e.target.textContent = 'Recherche en ligne…';
        try {
          const found = await searchOFF(term);
          store.update((st) => { for (const f of found) st.offCache[f.id] = f; }, { silent: true }); syncExtra();
          res.innerHTML = list(found, 'Open Food Facts') || '<p class="muted small">Rien trouvé en ligne.</p>';
        } catch (err) { toast('Recherche en ligne indisponible (réseau ?)', 'bad'); }
        e.target.disabled = false; e.target.textContent = 'Chercher aussi en ligne (Open Food Facts)';
      });
      setTimeout(() => q.focus(), 250);
    } else if (m === 'scan') {
      bodyEl.innerHTML = `<div class="scan-box"><video id="fp-video" playsinline muted></video><div class="scan-line"></div></div>
        <p class="muted small" id="fp-scan-msg">Autorise la caméra, puis vise le code-barres.</p>
        <form id="fp-code" class="row gap-s"><input name="code" inputmode="numeric" placeholder="ou tape le code (EAN)" class="grow"><button class="btn sm primary">OK</button></form>`;
      const msg = bodyEl.querySelector('#fp-scan-msg');
      const handle = async (code) => {
        msg.textContent = `Code ${code} : recherche…`;
        try {
          const f = await lookupBarcode(code);
          if (!f) { msg.textContent = 'Produit introuvable dans Open Food Facts. Utilise l\'ajout manuel.'; return; }
          store.update((st) => { st.offCache[f.id] = f; }, { silent: true }); syncExtra();
          stopScan?.(); choose(f);
        } catch { msg.textContent = 'Connexion impossible à Open Food Facts. Réessaie ou ajoute manuellement.'; }
      };
      let stopScan = null;
      scanBarcode(bodyEl.querySelector('#fp-video'), handle).then((stop) => { stopScan = stop; }).catch((err) => { msg.textContent = 'Caméra indisponible (' + err.message + '). Tape le code à la main.'; });
      bodyEl.querySelector('#fp-code').addEventListener('submit', (e) => { e.preventDefault(); const c = String(new FormData(e.target).get('code') || '').replace(/\D/g, ''); if (c.length >= 8) handle(c); else toast('Code invalide', 'bad'); });
      cleanupScan = () => stopScan?.();
    } else {
      bodyEl.innerHTML = `<form id="fp-man" class="form">
        <label>Nom<input name="n" required placeholder="ex : Wrap maison"></label>
        <div class="seg sm" id="fp-basis"><button type="button" data-b="100" class="on">Valeurs pour 100 g</button><button type="button" data-b="tot">Valeurs totales</button></div>
        <div class="grid2"><label>Quantité (g)<input name="g" type="number" inputmode="decimal" value="100" required></label><label>Calories<input name="k" type="number" inputmode="decimal" required></label>
        <label>Protéines (g)<input name="p" type="number" inputmode="decimal" step="0.1" value="0"></label><label>Glucides (g)<input name="c" type="number" inputmode="decimal" step="0.1" value="0"></label>
        <label>Lipides (g)<input name="f" type="number" inputmode="decimal" step="0.1" value="0"></label><label>Fibres (g)<input name="fi" type="number" inputmode="decimal" step="0.1" value="0"></label></div>
        <label class="checkline"><input type="checkbox" name="save" checked> Enregistrer dans mes aliments</label>
        <button class="btn primary block">Ajouter</button></form>`;
      let basis = '100';
      bodyEl.querySelector('#fp-basis').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (!b) return; basis = b.dataset.b; bodyEl.querySelectorAll('#fp-basis button').forEach((x) => x.classList.toggle('on', x === b)); });
      bodyEl.querySelector('#fp-man').addEventListener('submit', (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        const g = num(fd.get('g')); const k = num(fd.get('k'));
        if (!g || g <= 0 || k == null || k < 0) { toast('Quantité et calories obligatoires', 'bad'); return; }
        const factor = basis === '100' ? 1 : 100 / g;
        const food = { id: 'c_' + uid(), n: String(fd.get('n')).trim() || 'Aliment perso', cat: 'other', k: k * factor, p: (num(fd.get('p')) || 0) * factor, c: (num(fd.get('c')) || 0) * factor, f: (num(fd.get('f')) || 0) * factor, fi: (num(fd.get('fi')) || 0) * factor, tags: [], custom: true };
        if (fd.get('save')) { store.update((st) => { st.customFoods.push(food); }, { silent: true }); syncExtra(); }
        finish(food, g);
      });
    }
  }
  let cleanupScan = null;
  function quantityStep(food) {
    cleanupScan?.();
    const unit = food.unit;
    const defG = unit ? unit.g : food.cat === 'fat' ? 10 : 100;
    bodyEl.innerHTML = `<div class="qty">
      <div class="qty-name">${esc(foodLabel(food))}${food.brand ? ` <small>${esc(food.brand)}</small>` : ''}</div>
      <div class="small muted">${r0(food.k)} kcal · P ${food.p} · G ${food.c} · L ${food.f} pour 100 g${food.state === 'cru' ? ' · valeurs CRUES' : food.state === 'cuit' ? ' · valeurs CUITES' : ''}</div>
      <label>Quantité (g)<input id="fp-g" type="number" inputmode="decimal" value="${defG}" min="1"></label>
      <div class="row gap-s wrap">${[50, 100, 150, 200].map((g) => `<button type="button" class="chipbtn" data-g="${g}">${g} g</button>`).join('')}${unit ? `<button type="button" class="chipbtn" data-g="${unit.g}">1 ${esc(unit.label)}</button><button type="button" class="chipbtn" data-g="${unit.g * 2}">2 ${esc(unit.label)}s</button>` : ''}</div>
      <div id="fp-prev" class="prev"></div>
      <button type="button" class="btn primary block" id="fp-ok">Ajouter</button>
      <button type="button" class="btn ghost block sm" id="fp-back">Retour</button></div>`;
    const gi = bodyEl.querySelector('#fp-g'); const prev = bodyEl.querySelector('#fp-prev');
    const upd = () => { const g = num(gi.value) || 0; const m = macrosFor(food, g); prev.innerHTML = `<b>${r0(m.kcal)} kcal</b><span>P ${r0(m.p)} g</span><span>G ${r0(m.c)} g</span><span>L ${r0(m.f)} g</span>`; };
    gi.addEventListener('input', upd); upd();
    bodyEl.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { gi.value = b.dataset.g; upd(); }));
    bodyEl.querySelector('#fp-ok').addEventListener('click', () => { const g = num(gi.value); if (!g || g <= 0) { toast('Quantité invalide', 'bad'); return; } finish(food, g); });
    bodyEl.querySelector('#fp-back').addEventListener('click', () => mode('search'));
  }
  function finish(food, g) {
    cleanupScan?.();
    if (food.id && !food.id.startsWith('c_tmp')) store.update((st) => { st.recent = [food.id, ...(st.recent || []).filter((x) => x !== food.id)].slice(0, 20); }, { silent: true });
    onPick(food, g, mealSel);
  }
  mode('search');
}
function guessMeal() { const h = new Date().getHours(); return h < 11 ? 'b' : h < 15 ? 'l' : h < 18 ? 's' : 'd'; }

function addEntry(food, g, meal, k = state.date || dateKey()) {
  store.update(() => { store.day(k).foods.push(entryFrom(food, g, meal, k === dateKey() ? nowHHMM() : null)); });
}

// ——— Programme alimentaire ———
function renderPlan(s) {
  const dn = state.planDay; const plan = s.plan[dn];
  const T = s.targets;
  if (!plan) return '<p class="muted">Plan introuvable : régénère-le dans Réglages.</p>';
  const tot = MEALS.reduce((a, m) => { const t = mealTotals(plan[m.key].items); return { kcal: a.kcal + t.kcal, p: a.p + t.p, c: a.c + t.c, f: a.f + t.f }; }, { kcal: 0, p: 0, c: 0, f: 0 });
  const dayChips = Array.from({ length: 14 }, (_, x) => `<button class="${x + 1 === dn ? 'on' : ''}" data-act="plan-day" data-v="${x + 1}">J${x + 1}</button>`).join('');
  return `<div class="hscroll days">${dayChips}</div>
  <section class="card"><div class="card-h"><h3>Jour ${dn} · ${fmtDate(keyForIndex(s, dn))}</h3></div>
    <div class="grid4 kpis"><div><span>kcal</span><b>${r0(tot.kcal)}</b><small>/${T.kcal}</small></div><div><span>Prot.</span><b>${r0(tot.p)}</b><small>/${T.protein} g</small></div><div><span>Gluc.</span><b>${r0(tot.c)}</b><small>/${T.carbs} g</small></div><div><span>Lip.</span><b>${r0(tot.f)}</b><small>/${T.fat} g</small></div></div>
    <p class="fine">Quantités pesées CRUES pour viandes, poissons et féculents secs (équivalent cuit indiqué).</p></section>
  ${MEALS.map((m) => { const meal = plan[m.key]; const mt = mealTotals(meal.items); return `<section class="card meal-plan">
    <div class="card-h"><div><small class="muted">${m.icon} ${m.label}</small><h3>${esc(meal.name)}</h3></div></div>
    <div class="small">${macroLine(mt)}</div>
    <ul class="ingr">${meal.items.map((it) => { const f = getFood(it.id); return `<li><span><b>${r0(it.g)} g</b> ${esc(f ? f.n : it.id)}${f?.state ? ` <small>(${f.state})</small>` : ''}${f?.unit && ['oeuf', 'pain_complet', 'galette_riz', 'banane', 'pomme', 'kiwi', 'orange'].includes(f.id) ? ` <small>≈ ${Math.round(it.g / f.unit.g * 10) / 10} ${esc(f.unit.label)}</small>` : ''}${cookedHint(it) ? ` <small class="green">${cookedHint(it)}</small>` : ''}</span>
      <button class="iconbtn sm" data-act="plan-swap" data-meal="${m.key}" data-role="${it.role}" aria-label="Remplacer">${icon('swap')}</button></li>`; }).join('')}</ul>
    <details><summary>Préparation</summary><ol class="steps">${meal.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
    <div class="row gap-s wrap"><button class="btn sm primary" data-act="plan-eat" data-meal="${m.key}">J'ai mangé ce repas</button><button class="btn sm ghost" data-act="plan-reroll" data-meal="${m.key}">Autre repas</button></div>
  </section>`; }).join('')}`;
}

function renderShopping(s) {
  const w = state.week; const from = w === 1 ? 1 : 8; const to = w === 1 ? 7 : 14;
  const sl = shoppingList(s.plan, from, to);
  const checked = s.shopping[w] || {};
  const CAT = { prot: 'Viandes, poissons, protéines', dairy: 'Produits laitiers', carb: 'Féculents', fruit: 'Fruits', veg: 'Légumes', fat: 'Matières grasses & oléagineux', other: 'Divers' };
  const groups = {};
  for (const r of sl.rows) (groups[r.f.cat] = groups[r.f.cat] || []).push(r);
  return `${seg('shop-week', [['1', 'Semaine 1 (J1-J7)'], ['2', 'Semaine 2 (J8-J14)']], String(w))}
  <section class="card"><div class="row between"><div><b>${sl.rows.length} articles</b><div class="small muted">${Object.keys(checked).filter((k) => checked[k]).length} cochés</div></div><div class="price"><b>≈ ${sl.total.toFixed(0)} €</b><small>budget estimatif</small></div></div>
  <p class="fine">Prix moyens indicatifs en grande surface (€/kg), à titre d'estimation : ils varient selon les magasins et les marques.</p></section>
  ${Object.keys(CAT).filter((c) => groups[c]).map((c) => `<section class="card"><h3>${CAT[c]}</h3><ul class="shop">${groups[c].map((r) => `<li><label class="${checked[r.id] ? 'done' : ''}"><input type="checkbox" data-chg="shop-check" data-id="${r.id}" ${checked[r.id] ? 'checked' : ''}>
    <span class="grow">${esc(r.f.n)}${r.f.state === 'cru' ? ' <small>(cru)</small>' : ''}</span><b>${r.g >= 1000 ? (r.g / 1000).toFixed(2).replace('.', ',') + ' kg' : r0(r.g) + ' g'}</b>${r.f.unit && ['oeuf', 'banane', 'pomme', 'kiwi', 'orange'].includes(r.id) ? `<small> ≈ ${Math.ceil(r.g / r.f.unit.g)}</small>` : ''}<small class="muted"> ${r.cost ? r.cost.toFixed(2).replace('.', ',') + ' €' : ''}</small></label></li>`).join('')}</ul></section>`).join('')}
  <button class="btn ghost block" data-act="shop-share">Partager / copier la liste</button>`;
}

function renderPrep(s) {
  const ci = Math.min(14, Math.max(1, challengeIndex(s)));
  if (!state.prepFrom) state.prepFrom = ci;
  const list = batchPrep(s.plan, state.prepFrom, state.prepN);
  const prot = list.filter((x) => x.f.cat === 'prot'); const carb = list.filter((x) => x.f.cat === 'carb'); const veg = list.filter((x) => x.f.cat === 'veg');
  const row = (x) => `<li><span>${esc(x.f.n)}</span><b>${r0(x.g)} g ${x.f.state === 'cru' ? 'cru' : ''}</b>${x.f.cook && x.f.state === 'cru' ? `<small class="green">→ ≈ ${r0(x.g * x.f.cook)} g cuit</small>` : ''}<small class="muted">${x.n} portion(s)</small></li>`;
  return `<section class="card"><h3>Préparer à l'avance (batch cooking)</h3>
    <p class="small muted">Cuisine en une fois les déjeuners et dîners de plusieurs jours. Conservation : 3 jours au réfrigérateur dans des boîtes hermétiques (4 jours max pour les viandes cuites, poisson plutôt à J+2).</p>
    <div class="grid2"><label>À partir du jour<select data-chg="prep-from">${Array.from({ length: 14 }, (_, x) => `<option value="${x + 1}" ${x + 1 === state.prepFrom ? 'selected' : ''}>J${x + 1}</option>`).join('')}</select></label>
    <label>Nombre de jours<select data-chg="prep-n">${[2, 3, 4].map((n) => `<option ${n === state.prepN ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div></section>
  <section class="card"><h3>Protéines</h3><ul class="prep">${prot.map(row).join('') || '<li class="muted">—</li>'}</ul></section>
  <section class="card"><h3>Féculents</h3><ul class="prep">${carb.map(row).join('') || '<li class="muted">—</li>'}</ul></section>
  <section class="card"><h3>Légumes</h3><ul class="prep">${veg.map(row).join('') || '<li class="muted">—</li>'}</ul></section>
  <section class="card"><h3>Méthode</h3><ol class="steps"><li>Lance tous les féculents en même temps (riz/quinoa en casserole, patate douce au four).</li><li>Cuis les protéines par lots, assaisonne à part pour varier.</li><li>Légumes à la vapeur 6-8 min : ils restent fermes au réchauffage.</li><li>Pèse chaque portion cuite dans sa boîte et étiquette « J? déj / dîner ».</li><li>Ajoute l'huile ou l'avocat au moment de manger.</li></ol></section>`;
}

function renderRecipes(s) {
  return `<button class="btn primary block" data-act="recipe-new">${icon('plus')} Créer une recette</button>
  ${s.recipes.length ? s.recipes.map((r) => { const t = r.items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 }); return `<section class="card">
    <div class="card-h"><h3>${esc(r.name)}</h3><button class="iconbtn sm" data-act="recipe-del" data-id="${r.id}" aria-label="Supprimer">${icon('trash')}</button></div>
    <div class="small">${macroLine(t)}</div>
    <ul class="ingr">${r.items.map((e) => `<li><span><b>${r0(e.g)} g</b> ${esc(e.name)}</span></li>`).join('')}</ul>
    ${r.steps ? `<details><summary>Préparation</summary><p class="small">${esc(r.steps).replace(/\n/g, '<br>')}</p></details>` : ''}
    <button class="btn sm primary" data-act="recipe-eat" data-id="${r.id}">Ajouter à aujourd'hui</button></section>`; }).join('') : '<p class="muted center">Aucune recette. Crée-en une, ou enregistre un repas depuis le journal.</p>'}`;
}

function recipeEditor(initial = { name: '', items: [], steps: '' }) {
  const draft = JSON.parse(JSON.stringify(initial));
  const draw = () => {
    const t = draft.items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
    const p = sheet(`<h3>Recette</h3><form id="rc" class="form"><label>Nom<input name="name" value="${esc(draft.name)}" required placeholder="ex : Wrap poulet maison"></label>
      <ul class="ingr">${draft.items.map((e, i) => `<li><span><b>${r0(e.g)} g</b> ${esc(e.name)}</span><button type="button" class="iconbtn sm" data-rm="${i}">${icon('x')}</button></li>`).join('') || '<li class="muted">Aucun ingrédient</li>'}</ul>
      <div class="small">${macroLine(t)}</div>
      <button type="button" class="btn ghost block sm" id="rc-add">${icon('plus')} Ajouter un ingrédient</button>
      <label>Préparation<textarea name="steps" rows="3">${esc(draft.steps)}</textarea></label>
      <button class="btn primary block">Enregistrer la recette</button></form>`);
    const form = p.querySelector('#rc');
    const keep = () => { draft.name = form.name.value; draft.steps = form.steps.value; };
    p.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { keep(); draft.items.splice(+b.dataset.rm, 1); draw(); }));
    p.querySelector('#rc-add').addEventListener('click', () => { keep(); openFoodPicker({ title: 'Ingrédient', meal: false, onPick: (food, g) => { draft.items.push(entryFrom(food, g, null)); draw(); } }); });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); keep();
      if (!draft.name.trim() || !draft.items.length) { toast('Nom et au moins un ingrédient', 'bad'); return; }
      store.update((st) => { st.recipes.push({ id: 'r_' + uid(), name: draft.name.trim(), items: draft.items, steps: draft.steps }); });
      closeSheet(); toast('Recette enregistrée', 'good');
    });
  };
  draw();
}

const findEntry = (u) => { const d = store.day(state.date); return d.foods.find((e) => e.uid === u); };

export const actions = {
  'nut-tab'(el) { state.tab = el.dataset.v; },
  'nut-date'(el) { const n = addDays(state.date, Number(el.dataset.v)); if (n <= dateKey()) state.date = n; },
  'nut-goto'(el) { state.date = el.dataset.k; window.scrollTo(0, 0); },
  'add-food'(el) { openFoodPicker({ meal: el.dataset.meal, onPick: (f, g, meal) => { addEntry(f, g, meal); closeSheet(); toast(`${foodLabel(f)} ajouté`, 'good'); } }); return false; },
  'edit-entry'(el) {
    const e = findEntry(el.dataset.u); if (!e) return false;
    const p = sheet(`<h3>${esc(e.name)}</h3><form id="ee" class="form"><div class="grid2"><label>Quantité (g)<input name="g" type="number" inputmode="decimal" value="${r0(e.g)}"></label><label>Heure<input name="at" type="time" value="${atOf(e)}"></label></div>
      <label>Repas<select name="meal">${LOG_MEALS.map((m) => `<option value="${m.key}" ${m.key === e.meal ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      <div class="prev" id="ee-prev"></div><button class="btn primary block">Enregistrer</button></form>`);
    const f = p.querySelector('#ee'); const prev = p.querySelector('#ee-prev');
    const upd = () => { const g = num(f.g.value) || 0; prev.innerHTML = `<b>${r0((e.per.k * g) / 100)} kcal</b><span>P ${r0((e.per.p * g) / 100)}</span><span>G ${r0((e.per.c * g) / 100)}</span><span>L ${r0((e.per.f * g) / 100)}</span>`; };
    f.g.addEventListener('input', upd); upd();
    f.addEventListener('submit', (ev) => { ev.preventDefault(); const g = num(f.g.value); if (!g || g <= 0) return toast('Quantité invalide', 'bad'); store.update(() => { const x = findEntry(e.uid); x.g = g; x.meal = f.meal.value; x.at = f.at.value || null; recompute(x); }); closeSheet(); });
    return false;
  },
  async 'del-entry'(el) { store.update(() => { const d = store.day(state.date); d.foods = d.foods.filter((x) => x.uid !== el.dataset.u); }); toast('Supprimé'); },
  'swap-entry'(el) {
    const e = findEntry(el.dataset.u); if (!e) return false;
    const base = getFood(e.id); const cat = base?.cat;
    // Équivalent : même catégorie, quantité ajustée sur le macro principal (protéines / glucides / lipides) ou les calories.
    const key = cat === 'prot' || cat === 'dairy' ? 'p' : cat === 'carb' || cat === 'fruit' ? 'c' : cat === 'fat' ? 'f' : 'k';
    const keyLbl = { p: 'protéines', c: 'glucides', f: 'lipides', k: 'calories' }[key];
    const target = key === 'k' ? e.kcal : e[key];
    const alts = allFoods().filter((f) => f.id !== e.id && (cat ? f.cat === cat : true) && f[key] > 0 && !(f.cat === 'other' && cat !== 'other')).slice(0, 60)
      .map((f) => ({ f, g: Math.round((target / f[key]) * 100 / 5) * 5 })).filter((x) => x.g > 0 && x.g < 800);
    const p = sheet(`<h3>Remplacer ${esc(e.name)}</h3><p class="small muted">Équivalent calculé à ${keyLbl} égales (${r0(target)} ${key === 'k' ? 'kcal' : 'g'}).</p>
      <div class="results-list">${alts.map((x, i) => { const m = macrosFor(x.f, x.g); return `<button class="res" data-i="${i}"><span><b>${x.g} g</b> ${esc(foodLabel(x.f))}</span><small>${r0(m.kcal)} kcal · P ${r0(m.p)} · G ${r0(m.c)} · L ${r0(m.f)}</small></button>`; }).join('')}</div>`);
    p.addEventListener('click', (ev) => { const b = ev.target.closest('[data-i]'); if (!b) return; const x = alts[+b.dataset.i];
      store.update(() => { const d = store.day(state.date); const idx = d.foods.findIndex((y) => y.uid === e.uid); const ne = entryFrom(x.f, x.g, e.meal, e.at || atOf(e) || null); d.foods.splice(idx, 1, ne); }); closeSheet(); toast('Aliment remplacé', 'good'); });
    return false;
  },
  'dup-meal'(el) {
    const meal = el.dataset.meal;
    const p = sheet(`<h3>Dupliquer ${MEAL_LABEL[meal].toLowerCase()}</h3><form id="dm" class="form">
      <label>Vers le jour<select name="k">${[0, 1, 2].map((n) => { const k = addDays(state.date, n); return `<option value="${k}">${n === 0 ? 'Même jour' : fmtDate(k)}</option>`; }).join('')}</select></label>
      <label>Repas<select name="meal">${LOG_MEALS.map((m) => `<option value="${m.key}" ${m.key === meal ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      <button class="btn primary block">Dupliquer</button></form>`);
    p.querySelector('#dm').addEventListener('submit', (ev) => { ev.preventDefault(); const fd = new FormData(ev.target);
      store.update(() => { const src = store.day(state.date).foods.filter((x) => x.meal === meal); const dst = store.day(fd.get('k')); for (const x of src) dst.foods.push({ ...x, uid: uid(), meal: fd.get('meal'), t: Date.now(), at: null, copied: true }); });
      closeSheet(); toast('Repas dupliqué', 'good'); });
    return false;
  },
  // Copier un repas d'un jour précédent vers le jour affiché.
  'copy-from'(el) {
    const meal = el.dataset.meal; const s = store.get();
    const src = Object.keys(s.days).filter((k) => k < state.date && s.days[k].foods.some((x) => x.meal === meal)).sort().reverse().slice(0, 10);
    if (!src.length) { toast(`Aucun ${MEAL_LABEL[meal].toLowerCase()} noté les jours précédents`, 'bad'); return false; }
    const p = sheet(`<h3>Copier ${MEAL_LABEL[meal].toLowerCase()} d'un autre jour</h3><div class="results-list">${src.map((k) => { const it = s.days[k].foods.filter((x) => x.meal === meal); const kc = it.reduce((a, x) => a + x.kcal, 0); return `<button class="res" data-k="${k}"><span><b>${fmtDate(k)}</b> · ${r0(kc)} kcal</span><small>${esc(it.map((x) => x.name).join(', ').slice(0, 90))}</small></button>`; }).join('')}</div>`);
    p.addEventListener('click', (ev) => { const b = ev.target.closest('[data-k]'); if (!b) return;
      store.update(() => { const items = store.get().days[b.dataset.k].foods.filter((x) => x.meal === meal); const d = store.day(state.date); for (const x of items) d.foods.push({ ...x, uid: uid(), t: Date.now(), at: null, copied: true }); });
      closeSheet(); toast('Repas copié', 'good'); });
    return false;
  },
  'save-recipe-from'(el) { const items = store.day(state.date).foods.filter((x) => x.meal === el.dataset.meal).map((x) => ({ ...x })); recipeEditor({ name: '', items, steps: '' }); return false; },
  'eat-plan'(el) { const s = store.get(); const i = challengeIndex(s, state.date); const dn = Math.min(14, Math.max(1, i)); eatPlan(dn, el.dataset.meal, state.date); },
  'plan-day'(el) { state.planDay = Number(el.dataset.v); },
  'plan-eat'(el) { const s = store.get(); const k = keyForIndex(s, state.planDay); const today = dateKey(); eatPlan(state.planDay, el.dataset.meal, k > today ? today : k); },
  'plan-reroll'(el) {
    store.update((s) => { const m = s.plan[state.planDay][el.dataset.meal]; s.plan[state.planDay][el.dataset.meal] = buildMeal(m.key, s.targets, s.profile, m.seed + 7); });
    toast('Nouveau repas, macros recalculées', 'good');
  },
  'plan-swap'(el) {
    const s = store.get(); const meal = s.plan[state.planDay][el.dataset.meal]; const role = el.dataset.role;
    const alts = alternativesFor(meal, role, s.profile);
    if (!alts.length) { toast('Aucune alternative compatible avec ton profil', 'bad'); return false; }
    const p = sheet(`<h3>Remplacer</h3><p class="small muted">Les quantités de tout le repas sont recalculées pour garder les mêmes macros.</p>
      <div class="results-list">${alts.map((f) => `<button class="res" data-id="${f.id}"><span>${esc(foodLabel(f))}</span><small>${r0(f.k)} kcal · P ${f.p} · G ${f.c} · L ${f.f} /100 g</small></button>`).join('')}</div>`);
    p.addEventListener('click', (ev) => { const b = ev.target.closest('[data-id]'); if (!b) return;
      store.update((st) => { st.plan[state.planDay][meal.key] = replaceInMeal(meal, role, b.dataset.id, st.targets, st.profile); }); closeSheet(); toast('Remplacé, macros équilibrées', 'good'); });
    return false;
  },
  'shop-week'(el) { state.week = Number(el.dataset.v); },
  'shop-check'(el) { store.update((s) => { (s.shopping[state.week] = s.shopping[state.week] || {})[el.dataset.id] = el.checked; }); },
  async 'shop-share'() {
    const s = store.get(); const w = state.week; const sl = shoppingList(s.plan, w === 1 ? 1 : 8, w === 1 ? 7 : 14);
    const txt = `Courses semaine ${w} — 14 DAYS\n` + sl.rows.map((r) => `- ${r.f.n} : ${r.g >= 1000 ? (r.g / 1000).toFixed(2) + ' kg' : r0(r.g) + ' g'}`).join('\n') + `\nBudget estimé : ${sl.total.toFixed(0)} €`;
    try { if (navigator.share) await navigator.share({ title: 'Liste de courses', text: txt }); else { await navigator.clipboard.writeText(txt); toast('Liste copiée', 'good'); } } catch {}
    return false;
  },
  'prep-from'(el) { state.prepFrom = Number(el.value); },
  'prep-n'(el) { state.prepN = Number(el.value); },
  'recipe-new'() { recipeEditor(); return false; },
  async 'recipe-del'(el) { if (await confirmSheet('Supprimer la recette ?', 'Cette action est définitive.', 'Supprimer', true)) store.update((s) => { s.recipes = s.recipes.filter((r) => r.id !== el.dataset.id); }); return false; },
  'recipe-eat'(el) {
    const r = store.get().recipes.find((x) => x.id === el.dataset.id);
    const p = sheet(`<h3>${esc(r.name)}</h3><div class="seg" id="re">${LOG_MEALS.map((m) => `<button data-m="${m.key}">${m.label}</button>`).join('')}</div>`);
    p.querySelector('#re').addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return;
      store.update(() => { const d = store.day(); for (const x of r.items) d.foods.push({ ...x, uid: uid(), meal: b.dataset.m, t: Date.now(), at: nowHHMM() }); }); closeSheet(); toast('Recette ajoutée', 'good'); });
    return false;
  },
  deviation() {
    const p = sheet(`<h3>Écart alimentaire</h3><p class="coach-msg">${esc(deviationReply())}</p><form id="dv" class="form"><label>Qu'est-ce qui s'est passé ?<textarea name="t" rows="2" placeholder="ex : pizza au dîner avec des amis"></textarea></label>
      <p class="small muted">Pense à ajouter ce que tu as mangé dans le journal pour garder des totaux honnêtes.</p><button class="btn primary block">Noter l'écart</button></form>`);
    p.querySelector('#dv').addEventListener('submit', (e) => { e.preventDefault(); const t = String(new FormData(e.target).get('t') || '').trim(); store.update(() => { const d = store.day(state.date); d.deviation = (d.deviation ? d.deviation + ' · ' : '') + (t || 'écart'); }); closeSheet(); toast('Écart noté. On continue.'); });
    return false;
  },
};

export function eatPlan(dn, mealKey, k) {
  const s = store.get(); const meal = s.plan[dn]?.[mealKey]; if (!meal) return;
  store.update(() => { const d = store.day(k); for (const it of meal.items) { const f = getFood(it.id); if (f) d.foods.push(entryFrom(f, it.g, mealKey, k === dateKey() ? nowHHMM() : null)); } });
  toast(`${MEAL_LABEL[mealKey]} ajouté au journal`, 'good');
}
