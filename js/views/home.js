// Tableau de bord : comprendre en 5 secondes si la journée est réussie.
import { dateKey, fmtKg, fmtDate, addDays, r0, esc, fmtNum, num } from '../util.js';
import { ring, lineChart, bar } from '../charts.js';
import { icon, sheet, closeSheet, toast } from '../ui.js';
import * as store from '../store.js';
import { dayScore, stats, weightSeries, currentWeight, trendWeight, challengeIndex, activityMinutes, sportKcal, workoutProgress, SUCCESS, CHALLENGE_DAYS } from '../score.js';
import { analyze } from '../coach.js';
import { isTrainingType, TYPE_LABEL } from '../training.js';
import { waterTarget } from '../nutrition.js';
import { addWater, checklist, nowHHMM } from '../tracking.js';
import { waterAdd } from './suivi.js';

export function render(ctx) {
  const s = store.get(); const k = dateKey();
  const i = challengeIndex(s, k);
  const st = stats(s, k);
  const sc = dayScore(s, k);
  const d = s.days[k] || store.emptyDay();
  const T = s.targets; const p = s.profile;
  const cur = currentWeight(s); const trend = trendWeight(s);
  const lost = p.weight - cur;
  const toLose = p.weight - p.goalWeight;
  const goalPct = toLose > 0 ? Math.max(0, Math.min(1, lost / toLose)) : 0;
  const prog = sc.prog;
  const isTrain = prog && isTrainingType(prog.type);
  const wp = workoutProgress(d, prog);
  const wt = waterTarget(T, isTrain);
  const coach = analyze(s);
  const daysLeft = Math.max(0, CHALLENGE_DAYS - i);
  const endKey = addDays(p.startDate, CHALLENGE_DAYS - 1);
  const verdict = sc.total >= SUCCESS ? ['good', 'Journée réussie'] : sc.total >= 50 ? ['mid', 'En cours, pas encore gagnée'] : ['bad', 'Journée en danger'];
  const losses = sc.parts.filter((x) => x.pts < x.max).sort((a, b) => (b.max - b.pts) - (a.max - a.pts));
  const ws = weightSeries(s).filter((x) => x.i >= 1 && x.i <= 14);
  const pts = [{ x: 1, y: p.weight, label: `Départ : ${p.weight} kg` }, ...ws.filter((x) => !(x.i === 1)).map((x) => ({ x: x.i, y: x.w, label: `J${x.i} (${fmtDate(x.k, false)}) : ${x.w} kg` }))];
  if (ws.find((x) => x.i === 1)) pts[0] = { x: 1, y: ws.find((x) => x.i === 1).w, label: `J1 : ${ws.find((x) => x.i === 1).w} kg` };
  const t = sc.totals;
  const remaining = T.kcal - t.kcal;
  const dots = Array.from({ length: 14 }, (_, x) => {
    const row = st.rows.find((r) => r.i === x + 1);
    const cls = !row ? 'future' : row.isToday ? (row.total >= SUCCESS ? 'ok today' : 'today') : row.total >= SUCCESS ? 'ok' : row.total >= 50 ? 'mid' : 'ko';
    return `<button class="rdot ${cls}" data-act="goto-journal" data-k="${addDays(p.startDate, x)}" aria-label="Jour ${x + 1}${row ? ' : ' + row.total + '/100' : ''}"><span>${x + 1}</span></button>`;
  }).join('');

  const header = i < 1
    ? `<div class="hero"><div class="eyebrow">Départ le ${fmtDate(p.startDate)}</div><h1>J−${1 - i}</h1><p class="muted">Le challenge n'a pas commencé. Fais tes courses (onglet Nutrition → Courses).</p></div>`
    : i > CHALLENGE_DAYS
      ? `<div class="hero"><div class="eyebrow">Challenge terminé</div><h1>14/14</h1><button class="btn primary" data-act="nav" data-v="report">Voir mon bilan final</button></div>`
      : `<div class="hero"><div class="eyebrow">${fmtDate(k)} · ${daysLeft === 0 ? 'dernier jour' : daysLeft + ' jour' + (daysLeft > 1 ? 's' : '') + ' restant' + (daysLeft > 1 ? 's' : '')}</div>
         <h1>JOUR ${i}<span>/14</span></h1>
         <div class="hero-bar"><div style="width:${(i / 14) * 100}%"></div></div>
         <div class="muted small">Fin le ${fmtDate(endKey)}</div></div>`;

  return `
  <header class="topbar"><div class="brand">14 DAYS <i>—</i> NO EXCUSES</div>
    <div class="row"><button class="iconbtn" data-act="nav" data-v="report" aria-label="Bilan">${icon('report')}</button><button class="iconbtn" data-act="nav" data-v="settings" aria-label="Réglages">${icon('settings')}</button></div></header>
  ${header}

  <section class="card score-card ${verdict[0]}" data-act="score-detail">
    <div class="row between">
      <div>${ring(sc.total / 100, { size: 118, stroke: 11, label: String(sc.total), sub: '/100', color: sc.total >= SUCCESS ? 'var(--green)' : sc.total >= 50 ? 'var(--amber)' : 'var(--red)' })}</div>
      <div class="score-side">
        <div class="verdict ${verdict[0]}">${verdict[1]}</div>
        <div class="mini-stats">
          <div><b>${st.avg7}</b><span>moy. 7 j</span></div>
          <div><b>${st.streak}</b><span>série</span></div>
          <div><b class="${st.missed.length ? 'red' : ''}">${st.missed.length}</b><span>séances manquées</span></div>
        </div>
      </div>
    </div>
    ${losses.length ? `<ul class="losses">${losses.slice(0, 3).map((x) => `<li><span>${esc(x.label)}</span><b>−${x.max - x.pts}</b><small>${esc(x.why)}</small></li>`).join('')}</ul>` : '<p class="good small">Aucun point perdu. Parfait.</p>'}
    <div class="tap-hint">Touchez pour le détail du score</div>
  </section>

  <section class="card coach-card tone-${coach.main.tone}">
    <div class="coach-head"><div class="avatar">C</div><div><b>Ton coach</b><small>${coach.main.tone === 'good' ? 'satisfait (pour l\'instant)' : coach.main.tone === 'push' ? 'pas content' : 'te surveille'}</small></div></div>
    <p class="coach-msg">${esc(coach.main.text)}</p>
    <div class="row gap"><button class="btn primary grow" data-act="nav" data-v="coach" data-chat="1">Parler à mon coach</button>${isTrain && wp.ratio < 1 ? `<button class="btn ghost" data-act="nav" data-v="sport">Ma séance</button>` : ''}</div>
  </section>

  ${i >= 1 && i <= CHALLENGE_DAYS ? (() => { const cl = checklist(s, k); const n = cl.filter((c) => c.done).length; return `<section class="card" data-act="nav" data-v="suivi">
    <div class="card-h"><h2>Contrôle du jour</h2><span class="pill ${n === 8 ? 'ok' : ''}">${n}/8</span></div>
    <div class="cl-mini">${cl.map((c) => `<span class="${c.done ? 'done' : ''}" title="${esc(c.label)}">${c.done ? icon('check') : ''}<small>${esc(c.label.split(' ')[0])}</small></span>`).join('')}</div>
    <div class="tap-hint">Ouvrir le suivi quotidien</div></section>`; })() : ''}

  <section class="card">
    <div class="card-h"><h2>Poids</h2><button class="link" data-act="nav" data-v="body">Corps & mensurations</button></div>
    <div class="grid4 kpis">
      <div><span>Départ</span><b>${fmtKg(p.weight)}</b></div>
      <div><span>Actuel</span><b>${fmtKg(cur)}</b></div>
      <div><span>Cible</span><b>${fmtKg(p.goalWeight)}</b></div>
      <div><span>Écart</span><b class="${lost > 0 ? 'green' : ''}">${lost > 0 ? '−' : lost < 0 ? '+' : ''}${fmtKg(Math.abs(lost))}</b></div>
    </div>
    <div class="goalbar"><div style="width:${goalPct * 100}%"></div></div>
    <div class="small muted">${Math.round(goalPct * 100)} % de l'objectif · moyenne 3 jours : ${fmtKg(trend)}</div>
    ${lineChart(pts, { target: p.goalWeight, unit: ' kg', id: 'w' })}
    ${d.weight == null && i >= 1 ? `<button class="btn ghost block" data-act="quick" data-f="weight">Noter ma pesée du jour</button>` : ''}
    <p class="fine">Une variation de poids sur quelques jours inclut l'eau, le glycogène et le contenu digestif : ce n'est pas une mesure de perte de graisse.</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Nutrition</h2><button class="link" data-act="nav" data-v="nutrition">Journal alimentaire</button></div>
    <div class="row gap center-y">
      ${ring(Math.min(1, t.kcal / T.kcal), { size: 112, stroke: 10, label: fmtNum(t.kcal), sub: 'kcal', color: t.kcal > T.kcal * 1.1 ? 'var(--red)' : 'var(--green)' })}
      <div class="grow">
        <div class="kcal-left ${remaining < 0 ? 'red' : ''}"><b>${fmtNum(Math.abs(remaining))}</b> kcal ${remaining >= 0 ? 'restantes' : 'de trop'}</div>
        <div class="small muted">Objectif ${fmtNum(T.kcal)} kcal</div>
        <button class="btn primary sm" data-act="add-food-quick">${icon('plus')} Ajouter un aliment</button>
      </div>
    </div>
    ${bar(t.p, T.protein, { label: 'Protéines', cls: 'p' })}
    ${bar(t.c, T.carbs, { label: 'Glucides', cls: 'c' })}
    ${bar(t.f, T.fat, { label: 'Lipides', cls: 'f' })}
  </section>

  <section class="card">
    <div class="card-h"><h2>Activité</h2><button class="link" data-act="nav" data-v="sport">Programme</button></div>
    <div class="session-line ${isTrain ? (wp.ratio >= 1 ? 'done' : 'todo') : 'rest'}" data-act="nav" data-v="sport">
      <div><small>${prog ? TYPE_LABEL[prog.type] : ''}</small><b>${prog ? esc(prog.title) : '—'}</b></div>
      <div class="pill">${!prog ? '' : !isTrain ? 'Planifié' : d.workout?.converted ? 'Converti' : wp.ratio >= 1 ? 'Terminé ✓' : `${wp.done}/${wp.total}`}</div>
    </div>
    <div class="grid2 tiles">
      <button class="tile" data-act="quick" data-f="steps"><span>Pas</span><b>${d.steps != null ? fmtNum(d.steps) : '—'}</b><small>/ ${fmtNum(p.stepsGoal || T.steps)}</small></button>
      <div class="tile"><span>Durée d'activité</span><b>${activityMinutes(s, d, prog)} min</b><small>≈ ${sportKcal(s, d, prog)} kcal (estim.)</small></div>
      <button class="tile" data-act="quick" data-f="sleep"><span>Sommeil</span><b>${d.sleep != null ? String(d.sleep).replace('.', ',') + ' h' : '—'}</b><small>objectif 7 h+</small></button>
      <div class="tile water"><span>Eau</span><b>${(d.water / 1000).toFixed(2).replace('.', ',')} L</b><small>/ ${(wt / 1000).toFixed(1)} L</small>
        <div class="row gap-s"><button class="chipbtn" data-act="water" data-v="-250" aria-label="Retirer 250 ml">−</button><button class="chipbtn" data-act="water" data-v="250">+250</button><button class="chipbtn" data-act="water" data-v="500">+500</button></div></div>
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Régularité</h2><span class="small muted">${st.regularity} % de journées réussies</span></div>
    <div class="rdots">${dots}</div>
    <div class="legend"><span class="lg ok"></span>réussie (≥ 70) <span class="lg mid"></span>moyenne <span class="lg ko"></span>ratée</div>
  </section>`;
}

