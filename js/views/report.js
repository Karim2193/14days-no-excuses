// Bilan des 14 jours (provisoire avant la fin), avec graphiques, analyse et export.
import { dateKey, esc, fmtKg, r0, r1, fmtDate } from '../util.js';
import { lineChart, barChart } from '../charts.js';
import { icon, toast } from '../ui.js';
import * as store from '../store.js';
import { stats, weightSeries, measureSeries, totals, keyForIndex, challengeIndex, SUCCESS, CHALLENGE_DAYS } from '../score.js';
import { programDay } from '../training.js';

export function compute(s) {
  const st = stats(s);
  const final = st.iToday > CHALLENGE_DAYS;
  const ws = weightSeries(s).filter((x) => x.i >= 1 && x.i <= 14);
  const w0 = ws.find((x) => x.i === 1)?.w ?? s.profile.weight; const w1 = ws.length ? ws[ws.length - 1].w : null;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const last3 = ws.slice(-3).map((x) => x.w); const first3 = ws.slice(0, 3).map((x) => x.w);
  const waist = measureSeries(s, 'waist').filter((x) => x.i >= 1 && x.i <= 14);
  const waist0 = waist[0]?.v ?? s.profile.waist ?? null; const waist1 = waist.length ? waist[waist.length - 1].v : null;
  const logged = st.rows.filter((r) => s.days[r.k]?.foods?.length);
  const kcalAvg = avg(logged.map((r) => totals(s.days[r.k]).kcal));
  const protAvg = avg(logged.map((r) => totals(s.days[r.k]).p));
  // Performances : charge max première vs dernière fois par exercice
  const perf = {};
  for (const r of st.rows) {
    const prog = programDay(s.profile, r.i); const d = s.days[r.k];
    prog.ex.forEach((e, i) => { const sets = d?.workout?.ex?.[i]?.sets?.filter((x) => x?.kg != null); if (!e.load || !sets?.length) return; const top = Math.max(...sets.map((x) => x.kg)); (perf[e.name] = perf[e.name] || []).push(top); });
  }
  const perfRows = Object.entries(perf).map(([n, a]) => ({ n, first: a[0], last: a[a.length - 1], diff: a[a.length - 1] - a[0], n2: a.length }));
  // Moyenne de chaque composante du score → forces / faiblesses
  const keys = ['nutrition', 'training', 'water', 'activity', 'sleep', 'journal'];
  const pool = st.closed.length ? st.closed : st.rows;
  const comp = keys.map((key) => { const parts = pool.map((r) => r.parts.find((p) => p.key === key)); const max = parts[0]?.max || 1; const a = avg(parts.map((p) => p.pts / p.max)) ?? 0; return { key, label: parts[0]?.label || key, pct: Math.round(a * 100), max }; });
  return { st, final, ws, w0, w1, wDiff: w1 != null ? w1 - w0 : null, trendDiff: first3.length && last3.length ? avg(last3) - avg(first3) : null, waist0, waist1, kcalAvg, protAvg, perfRows, comp };
}

const LABELS = { nutrition: 'nutrition', training: 'entraînements', water: 'hydratation', activity: 'pas quotidiens', sleep: 'sommeil', journal: 'journal' };
const RECO = {
  nutrition: 'Pèse et note chaque repas, et suis le plan : c\'est 30 % de ton score et l\'essentiel du résultat.',
  training: 'Bloque tes séances dans ton agenda à heure fixe et prépare ton sac la veille.',
  water: 'Garde une gourde sur toi et vise un repère par moment de la journée (midi, 16 h, soir).',
  activity: 'Ajoute 20 à 30 minutes de marche après le déjeuner ou le dîner.',
  sleep: 'Fixe une heure de coucher et coupe les écrans 30 minutes avant.',
  journal: 'Remplis le journal chaque soir à 22 h 30, ça prend 60 secondes.',
};

