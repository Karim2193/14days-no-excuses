// Programme sportif 14 jours : musculation (salle), cardio, marche, récupération.
const E = (name, sets, reps, rest, cue, o = {}) => ({ name, sets, reps, rest, cue, load: true, ...o });

const SESSIONS = {
  A: {
    title: 'Full body A — Force', type: 'muscu', met: 5,
    ex: (lv) => [
      lv === 'debutant' ? E('Goblet squat (haltère)', 3, '10-12', 90, 'Haltère contre la poitrine, descends hanches sous les genoux, dos droit, talons au sol.') : E('Squat barre', lv === 'avance' ? 5 : 4, '6-8', 120, 'Gainage fort, descends sous la parallèle si ta mobilité le permet, pousse dans les talons.'),
      lv === 'debutant' ? E('Chest press machine', 3, '10-12', 90, 'Omoplates serrées, pousse sans verrouiller les coudes.') : E('Développé couché', 4, '6-8', 120, 'Omoplates serrées, barre au bas des pectoraux, pieds ancrés.'),
      E('Rowing barre (ou machine)', 3, '8-10', 90, 'Buste penché à 45°, tire vers le nombril, pas d\'élan.'),
      E('Développé militaire haltères', 3, '8-10', 90, 'Assis ou debout, abdos serrés, ne cambre pas.'),
      E('Gainage planche', 3, '40 s', 45, 'Corps aligné, fesses serrées, respire.', { load: false }),
    ],
  },
  B: {
    title: 'Full body B — Hypertrophie', type: 'muscu', met: 5,
    ex: (lv) => [
      E('Soulevé de terre roumain', lv === 'debutant' ? 3 : 4, '8-10', 120, 'Hanches vers l\'arrière, barre près des jambes, dos neutre, étirement des ischios.'),
      E('Tirage vertical poulie', 3, '10-12', 90, 'Tire vers le haut de la poitrine, coudes vers les hanches.'),
      E('Développé incliné haltères', 3, '10-12', 90, 'Banc à 30°, descente contrôlée 2 s.'),
      E('Fentes marchées haltères', 3, '10 / jambe', 90, 'Grand pas, genou arrière proche du sol, buste droit.'),
      E('Élévations latérales', 3, '12-15', 60, 'Coudes légèrement fléchis, monte jusqu\'aux épaules, pas plus.'),
      E('Crunch à la poulie', 3, '12-15', 45, 'Enroule la colonne, ne tire pas avec les bras.'),
    ],
  },
  C: {
    title: 'Full body C — Métabolique', type: 'muscu', met: 6,
    ex: (lv) => [
      E('Presse à cuisses', 3, '10-12', 90, 'Pieds largeur d\'épaules, ne décolle pas le bas du dos.'),
      E(lv === 'debutant' ? 'Tractions assistées (machine)' : 'Tractions', 3, lv === 'debutant' ? '8-10' : 'max - 2', 90, 'Amplitude complète, menton au-dessus de la barre.'),
      E('Pompes (ou dips)', 3, 'max - 2', 75, 'Corps gainé, poitrine proche du sol.', { load: false }),
      E('Hip thrust', 3, '10-12', 90, 'Dos sur le banc, pousse avec les fessiers, pause 1 s en haut.'),
      E('Superset curl biceps + extension triceps', 3, '12 + 12', 60, 'Enchaîne les deux sans pause, repos après.'),
      E('Farmer walk', 3, '40 m', 60, 'Haltères lourds, épaules basses, marche gainée.'),
    ],
  },
  LISS: {
    title: 'Cardio — Tapis incliné', type: 'cardio', met: 6,
    ex: (lv, wk) => [
      E('Échauffement marche', 1, '5 min', 0, 'Marche facile, 0 % inclinaison.', { load: false }),
      E('Tapis incliné', 1, `${(lv === 'debutant' ? 25 : 35) + (wk === 2 ? 5 : 0)} min`, 0, 'Inclinaison 8-12 %, 5-5,5 km/h. Ne tiens pas les barres. Tu dois pouvoir parler en phrases courtes.', { load: false }),
      E('Retour au calme + étirements', 1, '5 min', 0, 'Mollets, ischios, fléchisseurs de hanche.', { load: false }),
    ],
  },
  HIIT: {
    title: 'Cardio — Intervalles vélo', type: 'cardio', met: 8,
    ex: (lv, wk) => lv === 'debutant' ? [
      E('Vélo modéré', 1, `${30 + (wk === 2 ? 5 : 0)} min`, 0, 'Intensité 6/10 constante, cadence 80-90 tr/min.', { load: false }),
      E('Gainage latéral', 3, '30 s / côté', 30, 'Hanches hautes, corps aligné.', { load: false }),
    ] : [
      E('Échauffement vélo', 1, '5 min', 0, 'Progressif.', { load: false }),
      E('Intervalles 30 s fort / 90 s facile', 1, `${wk === 2 ? 10 : 8} rounds`, 0, 'Fort = 8-9/10, facile = 3/10. Arrête si douleur thoracique ou vertige.', { load: false }),
      E('Retour au calme', 1, '5 min', 0, 'Pédale tranquille, respire.', { load: false }),
      E('Gainage latéral', 3, '30 s / côté', 30, 'Hanches hautes, corps aligné.', { load: false }),
    ],
  },
  RECUP: {
    title: 'Récupération active', type: 'recup', met: 3,
    ex: () => [
      E('Marche extérieure', 1, '40 min', 0, 'Rythme soutenu mais confortable. Ça compte dans tes pas.', { load: false }),
      E('Mobilité hanches & épaules', 1, '10 min', 0, '90/90, cat-cow, rotations thoraciques, dislocations avec élastique.', { load: false }),
      E('Étirements doux', 1, '10 min', 0, 'Ischios, quadriceps, pectoraux, 30-45 s par position.', { load: false }),
    ],
  },
  REPOS: {
    title: 'Repos planifié', type: 'repos', met: 2,
    ex: () => [
      E('Marche légère', 1, '20-30 min', 0, 'Juste bouger. Objectif de pas maintenu.', { load: false }),
      E('Coucher à l\'heure', 1, '7 h 30 de sommeil', 0, 'Le muscle se construit pendant que tu dors.', { load: false }),
    ],
  },
};

