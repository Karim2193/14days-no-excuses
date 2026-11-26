// Coach disciplinaire : moteur de règles local (fonctionne hors ligne) + IA optionnelle via clé API.
// Règle d'or : pression sur les ACTES, jamais d'attaque sur le physique, la valeur ou la santé.
import { dateKey, addDays, nowMinutes, hhmmToMin, r0, pick, norm } from './util.js';
import { dayScore, stats, totals, challengeIndex, keyForIndex, workoutProgress, currentWeight, trendWeight, SUCCESS } from './score.js';
import { isTrainingType, programDay } from './training.js';
import { waterTarget } from './nutrition.js';

const seedOf = (k) => k.split('-').reduce((a, x) => a + Number(x), 0);

export const LINES = {
  noSession: [
    'Encore une excuse ? Tu avais un objectif et tu savais ce que tu devais faire. Arrête de négocier avec toi-même et bouge-toi.',
    'Tes résultats ne vont pas apparaître pendant que tu restes sur ton canapé. Lève-toi et va t\'entraîner.',
    'Ta séance ne va pas se faire toute seule. Le sac, les chaussures, la porte. Maintenant.',
    'Tu as signé pour 14 jours, pas pour 14 jours « quand j\'ai envie ». Va à la salle.',
  ],
  postponed: [
    'Tu repousses encore ? Tu veux des résultats, mais tu ne veux pas respecter ton programme. Il est temps de changer ça.',
    'Tu négocies encore avec toi-même ? C\'est exactement comme ça que tu rates tes objectifs. Arrête de discuter et passe à l\'action.',
    '« Plus tard », c\'est le mot préféré de ceux qui abandonnent. Fixe une heure et tiens-la.',
  ],
  dayDone: [
    'Bien. Tu as fait ce que tu avais promis. Maintenant, garde cette régularité.',
    'Bien. Tu as fait ce que tu avais promis. Maintenant, recommence demain.',
    'Journée validée. Pas de fête : demain, même exigence.',
  ],
  streak: [
    'Tu commences enfin à être régulier. Ne gâche pas tes efforts maintenant.',
    'Tu commences à devenir régulier. Ne gâche pas tes efforts maintenant.',
    'Série en cours. C\'est maintenant que la plupart lâchent. Pas toi.',
  ],
  overKcal: [
    'Aujourd\'hui, tu as dépassé ton objectif. Ce n\'est pas une catastrophe, mais assume et reprends le contrôle dès le prochain repas.',
    'Objectif calorique dépassé. Pas de drame, pas de compensation punitive : prochain repas propre, et on avance.',
  ],
  sessionDone: [
    'Séance faite. Voilà ce que fait quelqu\'un qui tient parole.',
    'Séance validée. Le reste de la journée doit être au même niveau.',
  ],
  morning: [
    'Jour {i}/14. Personne ne viendra le faire à ta place.',
    'Jour {i}/14. Tu connais le plan. Exécute.',
    'Jour {i}/14. La motivation, c\'est pour commencer. La discipline, c\'est pour finir.',
  ],
};

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Analyse complète de la journée → message principal + constats.
export function analyze(s, now = new Date()) {
  const k = dateKey(now);
  const i = challengeIndex(s, k);
  const seed = seedOf(k);
  const insights = [];
  if (i < 1) return { main: { tone: 'info', text: `Le challenge commence le ${s.profile.startDate}. Prépare tes courses et ton sac.` }, insights };
  if (i > 14) {
    const st = stats(s);
    return { main: { tone: 'info', text: `Challenge terminé. Score moyen ${st.avgAll}/100, ${st.successes} journées réussies. Lis ton bilan, puis décide : on relance 14 jours ?` }, insights, finished: true };
  }
  const sc = dayScore(s, k);
  const st = stats(s, k);
  const d = s.days[k];
  const prog = sc.prog;
  const T = s.targets;
  const min = nowMinutes(now);
  const trainMin = hhmmToMin(s.profile.trainTime || '18:30');
  const isTrain = isTrainingType(prog.type);
  const wp = workoutProgress(d, prog);
  const t = totals(d);
  let main = null;

  // Séances manquées (passé)
  const yKey = addDays(k, -1);
  const yRow = st.rows.find((r) => r.k === yKey);
  if (st.missed.length) {
    const lastMiss = st.missed[st.missed.length - 1];
    insights.push({ tone: 'warn', text: `${st.missed.length} séance(s) manquée(s) depuis le début${lastMiss.k === yKey ? ', dont hier' : ''}. Elle ne se rattrape pas en culpabilisant : elle se rattrape en venant aujourd'hui.` });
  }
  // Séance du jour
  if (isTrain && !d?.workout?.converted) {
    if (wp.ratio >= 1) insights.push({ tone: 'good', text: pick(LINES.sessionDone, seed) });
    else if (d?.workout?.postponed >= 1 && min >= trainMin - 60) main = { tone: 'push', text: pick(LINES.postponed, seed + d.workout.postponed) };
    else if (min >= trainMin + 30 && wp.ratio < 1) main = { tone: 'push', text: pick(LINES.noSession, seed) };
    else if (wp.ratio < 1) insights.push({ tone: 'info', text: `Aujourd'hui : ${prog.title} (~${prog.duration} min). Prévu à ${s.profile.trainTime || '18:30'}.` });
  } else if (prog.type === 'repos' || prog.type === 'recup') {
    insights.push({ tone: 'info', text: `Jour de ${prog.type === 'repos' ? 'repos planifié' : 'récupération active'} : aucun point perdu. Mais les pas, l'eau et la nutrition restent obligatoires.` });
  }
  // Pesée
  if (d?.weight == null && min < 12 * 60) insights.push({ tone: 'warn', text: 'Pas encore de pesée ce matin. Balance, avant de manger, et note-la.' });
  // Nutrition
  if (t.kcal > T.kcal * 1.1) { main = main || { tone: 'warn', text: pick(LINES.overKcal, seed) }; }
  if (min >= 18 * 60 && t.p < T.protein * 0.7) insights.push({ tone: 'warn', text: `Protéines à ${r0(t.p)} g sur ${T.protein} g. Il te reste un dîner pour corriger : viande blanche, poisson, œufs ou skyr.` });
  if (min >= 20 * 60 && t.kcal < T.kcal * 0.7 && d?.foods?.length) insights.push({ tone: 'warn', text: 'Tu es très en dessous de ton objectif calorique. Manger trop peu n\'est pas de la discipline : ça coûte du muscle et de l\'énergie. Mange ton dîner complet.' });
  // Eau
  const wt = waterTarget(T, isTrain);
  if (min >= 15 * 60 && (d?.water || 0) < wt * 0.5) insights.push({ tone: 'warn', text: `${((d?.water || 0) / 1000).toFixed(1)} L d'eau à cette heure-ci. Objectif ${(wt / 1000).toFixed(1)} L. Bois maintenant.` });
  // Sommeil
  if (d?.sleep != null && d.sleep < 6) insights.push({ tone: 'info', text: `${d.sleep} h de sommeil. Ce soir, coucher à ${s.profile.bedTime || '23:00'} au plus tard. Si la séance est lourde, garde les charges et réduis d'une série.` });
  // Pas
  if (min >= 19 * 60 && (d?.steps || 0) < (s.profile.stepsGoal || T.steps) * 0.6) insights.push({ tone: 'warn', text: 'Tes pas sont en retard. 25 minutes de marche après le dîner, sans discuter.' });
  // Score et série
  if (sc.total >= SUCCESS && (!isTrain || wp.ratio >= 1 || d?.workout?.converted)) main = main || { tone: 'good', text: pick(st.streak >= 3 ? LINES.streak : LINES.dayDone, seed) };
  if (!main && st.streak >= 3) main = { tone: 'good', text: pick(LINES.streak, seed) };
  if (!main) main = { tone: 'info', text: fill(pick(LINES.morning, seed), { i }) };
  // Tendances sur plusieurs jours
  for (const pt of patterns(s, now)) insights.push(pt);
  // Bilan d'hier
  if (yRow) insights.push({ tone: yRow.total >= SUCCESS ? 'good' : 'warn', text: `Hier : ${yRow.total}/100. ${yRow.total >= SUCCESS ? 'Journée réussie.' : 'Journée ratée. ' + biggestLoss(yRow)}` });
  return { main, insights, score: sc, stats: st };
}