export function render() {
  const s = store.get(); const R = compute(s); const st = R.st; const T = s.targets;
  const sorted = [...R.comp].sort((a, b) => b.pct - a.pct);
  const strengths = sorted.filter((c) => c.pct >= 75).slice(0, 3); const weak = sorted.filter((c) => c.pct < 70).reverse().slice(0, 3);
  const bars = st.rows.map((r) => ({ x: String(r.i), v: r.total, cls: r.total >= SUCCESS ? 'ok' : r.total >= 50 ? 'mid' : 'ko', tip: `J${r.i} : ${r.total}/100` }));
  const errors = [];
  if (st.missed.length) errors.push(`${st.missed.length} séance(s) manquée(s) : ${st.missed.map((m) => 'J' + m.i).join(', ')}.`);
  if (R.kcalAvg != null && R.kcalAvg > T.kcal * 1.1) errors.push(`Calories moyennes au-dessus de l'objectif (${r0(R.kcalAvg)} vs ${T.kcal} kcal).`);
  if (R.kcalAvg != null && R.kcalAvg < T.kcal * 0.8) errors.push(`Calories moyennes trop basses (${r0(R.kcalAvg)} kcal) : risque de perte musculaire et de fatigue.`);
  if (R.protAvg != null && R.protAvg < T.protein * 0.85) errors.push(`Protéines insuffisantes en moyenne (${r0(R.protAvg)} g vs ${T.protein} g).`);
  const devs = st.rows.filter((r) => s.days[r.k]?.deviation).length; if (devs) errors.push(`${devs} journée(s) avec écart alimentaire.`);
  for (const w of weak) errors.push(`Point faible : ${LABELS[w.key]} (${w.pct} % des points).`);
  return `<header class="topbar"><button class="iconbtn" data-act="nav" data-v="home" aria-label="Retour">${icon('back')}</button><div class="title">${R.final ? 'Bilan final' : 'Bilan provisoire'}</div><button class="iconbtn" data-act="report-share" aria-label="Exporter">${icon('copy')}</button></header>
  <div class="report-page" id="report">
  <section class="card hero-report"><div class="eyebrow">${R.final ? '14 jours terminés' : `Jour ${Math.min(14, st.iToday)}/14 · rapport complet à la fin du challenge`}</div><h1>${st.avgAll}<span>/100</span></h1><p class="muted">score moyen de discipline</p>
    <div class="grid3 kpis"><div><span>Journées réussies</span><b>${st.successes}</b><small>/ ${st.rows.length}</small></div><div><span>Séances faites</span><b>${st.sessionsDone}</b><small>/ ${st.sessionsPlanned} prévues</small></div><div><span>Régularité</span><b>${st.regularity} %</b></div></div></section>
  <section class="card"><h3>Poids</h3><div class="grid3 kpis"><div><span>Initial</span><b>${fmtKg(R.w0)}</b></div><div><span>Final</span><b>${fmtKg(R.w1)}</b></div><div><span>Différence</span><b class="${R.wDiff < 0 ? 'green' : ''}">${R.wDiff == null ? '—' : (R.wDiff > 0 ? '+' : '') + r1(R.wDiff).toString().replace('.', ',') + ' kg'}</b></div></div>
    ${lineChart(R.ws.map((x) => ({ x: x.i, y: x.w, label: `J${x.i} : ${x.w} kg` })), { target: s.profile.goalWeight, unit: ' kg', id: 'rw' })}
    <p class="fine">Tendance (moyenne 3 premiers vs 3 derniers jours) : ${R.trendDiff == null ? '—' : (R.trendDiff > 0 ? '+' : '') + r1(R.trendDiff) + ' kg'}. Sur 14 jours, une partie de la variation vient de l'eau et du glycogène : ce n'est pas une mesure certaine de perte de graisse. Le déficit moyen prévu correspondait à ≈ ${T.fatLoss14} kg de graisse.</p></section>
  <section class="card"><h3>Tour de taille</h3><div class="grid3 kpis"><div><span>Début</span><b>${R.waist0 ?? '—'}${R.waist0 ? ' cm' : ''}</b></div><div><span>Fin</span><b>${R.waist1 ?? '—'}${R.waist1 ? ' cm' : ''}</b></div><div><span>Évolution</span><b>${R.waist0 && R.waist1 ? (R.waist1 - R.waist0 > 0 ? '+' : '') + r1(R.waist1 - R.waist0) + ' cm' : '—'}</b></div></div></section>
  <section class="card"><h3>Nutrition</h3><div class="grid2 kpis"><div><span>Calories moyennes</span><b>${R.kcalAvg == null ? '—' : r0(R.kcalAvg)}</b><small>/ ${T.kcal} kcal</small></div><div><span>Protéines moyennes</span><b>${R.protAvg == null ? '—' : r0(R.protAvg) + ' g'}</b><small>/ ${T.protein} g</small></div></div></section>
  <section class="card"><h3>Scores jour par jour</h3>${st.rows.length ? barChart(bars, { threshold: SUCCESS, id: 'rs' }) : '<p class="muted small">Pas encore de journée.</p>'}
    <p class="small muted">Meilleur jour : ${st.best ? `J${st.best.i} (${st.best.total})` : '—'} · Pire jour : ${st.worst ? `J${st.worst.i} (${st.worst.total})` : '—'}</p></section>
  <section class="card"><h3>Performances</h3>${R.perfRows.length ? `<ul class="hist">${R.perfRows.map((p) => `<li><span>${esc(p.n)}</span><span>${p.first} → ${p.last} kg <b class="${p.diff > 0 ? 'green' : ''}">${p.diff > 0 ? '+' : ''}${p.diff}</b></span></li>`).join('')}</ul>` : '<p class="muted small">Aucune charge enregistrée.</p>'}</section>
  <section class="card"><h3>Répartition des points</h3><ul class="score-parts">${R.comp.map((c) => `<li><div class="row between"><span>${esc(c.label)}</span><b>${c.pct} %</b></div><div class="pbar-track"><div class="pbar-fill" style="width:${c.pct}%"></div></div></li>`).join('')}</ul></section>
  <section class="card"><h3>Points forts</h3>${strengths.length ? `<ul class="insights">${strengths.map((c) => `<li class="tone-good">${esc(LABELS[c.key])} : ${c.pct} % des points.</li>`).join('')}</ul>` : '<p class="muted small">Aucun point fort net pour l\'instant. Ça se construit.</p>'}</section>
  <section class="card"><h3>Analyse des erreurs</h3>${errors.length ? `<ul class="insights">${errors.map((e) => `<li class="tone-warn">${esc(e)}</li>`).join('')}</ul>` : '<p class="good small">Rien à signaler. Exécution propre.</p>'}</section>
  <section class="card"><h3>Recommandations pour la suite</h3><ul class="insights">${(weak.length ? weak : sorted.slice(-2)).map((w) => `<li class="tone-info">${esc(RECO[w.key])}</li>`).join('')}
    <li class="tone-info">Pour continuer : relance un cycle de 14 jours avec ton nouveau poids (Réglages → Profil). Les objectifs seront recalculés. Garde le même déficit modéré, pas plus.</li>
    <li class="tone-info">Coach : ${st.avgAll >= 80 ? 'tu as tenu. Maintenant, prouve que ce n\'était pas un coup de chance.' : st.avgAll >= 60 ? 'correct. Corrige tes deux points faibles et recommence.' : 'tu n\'as pas encore trouvé ton rythme. Recommence, plus simple, mais sans rien lâcher.'}</li></ul></section>
  </div>
  <div class="row gap-s wrap"><button class="btn primary grow" data-act="report-print">Exporter en PDF</button><button class="btn ghost grow" data-act="report-share">Partager le texte</button></div>`;
}

