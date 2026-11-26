// Sport : séance du jour (cases à cocher, charges, reps), cardio, programme 14 jours, historique.
import { dateKey, esc, r0, num, fmtDate, addDays } from '../util.js';
import { programDay, isTrainingType, TYPE_LABEL, CARDIO_TYPES, INTENSITIES, cardioKcal, sessionKcal } from '../training.js';
import { icon, sheet, closeSheet, toast, seg } from '../ui.js';
import * as store from '../store.js';
import { challengeIndex, keyForIndex, workoutProgress, workoutMinutes } from '../score.js';
import { nowHHMM } from '../tracking.js';
import { EXCUSES, excuseReply, LINES } from '../coach.js';
import { pick } from '../util.js';
import { lineChart } from '../charts.js';

export const state = { tab: 'jour', day: null };

function lastPerf(s, name, beforeKey) {
  const keys = Object.keys(s.days).filter((k) => k < beforeKey).sort().reverse();
  for (const k of keys) {
    const i = challengeIndex(s, k); if (i < 1) continue;
    const prog = programDay(s.profile, ((i - 1) % 14) + 1);
    const idx = prog.ex.findIndex((e) => e.name === name);
    const sets = s.days[k].workout?.ex?.[idx]?.sets?.filter((x) => x && (x.kg || x.reps));
    if (idx >= 0 && sets?.length) return { k, sets };
  }
  return null;
}

// Volume (kg × reps) d'une séance, et séance précédente du même type pour comparer.
export function sessionVolume(d, prog) {
  let v = 0;
  prog.ex.forEach((e, i) => { for (const st of d?.workout?.ex?.[i]?.sets || []) v += (num(st?.kg) || 0) * (num(st?.reps) || 0); });
  return Math.round(v);
}
function prevSameSession(s, prog, beforeKey) {
  const keys = Object.keys(s.days).filter((k) => k < beforeKey).sort().reverse();
  for (const k of keys) {
    const i = challengeIndex(s, k); if (i < 1) continue;
    const p = programDay(s.profile, ((i - 1) % 14) + 1);
    if (p.code === prog.code) { const v = sessionVolume(s.days[k], p); if (v > 0 || workoutProgress(s.days[k], p).done) return { k, v, min: Math.round(workoutMinutes(s.days[k], p)), rpe: s.days[k].workout?.rpe }; }
  }
  return null;
}
let restTimer = null;
function startRest(sec) {
  clearInterval(restTimer); if (!sec) return;
  let el = document.getElementById('rest-timer');
  if (!el) { el = document.createElement('button'); el.id = 'rest-timer'; el.className = 'rest-timer'; el.onclick = () => { clearInterval(restTimer); el.remove(); }; document.body.appendChild(el); }
  const end = Date.now() + sec * 1000;
  const tick = () => { const r = Math.max(0, Math.round((end - Date.now()) / 1000)); el.innerHTML = r > 0 ? `Repos <b>${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}</b><small>toucher pour arrêter</small>` : '<b>Série suivante !</b>'; if (r <= 0) { clearInterval(restTimer); setTimeout(() => el.remove(), 4000); } };
  tick(); restTimer = setInterval(tick, 500);
}

export function render() {
  const s = store.get();
  const ci = challengeIndex(s);
  if (!state.day) state.day = Math.min(14, Math.max(1, ci));
  const tabs = seg('sp-tab', [['jour', 'Séance'], ['cardio', 'Cardio'], ['prog', 'Programme'], ['hist', 'Historique']], state.tab);
  let body = state.tab === 'jour' ? renderSession(s) : state.tab === 'cardio' ? renderCardio(s) : state.tab === 'prog' ? renderProgram(s) : renderHistory(s);
  return `<header class="topbar"><div class="title">Sport</div></header>${tabs}${body}`;
}