// Analyse des tendances sur les derniers jours terminés (3 jours glissants) : le coach repère les habitudes.
export function patterns(s, now = new Date()) {
  const k = dateKey(now); const T = s.targets; const out = [];
  const st = stats(s, k);
  const last = st.closed.slice(-3).filter((r) => s.days[r.k]);
  if (last.length < 2) return out;
  const D = last.map((r) => ({ r, d: s.days[r.k], t: totals(s.days[r.k]) }));
  const logged = D.filter((x) => x.d.foods?.length);
  const n = last.length;
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  if (logged.length >= 2) {
    const kc = avg(logged.map((x) => x.t.kcal));
    if (kc < T.kcal * 0.8) out.push({ key: 'under', tone: 'warn', text: `Tu manges trop peu depuis ${logged.length} jours (${r0(kc)} kcal en moyenne pour ${T.kcal}). Ce n'est pas plus rapide : tu perds du muscle, de l'énergie et tu prépares le craquage. Mange ton plan en entier.` });
    else if (kc > T.kcal * 1.1) out.push({ key: 'over', tone: 'warn', text: `Tu dépasses ton objectif depuis ${logged.length} jours (${r0(kc)} kcal en moyenne pour ${T.kcal}). Repère le repas qui dérape et pèse-le, sans te priver le lendemain.` });
    const pr = avg(logged.map((x) => x.t.p));
    if (pr < T.protein * 0.85) out.push({ key: 'prot', tone: 'warn', text: `Protéines trop basses sur ${logged.length} jours (${r0(pr)} g en moyenne pour ${T.protein} g). Ajoute un skyr ou une portion de viande blanche par jour.` });
  } else out.push({ key: 'nolog', tone: 'warn', text: 'Tu ne notes presque plus tes repas. Sans données, je ne peux pas t\'aider et toi non plus.' });
  const missed = last.filter((r) => r.prog && isTrainingType(r.prog.type) && !s.days[r.k]?.workout?.converted && workoutProgress(s.days[r.k], r.prog).ratio < 0.5);
  if (missed.length >= 2) out.push({ key: 'missed', tone: 'push', text: `${missed.length} séances ratées sur les ${n} derniers jours. Ce n'est plus un accident, c'est une habitude. Prochaine séance : heure fixée, sac prêt la veille.` });
  const sl = D.map((x) => x.d.sleep).filter((x) => x != null);
  if (sl.length >= 2 && avg(sl) < 6.5) out.push({ key: 'sleep', tone: 'warn', text: `Sommeil moyen ${String(Math.round(avg(sl) * 10) / 10).replace('.', ',')} h sur ${sl.length} nuits. Le manque de sommeil augmente la faim et baisse la performance. Coucher 30 min plus tôt ce soir.` });
  const rc = D.map((x) => x.d.recovery).filter((x) => x != null); const so = D.map((x) => x.d.soreness).filter((x) => x != null);
  if ((rc.length >= 2 && avg(rc) <= 4) || (so.length >= 2 && avg(so) >= 7)) out.push({ key: 'recovery', tone: 'info', text: 'Ta récupération est mauvaise ces derniers jours. Ce n\'est pas de la faiblesse : garde tes charges mais retire une série, dors plus, et respecte les jours de récupération. Ils font partie du programme.' });
  const wa = D.map((x) => (x.d.water || 0) / waterTarget(T, x.r.prog && isTrainingType(x.r.prog.type)));
  if (avg(wa) < 0.7) out.push({ key: 'water', tone: 'warn', text: `Hydratation insuffisante depuis ${n} jours (${Math.round(avg(wa) * 100)} % de l'objectif en moyenne). Une gourde sur le bureau, remplie à chaque repas. Pas besoin de plus.` });
  // Progrès physiques : moyenne des 3 dernières pesées vs 3 premières
  const ws = Object.keys(s.days).filter((x) => s.days[x].weight != null && challengeIndex(s, x) >= 1).sort().map((x) => s.days[x].weight);
  if (ws.length >= 5) { const a = avg(ws.slice(0, 3)), b = avg(ws.slice(-3)); if (b < a - 0.3) out.push({ key: 'progress', tone: 'good', text: `Tendance du poids : ${String(Math.round((b - a) * 10) / 10).replace('.', ',')} kg (moyenne de 3 pesées). Ça avance. Continue exactement pareil.` }); }
  const ws2 = Object.keys(s.days).filter((x) => s.days[x].waist != null).sort().map((x) => s.days[x].waist);
  if (ws2.length >= 2 && ws2[ws2.length - 1] < ws2[0]) out.push({ key: 'waist', tone: 'good', text: `Tour de taille : ${String(Math.round((ws2[ws2.length - 1] - ws2[0]) * 10) / 10).replace('.', ',')} cm depuis la première mesure. C'est de la graisse, pas de l'eau.` });
  // Habitudes qui s'améliorent : score des 3 derniers jours vs 3 précédents
  const prev = st.closed.slice(-6, -3);
  if (prev.length >= 2) { const a = avg(prev.map((r) => r.total)), b = avg(last.map((r) => r.total)); if (b >= a + 8) out.push({ key: 'better', tone: 'good', text: `Ton score moyen monte : ${r0(a)} → ${r0(b)}. Tes habitudes s'installent.` }); else if (b <= a - 10) out.push({ key: 'worse', tone: 'push', text: `Ton score moyen baisse : ${r0(a)} → ${r0(b)}. Le relâchement commence toujours comme ça. On resserre aujourd'hui.` }); }
  return out;
}