export const actions = {
  'score-detail'(el) {
    const s = store.get(); const k = el?.dataset?.k || dateKey(); const sc = dayScore(s, k);
    sheet(`<h3>Score ${k === dateKey() ? 'du jour' : 'du ' + fmtDate(k)} : ${sc.total}/100</h3>
      <ul class="score-parts">${sc.parts.map((p) => `<li><div class="row between"><span>${esc(p.label)}</span><b>${p.pts}/${p.max}</b></div>
      <div class="pbar-track"><div class="pbar-fill" style="width:${(p.pts / p.max) * 100}%"></div></div>${p.why ? `<small class="muted">${esc(p.why)}</small>` : ''}</li>`).join('')}</ul>
      <p class="fine">Journée réussie à partir de ${SUCCESS}/100. Les jours de repos et de récupération planifiés ne perdent aucun point d'entraînement.</p>
      <button class="btn ghost block" data-act="sheet-close">Fermer</button>`);
  },
  water(el) {
    const v = Number(el.dataset.v);
    if (v < 0) { const d = store.get().days[dateKey()]; if (!d?.water) return false; store.update(() => addWater(store.day(), Math.max(v, -d.water))); return; }
    waterAdd(v, dateKey());
  },
  quick(el) {
    const f = el.dataset.f;
    const meta = { weight: ['Pesée du matin', 'kg', '0.1', 'Le matin, à jeun, après les toilettes.'], steps: ['Nombre de pas', 'pas', '100', 'Recopie le chiffre de l\'app Santé (iPhone).'], sleep: ['Sommeil de la nuit', 'heures', '0.25', 'Ex : 7,5'] }[f];
    const cur = store.day()[f];
    const p = sheet(`<h3>${meta[0]}</h3><p class="muted small">${meta[3]}</p>
      <form id="qf" class="form"><label>${meta[1]}<input name="v" type="number" inputmode="decimal" step="${meta[2]}" value="${cur ?? ''}" autofocus></label>
      <button class="btn primary block">Enregistrer</button></form>`);
    p.querySelector('#qf').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = num(new FormData(e.target).get('v'));
      if (v == null || v < 0) { toast('Valeur invalide', 'bad'); return; }
      if (f === 'weight' && (v < 30 || v > 300)) { toast('Poids invalide', 'bad'); return; }
      if (f === 'sleep' && v > 16) { toast('Durée invalide', 'bad'); return; }
      store.update((s) => { const d = store.day(); d[f] = f === 'steps' ? Math.round(v) : v; if (f === 'weight' && !d.weighTime) d.weighTime = nowHHMM(); });
      closeSheet(); toast('Enregistré', 'good');
    });
  },
};