function renderSession(s) {
  const dn = state.day; const k = keyForIndex(s, dn); const today = dateKey();
  const prog = programDay(s.profile, dn);
  const d = s.days[k] || store.emptyDay();
  const wp = workoutProgress(d, prog);
  const editable = k <= today;
  const isTrain = isTrainingType(prog.type);
  const dayChips = Array.from({ length: 14 }, (_, x) => { const p = programDay(s.profile, x + 1); return `<button class="${x + 1 === dn ? 'on' : ''} t-${p.type}" data-act="sp-day" data-v="${x + 1}">J${x + 1}</button>`; }).join('');
  const kcal = sessionKcal(prog.met, s.profile.weight, prog.duration);
  const express = d.workout?.express && prog.type === 'muscu';
  const exList = prog.ex.map((e, i) => {
    const log = d.workout?.ex?.[i] || {};
    const lp = e.load ? lastPerf(s, e.name, k) : null;
    const dim = express && i >= 3;
    return `<li class="ex ${log.done ? 'done' : ''} ${dim ? 'dim' : ''}">
      <div class="ex-h"><button class="check ${log.done ? 'on' : ''}" data-act="ex-done" data-i="${i}" ${editable ? '' : 'disabled'} aria-label="Exercice terminé">${icon('check')}</button>
        <div class="grow"><b>${esc(e.name)}</b><div class="small muted">${express && i < 3 ? 2 : e.sets} × ${esc(e.reps)}${e.rest ? ` · repos ${e.rest >= 60 ? Math.floor(e.rest / 60) + ' min' + (e.rest % 60 ? ' ' + (e.rest % 60) : '') : e.rest + ' s'}` : ''}</div></div></div>
      <details><summary>Consignes</summary><p class="small">${esc(e.cue)}</p>${e.note ? `<p class="small green">${esc(e.note)}</p>` : ''}</details>
      ${e.load ? `<div class="sets">${Array.from({ length: express && i < 3 ? 2 : e.sets }, (_, si) => { const st = log.sets?.[si] || {}; return `<div class="set ${st.ok ? 'ok' : ''}"><button class="scheck ${st.ok ? 'on' : ''}" data-act="set-ok" data-i="${i}" data-si="${si}" data-rest="${e.rest || 0}" ${editable ? '' : 'disabled'} aria-label="Série ${si + 1} faite">S${si + 1}</button>
        <input type="number" inputmode="decimal" step="0.5" placeholder="kg" value="${st.kg ?? ''}" data-chg="set-val" data-i="${i}" data-si="${si}" data-f="kg" ${editable ? '' : 'disabled'} aria-label="Charge série ${si + 1}">
        <input type="number" inputmode="numeric" placeholder="reps" value="${st.reps ?? ''}" data-chg="set-val" data-i="${i}" data-si="${si}" data-f="reps" ${editable ? '' : 'disabled'} aria-label="Répétitions série ${si + 1}"></div>`; }).join('')}</div>
        ${lp ? `<div class="small muted">Dernière fois (${fmtDate(lp.k, false)}) : ${lp.sets.map((x) => `${x.kg ?? '?'} kg × ${x.reps ?? '?'}`).join(' · ')}</div>` : ''}` : (express && i < 3 ? 2 : e.sets) > 1 ? `<div class="setchecks">${Array.from({ length: express && i < 3 ? 2 : e.sets }, (_, si) => { const st = log.sets?.[si] || {}; return `<button class="scheck ${st.ok ? 'on' : ''}" data-act="set-ok" data-i="${i}" data-si="${si}" data-rest="${e.rest || 0}" ${editable ? '' : 'disabled'} aria-label="Série ${si + 1} faite">S${si + 1}</button>`; }).join('')}</div>` : ''}
    </li>`;
  }).join('');
  return `<div class="hscroll days">${dayChips}</div>
  <section class="card session-head t-${prog.type}">
    <small class="muted">${TYPE_LABEL[prog.type]} · Jour ${dn} · ${fmtDate(k)} · semaine ${prog.week}</small>
    <h2>${esc(prog.title)}</h2>
    <div class="grid3 kpis"><div><span>Durée</span><b>~${prog.duration} min</b></div><div><span>Dépense</span><b>≈ ${kcal}</b><small>kcal (estimation)</small></div><div><span>Fait</span><b>${wp.done}/${wp.total}</b></div></div>
    ${isTrain ? `<div class="hero-bar"><div style="width:${wp.ratio * 100}%"></div></div>` : ''}
    ${d.workout?.converted ? `<p class="note">Séance convertie en récupération (${esc(d.workout.converted)}). Aucun point perdu.</p>` : ''}
    ${express ? '<p class="note">Version express : 3 exercices × 2 séries. Elle vaut 80 % des points. Mieux que rien, moins que tout.</p>' : ''}
    ${!isTrain ? '<p class="small muted">Jour planifié sans séance lourde : aucun point d\'entraînement perdu. Les pas comptent toujours.</p>' : ''}
  </section>
  ${isTrain ? (() => { const w = d.workout || {}; const min = Math.round(workoutMinutes(d, prog)); const measured = !!(w.startAt && w.endAt); const prev = prevSameSession(s, prog, k); const vol = sessionVolume(d, prog);
    return `<section class="card form" id="sp-timing"><div class="card-h"><h3>Chrono & ressenti</h3>${k === today && !w.startAt ? '<button class="btn primary sm" data-act="sp-start">Démarrer</button>' : k === today && w.startAt && !w.endAt ? '<button class="btn primary sm" data-act="sp-end">Terminer</button>' : ''}</div>
      <div class="grid2"><label>Début<input type="time" value="${w.startAt || ''}" data-chg="sp-time" data-f="startAt" ${editable ? '' : 'disabled'}></label><label>Fin<input type="time" value="${w.endAt || ''}" data-chg="sp-time" data-f="endAt" ${editable ? '' : 'disabled'}></label></div>
      <div class="grid3 kpis"><div><span>Durée</span><b>${min} min</b><small>${measured ? 'mesurée' : 'estimée'}</small></div><div><span>Dépense</span><b>≈ ${sessionKcal(prog.met, s.profile.weight, min)}</b><small>kcal (non rajoutées)</small></div><div><span>Volume</span><b>${vol.toLocaleString('fr-FR')}</b><small>kg × reps</small></div></div>
      <div class="sc10"><div class="row between"><span>Effort perçu (RPE)</span><b>${w.rpe != null ? w.rpe + '/10' : '—'}</b></div><div class="s10">${Array.from({ length: 10 }, (_, x) => x + 1).map((v) => `<button class="${w.rpe === v ? 'on' : ''} ${w.rpe != null && v <= w.rpe ? 'fill' : ''}" data-act="sp-rpe" data-v="${v}" ${editable ? '' : 'disabled'}>${v}</button>`).join('')}</div><small class="muted">1 = très facile · 7-8 = dur, 2-3 reps en réserve · 10 = maximal</small></div>
      ${prev ? `<p class="small">Séance précédente (${fmtDate(prev.k, false)}) : volume ${prev.v.toLocaleString('fr-FR')} kg, ${prev.min} min${prev.rpe ? ', RPE ' + prev.rpe : ''}.${vol > 0 ? ` <b class="${vol >= prev.v ? 'green' : 'red'}">${vol >= prev.v ? '+' : ''}${vol - prev.v} kg de volume</b>` : ''}</p>` : '<p class="fine">Note charges et répétitions : la comparaison avec ta séance précédente apparaîtra ici.</p>'}
    </section>`; })() : ''}
  <ul class="exlist">${exList}</ul>
  ${isTrain && editable && k === today && wp.ratio < 1 && !d.workout?.converted ? `<div class="row gap-s wrap"><button class="btn ghost grow" data-act="postpone">Reporter</button><button class="btn ghost grow" data-act="excuse">J'ai une excuse</button>${prog.type === 'muscu' && !express ? '<button class="btn ghost grow" data-act="express">Version express</button>' : ''}</div>` : ''}
  ${isTrain && wp.ratio >= 1 ? `<p class="good center">Séance terminée. ${esc(pick(LINES.sessionDone, dn))}</p>` : ''}
  <p class="fine">Calories du sport : estimations (MET × poids × durée), non ajoutées à ton budget alimentaire.</p>`;
}

function renderCardio(s) {
  const k = dateKey(); const d = s.days[k] || store.emptyDay();
  const total = (d.cardio || []).reduce((a, c) => a + (c.kcal || 0), 0);
  return `<section class="card"><h3>Ajouter du cardio</h3>
    <form id="cardio" class="form" data-submit="cardio-add">
      <div class="seg sm" data-radio="type">${CARDIO_TYPES.map(([id, l], x) => `<label><input type="radio" name="type" value="${id}" ${x === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div class="grid2"><label>Durée (min)<input name="min" type="number" inputmode="numeric" min="1" max="300" value="30" required></label>
      <label>Intensité<select name="int">${INTENSITIES.map((l, x) => `<option value="${x}" ${x === 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <p class="small muted">Repères : tapis incliné 8-12 % à 5 km/h = modérée · course facile = modérée · intervalles = élevée.</p>
      <button class="btn primary block">Ajouter</button></form></section>
  <section class="card"><div class="card-h"><h3>Aujourd'hui</h3><span class="small muted">≈ ${total} kcal (estim.)</span></div>
    ${(d.cardio || []).length ? `<ul class="foods">${d.cardio.map((c, x) => `<li><div class="food-main"><span class="fn">${esc(CARDIO_TYPES.find((t) => t[0] === c.type)?.[1] || c.type)} · ${c.min} min</span><span class="fq">Intensité ${INTENSITIES[c.int].toLowerCase()} · ≈ ${c.kcal} kcal</span></div><button class="iconbtn sm" data-act="cardio-del" data-i="${x}" aria-label="Supprimer">${icon('trash')}</button></li>`).join('')}</ul>` : '<p class="muted small">Aucun cardio noté aujourd\'hui.</p>'}
    <p class="fine">Ces calories ne s'ajoutent pas à ton objectif alimentaire.</p></section>
  <section class="card"><h3>Marche quotidienne</h3><p class="small">Objectif : ${(s.profile.stepsGoal || 10000).toLocaleString('fr-FR')} pas par jour, chaque jour, repos compris. C'est le levier le plus sûr pour la perte de graisse. Note tes pas et ta distance dans l'onglet Suivi (chiffres de l'app Santé).</p></section>`;
}

function renderProgram(s) {
  const ci = challengeIndex(s);
  const rows = Array.from({ length: 14 }, (_, x) => {
    const p = programDay(s.profile, x + 1); const k = keyForIndex(s, x + 1); const d = s.days[k];
    const wp = workoutProgress(d, p); const isT = isTrainingType(p.type);
    const status = !isT ? 'planifié' : d?.workout?.converted ? 'converti' : wp.ratio >= 1 ? 'fait ✓' : x + 1 < ci ? (wp.ratio >= 0.5 ? 'partiel' : 'manqué') : x + 1 === ci ? 'aujourd\'hui' : 'à venir';
    return `<li class="t-${p.type} ${status === 'manqué' ? 'ko' : status.startsWith('fait') ? 'ok' : ''}"><button data-act="sp-open" data-v="${x + 1}"><span class="dn">J${x + 1}</span><span class="grow"><b>${esc(p.title)}</b><small>${fmtDate(k)} · ~${p.duration} min</small></span><span class="pill">${status}</span></button></li>`;
  });
  const remaining = Array.from({ length: 14 }, (_, x) => programDay(s.profile, x + 1)).filter((p, x) => isTrainingType(p.type) && x + 1 >= Math.max(1, ci)).length;
  return `<section class="card"><div class="row between"><b>${remaining} séance(s) restante(s)</b><span class="small muted">progression semaine 2 : +charge ou +reps</span></div></section><ul class="proglist">${rows.join('')}</ul>`;
}

function renderHistory(s) {
  const perEx = {};
  for (const k of Object.keys(s.days).sort()) {
    const i = challengeIndex(s, k); if (i < 1) continue;
    const prog = programDay(s.profile, ((i - 1) % 14) + 1);
    prog.ex.forEach((e, idx) => {
      if (!e.load) return;
      const sets = s.days[k].workout?.ex?.[idx]?.sets?.filter((x) => x && num(x.kg) != null);
      if (!sets?.length) return;
      const top = Math.max(...sets.map((x) => num(x.kg)));
      const vol = sets.reduce((a, x) => a + (num(x.kg) || 0) * (num(x.reps) || 0), 0);
      (perEx[e.name] = perEx[e.name] || []).push({ k, i, top, vol, sets });
    });
  }
  const names = Object.keys(perEx);
  if (!names.length) return '<section class="card"><p class="muted">Aucune charge enregistrée. Note tes kilos et tes répétitions pendant la séance : ils apparaîtront ici avec ta progression.</p></section>';
  return names.map((n, x) => { const a = perEx[n]; const first = a[0], last = a[a.length - 1]; const diff = last.top - first.top;
    return `<section class="card"><div class="card-h"><h3>${esc(n)}</h3><span class="${diff > 0 ? 'green' : 'muted'} small">${diff > 0 ? '+' : ''}${diff} kg</span></div>
    ${a.length > 1 ? lineChart(a.map((r) => ({ x: r.i, y: r.top, label: `J${r.i} : ${r.top} kg (volume ${r0(r.vol)} kg)` })), { id: 'h' + x, unit: ' kg', height: 120, yPad: 2 }) : ''}
    <ul class="hist">${a.slice().reverse().map((r) => `<li><span>${fmtDate(r.k)}</span><span>${r.sets.map((z) => `${z.kg}×${z.reps ?? '?'}`).join(' · ')}</span></li>`).join('')}</ul></section>`; }).join('');
}

function wk() { const s = store.get(); return keyForIndex(s, state.day); }

export const actions = {
  'sp-tab'(el) { state.tab = el.dataset.v; },
  'sp-day'(el) { state.day = Number(el.dataset.v); },
  'sp-open'(el) { state.day = Number(el.dataset.v); state.tab = 'jour'; window.scrollTo(0, 0); },
  'ex-done'(el) {
    const i = el.dataset.i; const k = wk();
    store.update((s) => {
      const d = store.day(k); const e = (d.workout.ex[i] = d.workout.ex[i] || { sets: [] }); e.done = !e.done;
      const prog = programDay(s.profile, state.day);
      if (workoutProgress(d, prog).ratio >= (d.workout.express ? 0.8 : 1) && !d.workout.completedAt) { d.workout.completedAt = Date.now(); setTimeout(() => toast('Séance terminée. Bien. Recommence demain.', 'good'), 50); }
    });
  },
  'set-ok'(el) {
    const { i, si } = el.dataset; const k = wk(); let on = false;
    store.update((s) => {
      const d = store.day(k); const e = (d.workout.ex[i] = d.workout.ex[i] || { sets: [] }); e.sets = e.sets || [];
      e.sets[si] = { ...(e.sets[si] || {}), ok: !e.sets[si]?.ok }; on = e.sets[si].ok;
      const prog = programDay(s.profile, state.day); const ex = prog.ex[i];
      const n = d.workout.express && prog.type === 'muscu' && i < 3 ? 2 : ex.sets;
      const all = Array.from({ length: n }, (_, x) => e.sets[x]?.ok).every(Boolean);
      if (all && !e.done) e.done = true;
      if (!d.workout.startAt && k === dateKey()) d.workout.startAt = nowHHMM();
      if (workoutProgress(d, prog).ratio >= (d.workout.express ? 0.8 : 1) && !d.workout.completedAt) { d.workout.completedAt = Date.now(); if (!d.workout.endAt && k === dateKey()) d.workout.endAt = nowHHMM(); setTimeout(() => toast('Séance terminée. Bien. Note ton RPE.', 'good'), 50); }
    });
    if (on) startRest(Number(el.dataset.rest));
  },
  'sp-start'() { store.update(() => { store.day(wk()).workout.startAt = nowHHMM(); }); toast('Séance démarrée. Chrono lancé.'); },
  'sp-end'() { store.update(() => { store.day(wk()).workout.endAt = nowHHMM(); }); toast('Séance terminée. Note ton effort perçu.', 'good'); },
  'sp-time'(el) { store.update(() => { store.day(wk()).workout[el.dataset.f] = el.value || null; }); },
  'sp-rpe'(el) { store.update(() => { const w = store.day(wk()).workout; const v = Number(el.dataset.v); w.rpe = w.rpe === v ? null : v; }); },
  'set-val'(el) {
    const { i, si, f } = el.dataset; const v = num(el.value); const k = wk();
    store.update(() => { const d = store.day(k); const e = (d.workout.ex[i] = d.workout.ex[i] || { sets: [] }); e.sets = e.sets || []; e.sets[si] = { ...(e.sets[si] || {}), [f]: v }; }, { silent: true });
  },
  postpone() {
    let n = 0;
    store.update(() => { const d = store.day(); d.workout.postponed = (d.workout.postponed || 0) + 1; n = d.workout.postponed; });
    const text = pick(LINES.postponed, n + new Date().getDate());
    const p = sheet(`<h3>Report n°${n}</h3><p class="coach-msg">${esc(text)}</p><form id="pp" class="form"><label>Nouvelle heure, précise<input type="time" name="t" value="${String(new Date().getHours() + 1).padStart(2, '0')}:00"></label><button class="btn primary block">Je m'engage sur cette heure</button></form>`);
    p.querySelector('#pp').addEventListener('submit', (e) => { e.preventDefault(); const t = new FormData(e.target).get('t');
      store.update((s) => { const r = s.settings.reminders.find((x) => x.id === 'seance_nv'); store.day().workout.newTime = t; s.settings.lastFired[`${dateKey()}:seance_nv`] = 0; if (r) r.todayAt = { k: dateKey(), t }; });
      closeSheet(); toast(`Engagement : ${t}. Je te le rappellerai.`); });
    return false;
  },
  excuse() {
    const p = sheet(`<h3>Vas-y, je t'écoute.</h3><div class="results-list">${EXCUSES.map(([id, l]) => `<button class="res" data-e="${id}"><span>${l}</span></button>`).join('')}</div>`);
    p.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-e]'); if (!b) return;
      const s = store.get(); const r = excuseReply(b.dataset.e, s);
      store.update(() => { store.day().excuses.push({ type: b.dataset.e, t: Date.now() }); });
      p.innerHTML = `<div class="sheet-grip"></div><h3>Le coach</h3><p class="coach-msg">${esc(r.text)}</p>
        ${r.action === 'convert' ? '<button class="btn primary block" data-x="convert">Convertir en récupération</button>' : ''}
        ${r.action === 'express' ? '<button class="btn primary block" data-x="express">Passer en version express</button>' : ''}
        <button class="btn ghost block" data-x="close">${r.action ? 'Non, je fais la séance complète' : 'Compris, j\'y vais'}</button>`;
      p.querySelector('[data-x="convert"]')?.addEventListener('click', () => { store.update(() => { store.day().workout.converted = b.dataset.e === 'malade' ? 'maladie' : 'douleur'; }); closeSheet(); });
      p.querySelector('[data-x="express"]')?.addEventListener('click', () => { store.update(() => { store.day().workout.express = true; }); closeSheet(); });
      p.querySelector('[data-x="close"]').addEventListener('click', closeSheet);
    });
    return false;
  },
  express() { store.update(() => { store.day().workout.express = true; }); toast('Version express activée : 3 exercices, 2 séries.'); },
  'cardio-add'(form) {
    const fd = new FormData(form); const min = num(fd.get('min'));
    if (!min || min <= 0 || min > 300) { toast('Durée invalide', 'bad'); return; }
    const s = store.get(); const c = { type: fd.get('type'), min, int: Number(fd.get('int')), kcal: cardioKcal(fd.get('type'), Number(fd.get('int')), min, s.profile.weight), t: Date.now() };
    store.update(() => { store.day().cardio.push(c); }); toast(`Cardio ajouté : ≈ ${c.kcal} kcal (estimation)`, 'good');
  },
  'cardio-del'(el) { store.update(() => { store.day().cardio.splice(Number(el.dataset.i), 1); }); },
};