export function biggestLoss(row) {
  const p = [...row.parts].sort((a, b) => (b.max - b.pts) - (a.max - a.pts))[0];
  return p && p.max - p.pts > 0 ? `Plus grosse perte : ${p.label.toLowerCase()} (-${p.max - p.pts} pts${p.why ? ', ' + p.why : ''}).` : '';
}

// Bilan de discipline (texte).
export function disciplineReport(s) {
  const st = stats(s);
  const k = dateKey();
  const sc = dayScore(s, k);
  const lines = [];
  lines.push(`Aujourd'hui : ${sc.total}/100.`);
  for (const p of sc.parts) if (p.pts < p.max) lines.push(`• ${p.label} : ${p.pts}/${p.max}${p.why ? ' (' + p.why + ')' : ''}`);
  lines.push(`Moyenne 7 jours : ${st.avg7}/100 · Régularité : ${st.regularity} % · Série : ${st.streak} jour(s).`);
  lines.push(`Séances faites : ${st.sessionsDone} · Manquées : ${st.missed.length}.`);
  if (st.avg7 >= 80) lines.push('Verdict : tu es dans le rythme. Ne baisse pas la garde.');
  else if (st.avg7 >= 60) lines.push('Verdict : correct, pas suffisant. Corrige ton point le plus faible dès demain.');
  else lines.push('Verdict : tu fais le minimum. Le challenge n\'est pas perdu, mais il le sera si tu continues comme ça.');
  return lines.join('\n');
}

