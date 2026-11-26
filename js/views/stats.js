// Statistiques des 14 jours : un graphique par indicateur, détail d'un jour, comparaison de deux jours.
import { dateKey, esc, r0, r1, fmtDate, fmtKg } from '../util.js';
import { lineChart, barChart, multiLine } from '../charts.js';
import { icon, sheet } from '../ui.js';
import * as store from '../store.js';
import { dayScore, challengeIndex, keyForIndex, totals, workoutProgress, workoutMinutes, SUCCESS, CHALLENGE_DAYS } from '../score.js';
import { isTrainingType } from '../training.js';
import { waterTarget } from '../nutrition.js';
import { eveningReport, dayStatus } from '../tracking.js';
import { sessionVolume } from './sport.js';

export const state = { a: null, b: null };

// Une ligne par jour du challenge écoulé, avec toutes les valeurs utiles aux graphiques.
export function dailyRows(s) {
  const today = dateKey(); const n = Math.min(CHALLENGE_DAYS, Math.max(0, challengeIndex(s, today)));
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const k = keyForIndex(s, i); const d = s.days[k]; const sc = dayScore(s, k); const t = totals(d);
    const prog = sc.prog; const isT = prog && isTrainingType(prog.type);
    rows.push({ i, k, d, has: !!d, score: sc.total, kcal: r0(t.kcal), p: r0(t.p), c: r0(t.c), f: r0(t.f), water: d?.water || 0, wt: waterTarget(s.targets, isT), steps: d?.steps ?? null,
      sleep: d?.sleep ?? null, recovery: d?.recovery ?? null, weight: d?.weight ?? null, waist: d?.waist ?? null, isT, min: d ? Math.round(workoutMinutes(d, prog)) + (d.cardio || []).reduce((a, c) => a + (Number(c.min) || 0), 0) : 0,
      vol: d && isT ? sessionVolume(d, prog) : 0, perf: d && isT ? (d.workout?.rpe != null ? d.workout.rpe : Math.round(workoutProgress(d, prog).ratio * 10)) : null, ratio: isT ? workoutProgress(d, prog).ratio : null });
  }
  return rows;
}

const sec = (title, body, extra = '') => `<section class="card"><div class="card-h"><h3>${title}</h3>${extra}</div>${body}</section>`;