export function reportText(s) {
  const R = compute(s); const st = R.st;
  return [`14 DAYS — NO EXCUSES · ${R.final ? 'Bilan final' : 'Bilan provisoire'} (${fmtDate(dateKey())})`,
    `Poids : ${fmtKg(R.w0)} → ${fmtKg(R.w1)} (${R.wDiff == null ? '—' : r1(R.wDiff) + ' kg'})`,
    `Tour de taille : ${R.waist0 ?? '—'} → ${R.waist1 ?? '—'} cm`,
    `Calories moy. : ${R.kcalAvg == null ? '—' : r0(R.kcalAvg)} kcal · Protéines moy. : ${R.protAvg == null ? '—' : r0(R.protAvg)} g`,
    `Séances : ${st.sessionsDone}/${st.sessionsPlanned} · Journées réussies : ${st.successes}/${st.rows.length}`,
    `Score moyen : ${st.avgAll}/100 · Régularité : ${st.regularity} %`,
    ...R.perfRows.map((p) => `${p.n} : ${p.first} → ${p.last} kg`),
    'Note : une variation de poids sur 14 jours inclut eau et glycogène, ce n\'est pas uniquement de la graisse.'].join('\n');
}

export const actions = {
  'report-print'() { window.print(); return false; },
  async 'report-share'() {
    const txt = reportText(store.get());
    try { if (navigator.share) await navigator.share({ title: 'Mon bilan 14 DAYS', text: txt }); else { await navigator.clipboard.writeText(txt); toast('Bilan copié', 'good'); } } catch {}
    return false;
  },
};