// Excuses : réponses du coach (douleur / maladie → protection de la santé, pas de pression).
export const EXCUSES = [
  ['temps', 'Pas le temps'], ['fatigue', 'Trop fatigué'], ['motivation', 'Pas motivé'], ['meteo', 'Il fait froid / il pleut'],
  ['social', 'Sortie / imprévu'], ['douleur', 'Douleur / blessure'], ['malade', 'Malade / fièvre'],
];
export function excuseReply(type, s) {
  switch (type) {
    case 'temps': return { text: 'Pas le temps ? Tu as le temps de scroller. Version express : les 3 premiers exercices, 2 séries chacun, 25 minutes. Pas de séance parfaite, une séance faite.', action: 'express' };
    case 'fatigue': {
      const sl = s.days[dateKey()]?.sleep;
      return { text: sl != null && sl < 6 ? `Tu as dormi ${sl} h : fatigue réelle. Séance allégée autorisée (-1 série par exercice, mêmes charges). Et ce soir, coucher tôt.` : 'Fatigue ou flemme ? Échauffe-toi 10 minutes. Si après ça tu es toujours vidé, séance allégée. Neuf fois sur dix, la fatigue disparaît à la deuxième série.' };
    }
    case 'motivation': return { text: 'La motivation, tu l\'attendras longtemps. Tu n\'as pas besoin d\'avoir envie, tu as besoin d\'y aller. Mets ta tenue, c\'est tout ce que je te demande. Le reste suivra.' };
    case 'meteo': return { text: 'La salle a un toit. Prends un sweat et vas-y.' };
    case 'social': return { text: 'Les imprévus existent. Déplace la séance à une heure précise aujourd\'hui ou fais la version express maintenant. « Demain » n\'est pas une option.', action: 'express' };
    case 'douleur': return { text: 'Là, je ne négocie pas dans l\'autre sens : une douleur n\'est pas une excuse, c\'est un signal. Pas de charge sur la zone touchée. Marche douce si c\'est indolore. Si la douleur est vive, persiste ou gonfle, consulte un médecin ou un kiné. Ta séance est convertie en récupération, sans pénalité.', action: 'convert' };
    case 'malade': return { text: 'Malade, tu te reposes. Pas d\'entraînement avec de la fièvre. Hydrate-toi, mange normalement, dors. Si ça dure ou s\'aggrave, consulte. Séance convertie en récupération, sans pénalité. On reprend quand tu es rétabli.', action: 'convert' };
    default: return { text: 'Je t\'écoute. Mais à la fin, soit tu y vas, soit tu assumes.' };
  }
}