export function render() {
  const s = store.get(); const T = s.targets; const p = s.profile;
  const rows = dailyRows(s);
  const tip = (r, txt) => `J${r.i} (${fmtDate(r.k, false)}) : ${txt}`;
  const filled = rows.filter((r) => r.has);
  const avg = (f) => { const v = filled.map((r) => r[f]).filter((x) => x != null && x !== 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const bars = (f, cls, fmt) => rows.map((r) => ({ x: r.i, v: r[f] || 0, cls: typeof cls === 'function' ? cls(r) : cls, tip: tip(r, fmt(r)) }));
  const wPts = rows.filter((r) => r.weight != null).map((r) => ({ x: r.i, y: r.weight, label: tip(r, r.weight + ' kg') }));
  const waistPts = rows.filter((r) => r.waist != null).map((r) => ({ x: r.i, y: r.waist, label: tip(r, r.waist + ' cm') }));
  const maxK = Math.max(T.kcal * 1.3, ...rows.map((r) => r.kcal));
  const maxP = Math.max(T.protein * 1.3, ...rows.map((r) => r.p));
  const maxW = Math.max(waterTarget(T, true) * 1.2, ...rows.map((r) => r.water));
  const goal = p.stepsGoal || T.steps; const maxS = Math.max(goal * 1.3, ...rows.map((r) => r.steps || 0));
  const maxM = Math.max(60, ...rows.map((r) => r.min));
  const vols = rows.filter((r) => r.vol > 0);
  const opts = rows.map((r) => `<option value="${r.k}">J${r.i} · ${fmtDate(r.k, false)}</option>`).join('');
  if (!state.a && rows.length) state.a = rows[0].k;
  if (!state.b && rows.length) state.b = rows[rows.length - 1].k;

  return `<header class="topbar"><button class="iconbtn" data-act="nav" data-v="suivi" aria-label="Retour">${icon('back')}</button><div class="title">Statistiques</div><span></span></header>
  ${!rows.length ? '<section class="card"><p class="muted">Le challenge n\'a pas encore commencé.</p></section>' : `
  <section class="card"><div class="grid3 kpis"><div><span>Score moyen</span><b>${avg('score') != null ? r0(avg('score')) : '—'}</b></div><div><span>Kcal moy.</span><b>${avg('kcal') != null ? r0(avg('kcal')) : '—'}</b><small>/ ${T.kcal}</small></div><div><span>Sommeil moy.</span><b>${avg('sleep') != null ? String(r1(avg('sleep'))).replace('.', ',') + ' h' : '—'}</b></div></div>
    <p class="fine">Touche une barre ou un point pour voir la valeur. Le détail complet d'un jour est en bas de page.</p></section>
  ${sec('Poids', lineChart(wPts, { target: p.goalWeight, unit: ' kg', id: 'st-w' }), `<span class="small muted">${wPts.length ? fmtKg(wPts[wPts.length - 1].y) : ''}</span>`)}
  ${sec('Tour de taille', waistPts.length ? lineChart(waistPts, { unit: ' cm', id: 'st-wa', height: 130, yPad: 1 }) : '<div class="chart-empty">Aucune mesure. Ajoute-la dans Suivi → Journal → Mensurations.</div>')}
  ${sec('Score quotidien', barChart(bars('score', (r) => (r.score >= SUCCESS ? 'ok' : r.score >= 50 ? 'mid' : 'ko'), (r) => r.score + '/100'), { max: 100, id: 'st-sc', threshold: SUCCESS }), '<span class="small muted">ligne = 70</span>')}
  ${sec('Calories', barChart(bars('kcal', (r) => (!r.kcal ? '' : Math.abs(r.kcal / T.kcal - 1) <= 0.1 ? 'ok' : r.kcal > T.kcal ? 'ko' : 'mid'), (r) => `${r.kcal} / ${T.kcal} kcal`), { max: maxK, id: 'st-k', threshold: T.kcal }), `<span class="small muted">cible ${T.kcal}</span>`)}
  ${sec('Protéines', barChart(bars('p', (r) => (r.p >= T.protein * 0.9 ? 'ok' : 'mid'), (r) => `${r.p} / ${T.protein} g`), { max: maxP, id: 'st-p', threshold: T.protein }), `<span class="small muted">cible ${T.protein} g</span>`)}
  ${sec('Glucides et lipides', multiLine([{ name: 'Glucides (g)', color: 'var(--blue)', points: filled.filter((r) => r.kcal).map((r) => ({ x: r.i, y: r.c, label: tip(r, r.c + ' g de glucides') })) }, { name: 'Lipides (g)', color: 'var(--amber)', points: filled.filter((r) => r.kcal).map((r) => ({ x: r.i, y: r.f, label: tip(r, r.f + ' g de lipides') })) }], { yMax: Math.max(T.carbs * 1.3, ...rows.map((r) => r.c)), id: 'st-cf' }), `<span class="small muted">cibles ${T.carbs} / ${T.fat} g</span>`)}
  ${sec('Eau', barChart(bars('water', (r) => (r.water >= r.wt * 0.9 ? 'ok' : 'mid'), (r) => `${(r.water / 1000).toFixed(1)} / ${(r.wt / 1000).toFixed(1)} L`), { max: maxW, id: 'st-wa2', threshold: T.water }))}
  ${sec('Pas', barChart(bars('steps', (r) => ((r.steps || 0) >= goal ? 'ok' : 'mid'), (r) => `${(r.steps || 0).toLocaleString('fr-FR')} pas`), { max: maxS, id: 'st-st', threshold: goal }), `<span class="small muted">objectif ${goal.toLocaleString('fr-FR')}</span>`)}
  ${sec('Durée d\'entraînement', barChart(bars('min', (r) => (r.isT ? (r.ratio >= 1 ? 'ok' : 'mid') : 'rec'), (r) => `${r.min} min${r.isT ? '' : ' (récupération)'}`), { max: maxM, id: 'st-m' }), '<span class="small muted">minutes</span>')}
  ${sec('Force (volume par séance)', vols.length ? lineChart(vols.map((r) => ({ x: r.i, y: r.vol, label: tip(r, r.vol.toLocaleString('fr-FR') + ' kg soulevés') })), { unit: ' kg', id: 'st-v', height: 130, yPad: 50 }) : '<div class="chart-empty">Note tes charges et répétitions pendant les séances pour voir ta force évoluer.</div>', '<span class="small muted">kg × reps</span>')}
  ${sec('Sommeil, récupération et performance', multiLine([
    { name: 'Sommeil (h)', color: 'var(--violet)', points: rows.filter((r) => r.sleep != null).map((r) => ({ x: r.i, y: r.sleep, label: tip(r, r.sleep + ' h de sommeil') })) },
    { name: 'Récupération /10', color: 'var(--green)', points: rows.filter((r) => r.recovery != null).map((r) => ({ x: r.i, y: r.recovery, label: tip(r, 'récupération ' + r.recovery + '/10') })) },
    { name: 'Performance /10', color: 'var(--amber)', points: rows.filter((r) => r.perf != null && r.has).map((r) => ({ x: r.i, y: r.perf, label: tip(r, 'séance ' + r.perf + '/10 (RPE ou % réalisé)') })) },
  ], { yMax: 10, id: 'st-slp' }), '')}

  <section class="card"><h3>Détail d'un jour</h3><div class="d14-list">${rows.map((r) => { const st = dayStatus(s, r.k); return `<button class="d14 ${st.status} ${st.recovery ? 'rec' : ''}" data-act="st-day" data-k="${r.k}"><small>J${r.i}</small><b>${r.score}</b></button>`; }).join('')}</div></section>

  <section class="card form"><h3>Comparer deux jours</h3>
    <div class="grid2"><label>Jour A<select data-chg="st-cmp" data-f="a">${opts.replace(`value="${state.a}"`, `value="${state.a}" selected`)}</select></label><label>Jour B<select data-chg="st-cmp" data-f="b">${opts.replace(`value="${state.b}"`, `value="${state.b}" selected`)}</select></label></div>
    ${compareTable(s, state.a, state.b)}</section>`}`;
}

function compareTable(s, a, b) {
  if (!a || !b) return '';
  const A = eveningReport(s, a), B = eveningReport(s, b); const da = s.days[a] || {}, db = s.days[b] || {};
  const L = [['Score', A.score, B.score, '', 1], ['Poids', A.weight, B.weight, ' kg', -1], ['Calories', A.kcal, B.kcal, '', 0], ['Protéines', A.p, B.p, ' g', 1], ['Glucides', A.c, B.c, ' g', 0], ['Lipides', A.f, B.f, ' g', 0],
    ['Eau', A.water, B.water, ' ml', 1], ['Pas', A.steps, B.steps, '', 1], ['Sport', A.sportMin, B.sportMin, ' min', 1], ['Sommeil', A.sleep, B.sleep, ' h', 1], ['Énergie', da.energy, db.energy, '/10', 1], ['Récupération', da.recovery, db.recovery, '/10', 1], ['Taille', da.waist, db.waist, ' cm', -1]];
  return `<table class="wtable"><thead><tr><th></th><th>J${A.i}</th><th>J${B.i}</th><th>Écart</th></tr></thead><tbody>${L.map(([l, x, y, u, dir]) => { const diff = x != null && y != null ? r1(y - x) : null; const good = diff == null || !dir || diff === 0 ? '' : diff * dir > 0 ? 'green' : 'red';
    const f = (v) => String(v).replace('.', ',');
    return `<tr><td>${l}</td><td>${x != null ? f(x) + u : '—'}</td><td>${y != null ? f(y) + u : '—'}</td><td class="${good}">${diff != null ? (diff > 0 ? '+' : '') + f(diff) : '—'}</td></tr>`; }).join('')}</tbody></table>`;
}

export const actions = {
  'st-cmp'(el) { state[el.dataset.f] = el.value; },
  'st-day'(el) {
    const s = store.get(); const R = eveningReport(s, el.dataset.k); const d = s.days[el.dataset.k] || {};
    sheet(`<h3>Jour ${R.i} · ${fmtDate(R.k)}</h3>
      <div class="rep-grid"><div><span>Score</span><b>${R.score}/100</b></div><div><span>Poids</span><b>${R.weight != null ? fmtKg(R.weight) : '—'}</b></div><div><span>Calories</span><b>${R.kcal}</b><small>P ${R.p} · G ${R.c} · L ${R.f}</small></div><div><span>Eau</span><b>${(R.water / 1000).toFixed(1)} L</b></div>
      <div><span>Pas</span><b>${R.steps.toLocaleString('fr-FR')}</b></div><div><span>Sport</span><b>${R.sportMin} min</b><small>${esc(R.training)}</small></div><div><span>Sommeil</span><b>${R.sleep ?? '—'} h</b></div><div><span>Énergie / Récup.</span><b>${d.energy ?? '—'} / ${d.recovery ?? '—'}</b></div></div>
      ${d.comment ? `<p class="small">« ${esc(d.comment)} »</p>` : ''}
      <ul class="checklist">${R.checklist.map((c) => `<li class="${c.done ? 'done' : ''}"><span class="cb">${c.done ? icon('check') : ''}</span><span class="grow">${esc(c.label)}</span><small>${esc(c.info)}</small></li>`).join('')}</ul>
      <div class="row gap"><button class="btn primary grow" data-act="goto-journal" data-k="${R.k}">Ouvrir / modifier ce jour</button><button class="btn ghost" data-act="sheet-close">Fermer</button></div>`);
    return false;
  },
};
