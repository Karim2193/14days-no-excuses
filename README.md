# 14 DAYS — NO EXCUSES

Application personnelle (PWA) de coaching sèche sur 14 jours : nutrition, sport, discipline, coach strict.
Installable sur l'écran d'accueil de l'iPhone, fonctionne hors ligne, sans compte, sans abonnement, sans serveur payant.

## Utilisation sur iPhone
1. Ouvre l'URL de l'app dans **Safari** (ou scanne le QR code).
2. Bouton **Partager** → **« Sur l'écran d'accueil »** → **Ajouter**.
3. Ouvre l'app depuis l'icône, remplis le questionnaire, puis **Réglages → Activer les notifications**.
4. Recommandé : **Réglages → Ajouter les rappels au Calendrier iPhone** (alarmes fiables même app fermée).

## Ce que fait l'application
| Écran | Contenu |
|---|---|
| Accueil | Jour X/14, compte à rebours, poids départ/actuel/cible/écart + courbe, calories consommées/restantes, macros, séance prévue/terminée, pas, durée d'activité, eau, sommeil, score du jour /100 avec points perdus, moyenne 7 j, série, séances manquées, régularité (14 pastilles) |
| Nutrition → Journal | Calculateur : recherche (base locale ~110 aliments crus/cuits + Open Food Facts en ligne), scan code-barres, ajout manuel, grammes, macros instantanées, modification, suppression, remplacement par équivalent, duplication de repas, historique |
| Nutrition → Programme | 14 jours × 4 repas : nom du plat, ingrédients, grammes (cru + équivalent cuit), kcal/P/G/L, préparation ; remplacer un ingrédient ou tout le repas avec recalcul des macros ; « J'ai mangé ce repas » |
| Nutrition → Courses / Batch / Recettes | Liste de courses hebdo cochable + budget estimatif ; batch cooking sur 2-4 jours ; recettes personnelles |
| Sport | Séance du jour (séries, reps, repos, consignes, charges et reps à saisir, cases à cocher), version express, report, excuses, cardio (marche, tapis incliné, vélo, course, durée, intensité), programme 14 jours, historique et progression des charges |
| Coach | Message du jour selon tes données, constats, bilan de discipline, excuses, conversation « Parler à mon coach » (règles locales hors ligne, IA optionnelle) |
| Journal | Calendrier coloré (réussie/moyenne/ratée), poids, pas, sommeil, eau, mensurations, énergie, motivation, état général, écarts, commentaire ; toutes les anciennes journées |
| Corps | Courbe de poids + moyenne 3 jours, tour de taille/poitrine/bras/cuisse, photos privées stockées sur le téléphone |
| Bilan | Rapport 14 jours : poids, taille, perfs, moyennes, séances, journées réussies, score moyen, erreurs, points forts, recommandations ; export PDF/texte |
| Réglages | Profil (recalcul), rappels personnalisables, notifications, export calendrier, clé IA optionnelle, export/import des données |

## Calculs
- **Métabolisme de base** : Mifflin-St Jeor (10×poids + 6,25×taille − 5×âge + 5 homme / −161 femme).
- **TDEE** = BMR × facteur d'activité (1,2 à 1,9).
- **Objectif** = TDEE − 20 % (plafonné à 750 kcal), jamais sous le BMR ni sous 1600 kcal (homme) / 1300 kcal (femme).
- **Protéines** 2 g/kg (poids ajusté si IMC > 25) · **Lipides** ≥ 25 % · **Glucides** = reste · **Eau** 35 ml/kg (+0,5 L les jours d'entraînement).
- Les calories du sport sont des **estimations** (MET) et ne sont **pas** ajoutées au budget alimentaire.
- Objectif « −3 kg » : l'app affiche honnêtement la perte de graisse attendue (≈ déficit × 14 / 7700) et rappelle qu'une partie de la baisse sur la balance est de l'eau/glycogène.

## Score de discipline (/100)
Nutrition 30 (calories ±10 % = 18, protéines ≥ 90 % = 12) · Entraînement/récupération 25 (repos planifié = 25 automatiquement) · Hydratation 10 · Pas 15 · Sommeil 10 (≥ 7 h) · Journal 10. Journée réussie ≥ 70.

## Notifications sur iPhone : ce qui marche vraiment
- iOS 16.4+ et app **ajoutée à l'écran d'accueil** : notifications système autorisables. L'app les déclenche à l'heure prévue **tant qu'elle est ouverte ou en arrière-plan récent**, avec un texte adapté à ta journée (séance non validée, eau en retard, protéines…).
- Une PWA **ne peut pas** programmer seule une notification quand elle est fermée : il faudrait un serveur Web Push permanent. Pas de fausse promesse ici.
- **Alternative fiable** : export `.ics` vers le Calendrier iPhone, alarmes natives à la minute près, téléphone verrouillé compris.
- À l'ouverture, les rappels passés de la journée sont affichés.

## Données
IndexedDB (principal) + copie dans localStorage, sauvegarde automatique à chaque action et à la fermeture, `navigator.storage.persist()`. Les mises à jour de l'app ne touchent jamais aux données (migrations additives). Export/import JSON dans Réglages. Photos : uniquement sur le téléphone.

> Sur iPhone, les données d'une app ajoutée à l'écran d'accueil sont séparées de celles de Safari : utilise toujours l'icône.

## Développement (sur le Mac)
```bash
cd ~/Documents/14days-no-excuses
npm start          # serveur local http://localhost:5173 (aucune dépendance)
npm test           # tests unitaires (calculs, plan, score, coach)
npm install && npx playwright install chromium && npm run test:e2e   # tests navigateur iPhone émulé
```
Stack : HTML/CSS/JavaScript modules natifs, aucune étape de build. Graphiques SVG maison, ZXing (scan) embarqué, Open Food Facts (API publique gratuite).

## Déploiement
Site statique : GitHub Pages (gratuit, HTTPS). À chaque modification : incrémenter `VERSION` dans `sw.js`, pousser sur la branche publiée.