export function deviationReply() {
  return 'Un écart ne ruine pas 14 jours. Ce qui les ruine, c\'est le « tant pis, la journée est foutue ». Note-le, assume, et prochain repas normal. Pas de jeûne punitif, pas de compensation.';
}

// Texte dynamique des rappels selon les résultats du jour.
export function reminderText(s, r, now = new Date()) {
  const k = dateKey(now);
  const d = s.days[k];
  const i = challengeIndex(s, k);
  const prog = i >= 1 && i <= 14 ? programDay(s.profile, i) : null;
  const t = totals(d);
  const T = s.targets;
  switch (r.id) {
    case 'pesee': return d?.weight != null ? `Pesée faite (${d.weight} kg). Maintenant, petit-déjeuner du plan.` : `Jour ${i}/14. ${r.text}`;
    case 'nutri': return `${T.kcal} kcal · ${T.protein} g de protéines aujourd'hui. ${r.text}`;
    case 'eau': { const wt = waterTarget(T, prog && isTrainingType(prog.type)); const w = d?.water || 0; return w < wt * 0.45 ? `Seulement ${(w / 1000).toFixed(1)} L. Tu sais très bien que c'est insuffisant. Bois et prends ta collation.` : r.text; }
    case 'sport': return prog && isTrainingType(prog.type) ? `${prog.title} : ${r.text}` : 'Jour de récupération : marche et étirements. Pas de séance lourde aujourd\'hui.';
    case 'bilan': return `${r0(t.kcal)} / ${T.kcal} kcal · ${r0(t.p)} g protéines. ${r.text}`;
    case 'discipline': return `Score du jour : ${dayScore(s, k).total}/100. ${r.text}`;
    case 'eau2': case 'eau3': { const wt = waterTarget(T, prog && isTrainingType(prog.type)); const w = d?.water || 0; const exp = expectedWater(wt, now); return `${(w / 1000).toFixed(1)} L bus, ${(exp / 1000).toFixed(1)} L attendus à cette heure. Un grand verre maintenant, puis selon ta soif.`; }
    case 'diner': return `Il te reste ${Math.max(0, r0(T.kcal - t.kcal))} kcal et ${Math.max(0, r0(T.protein - t.p))} g de protéines pour le dîner. ${r.text}`;
    case 'journal': { const sc = dayScore(s, k); const j = sc.parts.find((p) => p.key === 'journal'); return j && j.pts < j.max ? `Suivi incomplet (${j.why}). ${r.text}` : 'Suivi complet. Regarde ton bilan du jour et prépare demain.'; }
    case 'seance_nv': return 'Ta séance n\'est toujours pas validée. Encore une excuse ? Il reste du temps : version express si besoin, mais tu y vas.';
    default: return r.text;
  }
}
export function reminderShouldFire(s, r, now = new Date()) {
  if (!r.on) return false;
  if (!r.conditional) return true;
  const k = dateKey(now);
  const i = challengeIndex(s, k);
  if (i < 1 || i > 14) return false;
  const prog = programDay(s.profile, i);
  const d = s.days[k];
  if (r.id === 'eau2' || r.id === 'eau3') return (d?.water || 0) < expectedWater(waterTarget(s.targets, isTrainingType(prog.type)), now) * 0.8; // seulement si en retard
  return isTrainingType(prog.type) && !d?.workout?.converted && workoutProgress(d, prog).ratio < 1;
}
// Rythme d'hydratation attendu : réparti linéairement de 8 h à 21 h.
export function expectedWater(target, now = new Date()) { const m = now.getHours() * 60 + now.getMinutes(); return Math.round(target * Math.max(0, Math.min(1, (m - 480) / 780))); }