// Nombre de séances/semaine = musculation + cardio structuré. La marche quotidienne s'ajoute tous les jours.
const PATTERNS = {
  3: ['A', 'RECUP', 'B', 'RECUP', 'C', 'RECUP', 'REPOS'],
  4: ['A', 'LISS', 'B', 'RECUP', 'C', 'RECUP', 'REPOS'],
  5: ['A', 'LISS', 'B', 'RECUP', 'C', 'HIIT', 'REPOS'],
  6: ['A', 'LISS', 'B', 'HIIT', 'C', 'LISS', 'REPOS'],
};

export function programDay(profile, dayIndex) {
  const n = Math.max(3, Math.min(6, Number(profile.sessions) || 4));
  const pat = PATTERNS[n];
  const code = pat[(dayIndex - 1) % 7];
  const wk = dayIndex > 7 ? 2 : 1;
  const lv = profile.level || 'intermediaire';
  const s = SESSIONS[code];
  let ex = s.ex(lv, wk).map((e) => ({ ...e }));
  if (wk === 2 && s.type === 'muscu') {
    ex = ex.map((e) => (e.load ? { ...e, note: 'Semaine 2 : si tu as réussi toutes les reps la semaine 1, +2,5 kg (ou +1 rep).' } : e));
  }
  const dur = estimateDuration(ex, s.type);
  return { code, title: s.title, type: s.type, met: s.met, week: wk, ex, duration: dur };
}

export function estimateDuration(ex, type) {
  if (type !== 'muscu') {
    return ex.reduce((m, e) => { const x = /(\d+)\s*min/.exec(e.reps); const r = /(\d+) rounds/.exec(e.reps); return m + (x ? +x[1] : r ? r[1] * 2 : e.sets * 1.5); }, 0);
  }
  return Math.round(10 + ex.reduce((m, e) => m + (e.sets * (45 + e.rest)) / 60, 0));
}

export const sessionKcal = (met, kg, minutes) => Math.round((met - 1) * kg * (minutes / 60)); // net, estimation

export const CARDIO_TYPES = [
  ['marche', 'Marche', [3.0, 3.8, 4.8]],
  ['tapis', 'Tapis incliné', [4.5, 6.0, 8.0]],
  ['velo', 'Vélo', [4.0, 6.8, 9.5]],
  ['course', 'Course', [7.0, 9.0, 11.0]],
];
export const INTENSITIES = ['Faible', 'Modérée', 'Élevée'];
export function cardioKcal(type, intensity, minutes, kg) {
  const t = CARDIO_TYPES.find((c) => c[0] === type) || CARDIO_TYPES[0];
  return sessionKcal(t[2][intensity] || t[2][1], kg, minutes);
}

export const isTrainingType = (t) => t === 'muscu' || t === 'cardio';
export const TYPE_LABEL = { muscu: 'Musculation', cardio: 'Cardio', recup: 'Récupération', repos: 'Repos' };
