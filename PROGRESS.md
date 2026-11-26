# PROGRESS — 14 DAYS — NO EXCUSES

_Dernière mise à jour : 2026-11-26 (UTC)_

## État actuel
Application **fonctionnelle et testée** (v1.1.0, module SUIVI QUOTIDIEN ajouté). Reste : **mise en ligne HTTPS** (GitHub Pages), en attente du dépôt GitHub.

## Fonctionnalités terminées
- [x] Architecture PWA (manifest, service worker hors ligne, icônes iOS, plein écran)
- [x] Questionnaire initial + modification du profil (âge, sexe, taille, poids, cible, niveau, activité, séances, préférences, allergies, dégoûts, heure d'entraînement, heure de coucher)
- [x] Calculs : Mifflin-St Jeor, TDEE, déficit plafonné, calories, protéines, glucides, lipides, eau ; analyse honnête de l'objectif −3 kg
- [x] Tableau de bord complet (jour, compte à rebours, poids, nutrition, activité, discipline, régularité)
- [x] Calculateur alimentaire : recherche locale + Open Food Facts, scan code-barres (ZXing), manuel, modifier, supprimer, remplacer, dupliquer, historique, crus/cuits
- [x] Programme alimentaire 14 jours, remplacement d'ingrédients/repas avec macros recalculées, préparation, liste de courses + budget, batch cooking, recettes perso
- [x] Programme sportif 14 jours (muscu A/B/C, cardio, récup, repos), progression semaine 2, cases à cocher, charges/reps, historique, séances restantes, section cardio
- [x] Coach : messages selon les données, séances manquées, reports, excuses (douleur/maladie → repos sans pénalité), bilan de discipline, chat local + IA optionnelle
- [x] Rappels configurables, notifications iOS (app ouverte), rappels manqués, rappel spécial séance non validée, export calendrier .ics
- [x] Journal + calendrier, mensurations, photos locales
- [x] Score /100 détaillé, moyenne 7 j, meilleur/pire jour, régularité, historique
- [x] Bilan 14 jours (graphiques, erreurs, points forts, recommandations, export PDF/texte)
- [x] Sauvegarde IndexedDB + localStorage, export/import JSON
- [x] **v1.1.0 SUIVI QUOTIDIEN** (onglet « Suivi » : remplace « Journal », l'ancien lien #journal redirige) :
  - check-in du matin (poids + heure de pesée, comparaison veille / départ 77 kg, avertissement fluctuations), sommeil (coucher/réveil → durée auto, qualité /10, réveils, fatigue), énergie, motivation, récupération, courbatures /10, humeur
  - compteur d'eau +150/250/330/500/autre (max 1,5 L par saisie, alerte au-delà de 5 L/j), historique horodaté, % objectif
  - activité : pas, distance (saisie ou estimée : pas × 0,415 × taille), durée sportive
  - tableau de contrôle 8 objectifs coché automatiquement (aussi sur l'accueil), bilan du soir « BILAN DU JOUR X/14 » (chiffres + bien fait / raté / à améliorer / point faible / priorité), copiable
  - calendrier 14 jours (complète / partielle / non renseignée / R = récupération), tout jour passé est ouvrable et modifiable
  - écran Statistiques : poids, taille, score, calories, protéines, glucides+lipides, eau, pas, durée, force (volume), sommeil/récupération/performance ; détail d'un jour ; comparaison de 2 jours
  - nutrition : heure de chaque aliment, fibres, catégorie « Extras », répartition des macros en %, copier un repas d'un autre jour
  - sport : bouton Démarrer/Terminer + heures modifiables, durée réelle → dépense estimée, case par série + minuteur de repos, RPE /10, comparaison avec la séance précédente du même type
  - corps : ventre, hanches, tableau semaine par semaine, photos par pose (face/profil/dos) avec avant/maintenant côte à côte
  - coach : analyse des tendances sur 3 jours (sous/sur-alimentation, protéines, séances ratées, sommeil, récupération, hydratation, progrès poids/taille, habitudes qui montent ou baissent)
  - rappels ajoutés : hydratation 11 h et 14 h 30 (seulement si en retard sur le rythme), dîner 20 h, journal 22 h ; tous réglables
  - migration automatique sans perte : énergie/motivation /5 → /10, eau → historique

## Profil réel (corrigé le 2026-11-26)
- 23 ans, 174 cm, 77 kg, cible 74 kg (−3 kg), homme, modérément actif (modifiable dans Réglages).
- BMR Mifflin-St Jeor = 10×77 + 6,25×174 − 5×23 + 5 = **1748 kcal** · TDEE ×1,55 = **2709 kcal**
- Objectif **2170 kcal** (déficit 539 kcal) · Protéines **152 g** · Glucides **253 g** · Lipides **61 g** · Eau **2,7 L** (3,2 L jours d'entraînement)
- Le formulaire du premier lancement est pré-rempli avec ces valeurs. Tout profil stocké à 86 kg / 178 cm (anciennes valeurs de test) est corrigé automatiquement au démarrage, objectifs et programme des jours restants recalculés, historique conservé.
- Les valeurs 86 kg / 178 cm n'existaient que dans les tests et un exemple ; elles ne sont plus utilisées nulle part (sauf la condition de migration dans `js/store.js`).

## Fonctionnalités restantes
- [ ] Publier sur GitHub Pages → URL HTTPS + QR code (bloqué : il faut que Karim connecte GitHub à Claude et crée le dépôt public `14days-no-excuses`)
- [ ] Test réel sur iPhone (installation écran d'accueil, notification de test) une fois en ligne

## Tests (dernier passage)
- `npm test` : 34/34 tests unitaires réussis (calculs, plans, programme, score, coach, sommeil, eau, distance, contrôle, bilan du soir, tendances du coach, migration v1.1).
- `tests/e2e.cjs` (Chromium, iPhone 14 émulé) : 82/82 réussis (dont chaque champ du suivi, eau, sommeil auto, échelles /10, contrôle, bilan, statistiques, Extras/fibres, séries/RPE/durée, ventre/hanches, photos par pose, modification d'un jour passé, absence de débordement sur 6 écrans, migration du profil), dont fermeture complète du navigateur puis réouverture (données intactes), reprise depuis IndexedDB seul, fonctionnement hors ligne, aucune erreur JS.
- Non testable hors iPhone réel : notification système iOS, ajout à l'écran d'accueil, caméra (scan).

## Erreurs rencontrées → solutions
- Débordement horizontal (champs kg/reps, rappels) → `min-width: 0` sur les champs + grilles `minmax(0,1fr)`.
- Conflit de classe `.wrap` (conteneur vs flex-wrap) → conteneur renommé `.appwrap`.
- Avalanche de « rappels manqués » le jour 1 → les rappels déjà passés au moment de l'inscription sont ignorés ; max 3 affichés.
- Classe `.check` partagée (case exercice vs libellé) → libellé renommé `.checkline`.
- Programme : « 4 séances/sem. » donnait 5 séances → motifs hebdo corrigés (séances = muscu + cardio structuré).
- Saisie dans le Suivi : un re-rendu immédiat fermait le clavier iOS → enregistrement immédiat, affichage rafraîchi à la sortie du champ.
- Heures (input time) trop larges sur 3 colonnes → 2 colonnes.
- Le terminal du Mac (VM Claude) n'a pas d'accès internet : dépendances/tests navigateur exécutés côté cloud, tests unitaires et serveur local exécutés sur le Mac.

## Fichiers
```
index.html, manifest.webmanifest, sw.js, server.mjs, package.json, README.md, PROGRESS.md
css/app.css
icons/ (icon-192, icon-512, icon-maskable-512, apple-touch-icon)
js/app.js (navigation, événements)  js/store.js (IndexedDB)  js/util.js  js/ui.js  js/charts.js
js/foods.js (base nutritionnelle)  js/nutrition.js (calculs)  js/meals.js (générateur de repas)
js/training.js (programme)  js/score.js (score/statistiques)  js/coach.js (coach)  js/notify.js (rappels, .ics)  js/off.js (Open Food Facts, scan)
js/tracking.js (suivi quotidien, bilan du soir)
js/views/ home, nutrition, sport, suivi, stats, coach, body, report, settings, onboarding
js/vendor/zxing.min.js
tests/unit.mjs, tests/e2e.cjs
```

## Commandes utiles
```bash
npm start      # http://localhost:5173
npm test       # tests unitaires
npm run test:e2e   # après npm install && npx playwright install chromium
```
Déploiement : incrémenter `VERSION` dans `sw.js`, puis pousser sur GitHub (Pages).

## Étape exacte à reprendre
Créer/obtenir le dépôt GitHub `14days-no-excuses`, pousser ce dossier, activer GitHub Pages (branche `main`, dossier racine), vérifier l'URL HTTPS, générer le QR code (`qrcode.png`), mettre à jour ce fichier.