// ——— Conversation « Parler à mon coach » ———
export function contextSummary(s) {
  const k = dateKey();
  const sc = dayScore(s, k);
  const st = stats(s, k);
  const p = s.profile; const T = s.targets;
  return [
    `Jour ${sc.index}/14. Poids départ ${p.weight} kg, actuel ${currentWeight(s)} kg (moyenne 3 j ${trendWeight(s).toFixed(1)}), cible ${p.goalWeight} kg.`,
    `Objectifs : ${T.kcal} kcal, P ${T.protein} g, G ${T.carbs} g, L ${T.fat} g, eau ${T.water} ml.`,
    `Aujourd'hui : ${r0(sc.totals.kcal)} kcal, P ${r0(sc.totals.p)} g, eau ${s.days[k]?.water || 0} ml, pas ${s.days[k]?.steps || 0}, sommeil ${s.days[k]?.sleep ?? '?'} h.`,
    `Séance du jour : ${sc.prog?.title} (${sc.prog?.type}), avancement ${Math.round(workoutProgress(s.days[k], sc.prog).ratio * 100)} %.`,
    `Score du jour ${sc.total}/100 ; moyenne 7 j ${st.avg7} ; série ${st.streak} ; séances manquées ${st.missed.length}.`,
    (() => { const d = s.days[k] || {}; return `Ressenti (/10) : énergie ${d.energy ?? '?'}, motivation ${d.motivation ?? '?'}, récupération ${d.recovery ?? '?'}, courbatures ${d.soreness ?? '?'}, qualité sommeil ${d.sleepQuality ?? '?'}. RPE séance ${d.workout?.rpe ?? '?'}.`; })(),
    `Tendances : ${patterns(s).map((x) => x.key).join(', ') || 'aucune'}.`,
  ].join('\n');
}

const has = (t, words) => words.some((w) => t.includes(w));
export function localReply(s, text) {
  const t = norm(text);
  const k = dateKey();
  const sc = dayScore(s, k);
  const T = s.targets;
  const rest = { kcal: T.kcal - sc.totals.kcal, p: T.protein - sc.totals.p };
  if (has(t, ['suicid', 'me faire du mal', 'en finir', 'mourir'])) return 'Là, on met le challenge de côté. Si tu traverses un moment très dur, parle à quelqu\'un maintenant : en France, le 3114 (numéro national de prévention du suicide) répond 24h/24. Si tu es ailleurs, appelle les urgences locales. Tu comptes plus que n\'importe quel objectif.';
  if (has(t, ['douleur', 'mal au', 'blesse', 'blessure', 'malade', 'fievre'])) return excuseReply(has(t, ['malade', 'fievre']) ? 'malade' : 'douleur', s).text + ' (Tu peux le valider avec le bouton « J\'ai une excuse » de la séance.)';
  if (has(t, ['bilan', 'resume', 'analyse', 'resultat', 'score'])) return disciplineReport(s);
  if (has(t, ['manger', 'faim', 'repas', 'quoi manger', 'diner', 'dejeuner', 'collation', 'grignot'])) {
    if (rest.kcal <= 100) return `Tu es à ${r0(sc.totals.kcal)} kcal sur ${T.kcal}. Si tu as faim : légumes à volonté, un grand verre d'eau, ou un skyr nature (63 kcal/100 g). Rien d'autre ce soir.`;
    return `Il te reste environ ${r0(rest.kcal)} kcal et ${Math.max(0, r0(rest.p))} g de protéines. ${rest.p > 30 ? 'Priorité protéines : 150-200 g de blanc de poulet, de cabillaud ou de tofu, avec des légumes.' : 'Ton repas du plan suffit : ouvre l\'onglet Nutrition et suis-le.'} Si la faim te travaille : légumes, eau, et tu manges lentement.`;
  }
  if (has(t, ['stagne', 'stagnation', 'poids ne bouge', 'pris du poids', 'grossi', 'balance'])) return 'La balance varie de 0,5 à 1,5 kg d\'un jour à l\'autre : eau, sel, glucides, transit, entraînement. Ce n\'est pas de la graisse. Regarde la moyenne sur 3 jours dans l\'onglet Corps. Si elle ne baisse pas en 7 jours alors que ton score nutrition est au max, on parlera ajustement. Pas avant. Et on ne coupe pas l\'eau.';
  if (has(t, ['fatigue', 'creve', 'epuise', 'sommeil', 'dormi'])) return excuseReply('fatigue', s).text;
  if (has(t, ['motiv', 'envie', 'flemme', 'abandon', 'lacher', 'arreter'])) return 'Tu veux abandonner ? Normal, c\'est le moment où ça devient utile. Tu n\'as pas besoin de motivation, tu as besoin de la prochaine action : la prochaine bouteille d\'eau, le prochain repas pesé, la prochaine séance. Une à la fois. Tu ne lâches pas.';
  if (has(t, ['seance', 'entrain', 'muscu', 'salle', 'cardio', 'modifier', 'changer', 'exercice'])) {
    const prog = sc.prog;
    return `Aujourd'hui : ${prog.title} (~${prog.duration} min). On ne change pas le programme parce qu'il est dur. On l'adapte seulement si : douleur (exercice remplacé ou séance convertie), sommeil < 6 h (-1 série), ou matériel indisponible (variante haltères/machine). Sinon, tu fais ce qui est écrit.`;
  }
  if (has(t, ['ecart', 'craque', 'pizza', 'burger', 'alcool', 'biere', 'fast'])) return deviationReply();
  if (has(t, ['eau', 'boire', 'hydrat'])) return `Objectif eau : ${(T.water / 1000).toFixed(1)} L (+0,5 L les jours d'entraînement). Une gourde de 750 ml remplie 4 fois, c'est tout. Ne te déshydrate jamais pour « perdre » sur la balance : c'est faux et dangereux.`;
  if (has(t, ['3 kg', '3kg', 'objectif', 'perdre', 'secher', 'seche'])) return `Ton déficit est d'environ ${T.deficit} kcal/jour, soit environ ${s.targets.fatLoss14} kg de graisse en 14 jours. Sur la balance, la baisse peut être plus grande (eau, glycogène). Pour maximiser : score nutrition au max, ${(s.profile.stepsGoal || T.steps).toLocaleString('fr-FR')} pas par jour, protéines tous les jours, 7 h de sommeil. Pas de restriction supplémentaire.`;
  if (has(t, ['merci', 'ok', 'compris', 'ca marche'])) return 'Ne me remercie pas. Exécute.';
  return `Je suis ton coach, pas ton ami. Pose-moi une question précise : « quoi manger ce soir », « bilan de ma journée », « je suis fatigué », « mon poids stagne », « dois-je modifier ma séance ». En attendant : ton score est à ${sc.total}/100.`;
}

export const SYSTEM_PROMPT = `Tu es le coach du challenge « 14 DAYS — NO EXCUSES ». Personnalité : strict, exigeant, direct, provocateur, en français, tutoiement, phrases courtes.
Règles absolues : tu peux taquiner et mettre la pression sur les ACTES (séances, repas, eau, pas, sommeil), mais tu n'humilies jamais sur le physique, la valeur personnelle ou la santé.
Jamais de restriction extrême, de jeûne punitif, de déshydratation, de diurétiques ou de méthode dangereuse. Douleur, blessure, maladie : tu recommandes repos et avis médical. Détresse psychologique : tu arrêtes le coaching et orientes vers le 3114 (France) ou les urgences.
Ne présente jamais une variation de poids rapide comme une perte de graisse certaine. Réponds en 120 mots maximum, avec des actions concrètes.`;

export async function aiReply(s, history) {
  const key = s.settings.apiKey;
  if (!key) throw new Error('no-key');
  const msgs = history.slice(-12).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: s.settings.apiModel || 'claude-haiku-5-5', max_tokens: 400, system: SYSTEM_PROMPT + '\n\nDonnées actuelles de l\'utilisateur :\n' + contextSummary(s), messages: msgs }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  const j = await res.json();
  return j.content?.map((c) => c.text || '').join('').trim() || '…';
}
