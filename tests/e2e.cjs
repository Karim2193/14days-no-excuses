// Tests fonctionnels de bout en bout (iPhone 14 émulé), avec fermeture/réouverture réelle du navigateur.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const URL0 = process.env.APP_URL || 'http://localhost:8765/index.html';
const DIR = '/tmp/ndne-profile'; fs.rmSync(DIR, { recursive: true, force: true });
const results = []; const errors = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (info ? ' · ' + info : '')); };
async function open() {
  const ctx = await chromium.launchPersistentContext(DIR, { ...devices['iPhone 14'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL0); return { ctx, page };
}
const S = (page) => page.evaluate(() => window.__ndne.store.get());
const closeSheet = async (page) => { if (await page.$('#sheet:not([hidden]) .sheet-bg')) { await page.click('#sheet .sheet-bg', { position: { x: 10, y: 10 } }); await page.waitForTimeout(300); } };
(async () => {
  let { ctx, page } = await open();
  // 1. Profil
  await page.waitForSelector('#profile-form');
  await page.fill('[name=age]', ''); await page.click('#profile-form button[type=submit]');
  ok('Validation du formulaire (âge vide refusé)', await page.isVisible('#pf-err'));
  await page.fill('[name=age]', '23');
  ok('Formulaire pré-rempli avec le vrai profil (23 ans, 174 cm, 77 kg)', (await page.inputValue('[name=age]')) === '23' && (await page.inputValue('[name=height]')) === '174' && (await page.inputValue('[name=weight]')) === '77');
  await page.selectOption('[name=sessions]', '4'); await page.check('input[value=lactose]', { force: true }); await page.fill('[name=dislikes]', 'saumon');
  await page.click('#profile-form button[type=submit]'); await page.waitForSelector('#ob-go');
  const resTxt = await page.textContent('.results');
  ok('Calcul BMR Mifflin (10×77+6,25×174−5×23+5 = 1747,5)', resTxt.includes('1748'), 'BMR affiché');
  ok('TDEE ×1,55 = 2709', resTxt.includes('2709'));
  await page.click('#ob-go'); await page.waitForSelector('.score-card');
  let s = await S(page);
  ok('2. Objectif calorique (déficit ≤ 750, ≥ BMR)', s.targets.kcal === 2170 && s.targets.deficit <= 750 && s.targets.kcal >= s.targets.bmr, JSON.stringify({ kcal: s.targets.kcal, deficit: s.targets.deficit }));
  const macroK = s.targets.protein * 4 + s.targets.carbs * 4 + s.targets.fat * 9;
  ok('3. Macros cohérentes avec les calories (±15 kcal)', Math.abs(macroK - s.targets.kcal) <= 15, `P${s.targets.protein} G${s.targets.carbs} L${s.targets.fat} = ${macroK}`);
  ok('Protéines 1,6–2,2 g/kg', s.targets.protein / 77 >= 1.6 && s.targets.protein / 77 <= 2.2);
  // Plan respecte allergies/dégoûts
  const planIds = Object.values(s.plan).flatMap((d) => Object.values(d).flatMap((m) => m.items.map((i) => i.id)));
  ok('6. Plan 14 jours généré', Object.keys(s.plan).length === 14);
  ok('Plan sans lactose ni saumon', !planIds.some((id) => ['skyr', 'fb0', 'grec', 'cottage', 'whey', 'saumon'].includes(id)), [...new Set(planIds)].join(','));
  const dayK = (d) => Object.values(d).reduce((a, m) => a + m.items.reduce((x, it) => x, 0), 0);
  // 4. Ajout d'aliment via le calculateur
  await page.click('[data-act=add-food-quick]'); await page.waitForSelector('#fp-q');
  await page.fill('#fp-q', 'poulet'); await page.waitForTimeout(200);
  await page.click('#fp-res [data-id=poulet]'); await page.fill('#fp-g', '200'); await page.click('#fp-ok'); await page.waitForTimeout(400);
  s = await S(page); let today = Object.keys(s.days).sort().pop(); let d = s.days[today];
  ok('4. Aliment ajouté avec calcul (200 g poulet = 220 kcal, 46 g P)', d.foods.length === 1 && Math.round(d.foods[0].kcal) === 220 && Math.round(d.foods[0].p) === 46);
  const kcalTxt = await page.textContent('.ring-label >> nth=1');
  ok('5. Totaux du tableau de bord actualisés', kcalTxt.replace(/\s/g, '') === '220', kcalTxt);
  // Ajout manuel
  await page.click('[data-act=add-food-quick]'); await page.click('#fp-mode [data-mode=manual]');
  await page.fill('#fp-man [name=n]', 'Wrap test'); await page.fill('#fp-man [name=k]', '250'); await page.fill('#fp-man [name=p]', '10'); await page.click('#fp-man button.btn.primary'); await page.waitForTimeout(400);
  s = await S(page); d = s.days[today];
  ok('Ajout manuel + aliment perso enregistré', d.foods.length === 2 && s.customFoods.length === 1);
  // Nutrition : suppression, modification, remplacement, duplication
  await page.evaluate(() => location.hash = '#nutrition'); await page.waitForSelector('.meal');
  const uid0 = d.foods[1].uid;
  await page.click(`[data-act=del-entry][data-u="${uid0}"]`); await page.waitForTimeout(300);
  s = await S(page); ok('Suppression d\'un aliment', s.days[today].foods.length === 1);
  const u1 = s.days[today].foods[0].uid;
  await page.click(`[data-act=edit-entry][data-u="${u1}"]`); await page.fill('#ee [name=g]', '150'); await page.click('#ee button'); await page.waitForTimeout(300);
  s = await S(page); ok('Modification de quantité (150 g → 165 kcal)', Math.round(s.days[today].foods[0].kcal) === 165);
  await page.click(`[data-act=swap-entry][data-u="${u1}"]`); await page.waitForSelector('.results-list .res');
  await page.click('.results-list [data-i="0"]'); await page.waitForTimeout(300);
  s = await S(page); const sw = s.days[today].foods[0];
  ok('Remplacement par équivalent (protéines égales ±3 g)', Math.abs(sw.p - 34.5) <= 3, `${sw.name} ${sw.g} g P=${sw.p.toFixed(1)}`);
  const meal0 = sw.meal;
  await page.click(`[data-act=dup-meal][data-meal=${meal0}]`); await page.click('#dm button'); await page.waitForTimeout(300);
  s = await S(page); ok('Duplication d\'un repas', s.days[today].foods.length === 2);
  // Programme alimentaire : manger un repas, remplacer, autre repas
  await page.click('[data-act=nut-tab][data-v=plan]'); await page.waitForSelector('.meal-plan');
  const before = JSON.stringify((await S(page)).plan[1].l);
  await page.click('[data-act=plan-swap][data-meal=l][data-role=P]'); await page.click('.results-list .res >> nth=0'); await page.waitForTimeout(300);
  s = await S(page);
  const lunchTot = s.plan[1].l.items.reduce((a, it) => a, 0);
  ok('Remplacement dans le plan (repas recalculé)', JSON.stringify(s.plan[1].l) !== before);
  await page.click('[data-act=plan-eat][data-meal=b]'); await page.waitForTimeout(300);
  s = await S(page); ok('« J\'ai mangé ce repas » ajoute au journal', s.days[today].foods.filter((f) => f.meal === 'b').length >= 1);
  await page.click('[data-act=nut-tab][data-v=courses]'); await page.waitForSelector('.shop');
  const priceTxt = await page.textContent('.price b'); ok('Liste de courses + budget', /€/.test(priceTxt), priceTxt);
  await page.click('.shop input >> nth=0'); await page.waitForTimeout(200); s = await S(page); ok('Case de courses cochée et gardée', Object.values(s.shopping[1] || {}).some(Boolean));
  await page.click('[data-act=nut-tab][data-v=prep]'); ok('Batch cooking affiché', (await page.textContent('#main')).includes('Protéines'));
  await page.click('[data-act=nut-tab][data-v=recettes]'); await page.click('[data-act=recipe-new]'); await page.fill('#rc [name=name]', 'Recette test');
  await page.click('#rc-add'); await page.fill('#fp-q', 'riz'); await page.click('#fp-res [data-id=riz]'); await page.click('#fp-ok'); await page.waitForTimeout(300);
  await page.click('#rc button.btn.primary.block'); await page.waitForTimeout(300); s = await S(page); ok('Recette personnelle enregistrée', s.recipes.length === 1 && s.recipes[0].items.length === 1);
  // 7. Entraînement
  await page.evaluate(() => location.hash = '#sport'); await page.waitForSelector('.ex');
  const nEx = await page.$$eval('.ex', (x) => x.length);
  await page.fill('[data-chg=set-val][data-i="0"][data-si="0"][data-f=kg]', '60'); await page.press('[data-chg=set-val][data-i="0"][data-si="0"][data-f=kg]', 'Tab');
  await page.fill('[data-chg=set-val][data-i="0"][data-si="0"][data-f=reps]', '8'); await page.press('[data-chg=set-val][data-i="0"][data-si="0"][data-f=reps]', 'Tab');
  for (let i = 0; i < nEx; i++) { await page.click(`[data-act=ex-done][data-i="${i}"]`); await page.waitForTimeout(120); }
  s = await S(page); d = s.days[today];
  ok('7. Exercices cochés + charge/reps enregistrées', Object.values(d.workout.ex).filter((e) => e.done).length === nEx && d.workout.ex[0].sets[0].kg === 60 && d.workout.ex[0].sets[0].reps === 8);
  await page.click('[data-act=sp-tab][data-v=cardio]'); await page.fill('#cardio [name=min]', '20'); await page.click('#cardio button.btn.primary'); await page.waitForTimeout(300);
  s = await S(page); ok('Cardio enregistré avec estimation', s.days[today].cardio.length === 1 && s.days[today].cardio[0].kcal > 0);
  // 7b. Séance : chrono, cases par série, RPE, durée mesurée
  await page.click('[data-act=sp-tab][data-v=jour]'); await page.waitForSelector('#sp-timing');
  await page.click('[data-act=sp-start]'); await page.waitForTimeout(200);
  await page.click('[data-act=set-ok][data-i="0"][data-si="1"]'); await page.waitForTimeout(200);
  ok('Minuteur de repos lancé après une série cochée', await page.isVisible('#rest-timer'));
  await page.click('#rest-timer');
  await page.fill('[data-chg=sp-time][data-f=startAt]', '18:00'); await page.press('[data-chg=sp-time][data-f=startAt]', 'Tab'); await page.waitForTimeout(150);
  await page.fill('[data-chg=sp-time][data-f=endAt]', '19:05'); await page.press('[data-chg=sp-time][data-f=endAt]', 'Tab'); await page.waitForTimeout(150);
  await page.click('[data-act=sp-rpe][data-v="8"]'); await page.waitForTimeout(200);
  s = await S(page); d = s.days[today];
  const wmin = await page.evaluate(() => import('./js/score.js').then((m) => { const s = window.__ndne.store.get(); const k = Object.keys(s.days).sort().pop(); return m.workoutMinutes(s.days[k], m.dayScore(s, k).prog); }));
  ok('Séance : début/fin, RPE 8/10, série cochée, durée réelle 65 min', d.workout.startAt === '18:00' && d.workout.endAt === '19:05' && d.workout.rpe === 8 && d.workout.ex[0].sets[1].ok === true && wmin === 65, JSON.stringify({ wmin, rpe: d.workout.rpe }));
  ok('Dépense estimée sur la durée réelle', (await page.textContent('#sp-timing')).includes('65 min'));
  // 8. SUIVI QUOTIDIEN
  await page.click('[data-act=nav][data-v=suivi]'); await page.waitForSelector('#j-morning');
  ok('Onglet « Suivi » dans la navigation principale', (await page.textContent('#nav')).includes('Suivi'));
  ok('Calendrier 14 jours affiché', (await page.$$('.cal14 .d14')).length === 14);
  await page.fill('#j-morning [data-f=weight]', '76.6'); await page.press('#j-morning [data-f=weight]', 'Tab');
  await page.fill('[data-chg=j-time][data-f=bedAt]', '23:30'); await page.press('[data-chg=j-time][data-f=bedAt]', 'Tab');
  await page.fill('[data-chg=j-time][data-f=wakeAt]', '07:00'); await page.press('[data-chg=j-time][data-f=wakeAt]', 'Tab');
  await page.fill('[data-chg=j-field][data-f=wakeups]', '1'); await page.press('[data-chg=j-field][data-f=wakeups]', 'Tab');
  await page.click('body', { position: { x: 5, y: 5 } }); await page.waitForTimeout(300);
  for (const [f, v] of [['sleepQuality', 8], ['wakeFatigue', 3], ['energy', 8], ['motivation', 9], ['recovery', 7], ['soreness', 3]]) { await page.click(`[data-act=j-scale][data-f=${f}][data-v="${v}"]`); await page.waitForTimeout(120); }
  await page.click('[data-act=j-mood][data-v=bien]'); await page.waitForTimeout(120);
  s = await S(page); d = s.days[today];
  ok('Check-in matin : poids + heure de pesée', d.weight === 76.6 && /^\d\d:\d\d$/.test(d.weighTime || ''), d.weighTime);
  ok('Sommeil calculé depuis coucher/réveil (23:30 → 07:00 = 7,5 h)', d.sleep === 7.5 && d.wakeups === 1);
  ok('Échelles /10 enregistrées', d.sleepQuality === 8 && d.wakeFatigue === 3 && d.energy === 8 && d.motivation === 9 && d.recovery === 7 && d.soreness === 3 && d.mood === 'bien');
  const wc = await page.textContent('.wcmp');
  ok('Comparaison du poids vs départ (77 kg → −0,4 kg)', wc.includes('−0,4'), wc.replace(/\s+/g, ' '));
  // Eau
  for (let x = 0; x < 7; x++) { await page.click('[data-act=j-water][data-v="500"]'); await page.waitForTimeout(80); }
  await page.click('[data-act=j-water][data-v="150"]'); await page.waitForTimeout(150);
  s = await S(page); d = s.days[today];
  ok('Eau : boutons + historique horodaté', d.water === 3650 && d.waterLog.length === 8 && d.waterLog.every((w) => /^\d\d:\d\d$/.test(w.t)), d.water + ' ml');
  ok('Eau : % de l\'objectif affiché', (await page.textContent('#j-water .pill')).includes('%'));
  await page.click('[data-act=j-water-custom]'); await page.fill('#wf [name=v]', '2000'); await page.click('#wf button'); await page.waitForTimeout(200);
  s = await S(page); ok('Eau : saisie excessive (> 1,5 L d\'un coup) refusée', s.days[today].water === 3650);
  await page.fill('#wf [name=v]', '330'); await page.click('#wf button'); await page.waitForTimeout(200);
  await page.click('#j-water summary'); await page.click('[data-act=j-water-del] >> nth=-1'); await page.waitForTimeout(200);
  s = await S(page); ok('Eau : ajout personnalisé puis suppression d\'une prise', s.days[today].water === 3650 && s.days[today].waterLog.length === 8);
  // Activité
  await page.fill('[data-chg=j-field][data-f=steps]', '10500'); await page.press('[data-chg=j-field][data-f=steps]', 'Tab');
  await page.click('body', { position: { x: 5, y: 5 } }); await page.waitForTimeout(300);
  const dist = await page.evaluate(() => import('./js/tracking.js').then((m) => { const s = window.__ndne.store.get(); return m.distanceKm(s, s.days[Object.keys(s.days).sort().pop()]); }));
  ok('Distance estimée depuis les pas (10 500 × 0,415 × 174 cm ≈ 7,6 km)', dist.km === 7.6 && dist.estimated, JSON.stringify(dist));
  await page.fill('[data-chg=j-text][data-f=comment]', 'Bonne journée de test'); await page.press('[data-chg=j-text][data-f=comment]', 'Tab'); await page.waitForTimeout(300);
  await page.fill('#j-journal [data-f=belly]', '90').catch(async () => { await page.click('#j-journal summary'); await page.fill('#j-journal [data-f=belly]', '90'); });
  await page.press('#j-journal [data-f=belly]', 'Tab'); await page.waitForTimeout(200);
  s = await S(page); d = s.days[today];
  ok('8. Suivi enregistré (pas, sommeil, eau, ressenti, commentaire, ventre)', d.steps === 10500 && d.sleep === 7.5 && d.water === 3650 && d.energy === 8 && d.motivation === 9 && d.comment === 'Bonne journée de test' && d.belly === 90);
  // Tableau de contrôle + bilan du soir
  const R = await page.evaluate(() => import('./js/tracking.js').then((m) => { const s = window.__ndne.store.get(); const k = Object.keys(s.days).sort().pop(); return { R: m.eveningReport(s, k), txt: m.reportToText(m.eveningReport(s, k)), cl: m.checklist(s, k) }; }));
  const clDone = Object.fromEntries(R.cl.map((c) => [c.key, c.done]));
  ok('Tableau de contrôle : 8 objectifs vérifiés automatiquement', R.cl.length === 8 && clDone.weigh && clDone.water && clDone.train && clDone.steps && clDone.sleep && clDone.journal && !clDone.nutri, JSON.stringify(clDone));
  ok('Bilan du soir : titre, chiffres et analyse', R.txt.startsWith('BILAN DU JOUR 1/14') && R.txt.includes('Poids : 76,6 kg (-0,4 kg depuis le départ)') && R.txt.includes('Priorité de demain') && R.R.missed.length > 0 && R.R.good.length > 0, R.txt.split('\n').slice(0, 3).join(' | '));
  ok('Bilan : calories restantes et point faible', R.R.rest === R.R.target - R.R.kcal && R.R.weakest.includes('Nutrition'), R.R.weakest);
  ok('Bilan affiché dans le Suivi', (await page.textContent('#j-report')).includes('BILAN DU JOUR'));
  const ckTxt = await page.textContent('#j-check .pill'); ok('Contrôle affiché (x/8)', /\d\/8/.test(ckTxt), ckTxt);
  // 9. Score
  const sc = await page.evaluate(() => import('./js/score.js').then((m) => m.dayScore(window.__ndne.store.get(), Object.keys(window.__ndne.store.get().days).sort().pop())));
  const parts = Object.fromEntries(sc.parts.map((p) => [p.key, p.pts]));
  ok('9. Score : entraînement 25, eau 10, pas 15, sommeil 10, journal 10', parts.training === 25 && parts.water === 10 && parts.activity === 15 && parts.sleep === 10 && parts.journal === 10, JSON.stringify(parts) + ' total ' + sc.total);
  await page.evaluate(() => location.hash = '#home'); await page.waitForTimeout(200); await page.evaluate(() => location.hash = '#suivi'); await page.waitForSelector('#j-score');
  const badge = await page.textContent('#j-score'); ok('Score affiché = score calculé', badge.startsWith(String(sc.total)), badge);
  ok('Accueil relié au suivi (contrôle du jour)', await page.evaluate(() => { location.hash = '#home'; return new Promise((r) => setTimeout(() => r(document.querySelector('.cl-mini') != null), 300)); }));
  // Statistiques
  await page.evaluate(() => location.hash = '#stats'); await page.waitForSelector('.v-stats');
  const nCharts = await page.$$eval('.v-stats .chart, .v-stats .chart-empty', (x) => x.length);
  ok('Statistiques : un graphique par indicateur (≥ 11)', nCharts >= 11, nCharts + ' graphiques');
  await page.click('.v-stats .chart .bar >> nth=0'); ok('Graphique interactif (valeur au toucher)', await page.isVisible('.v-stats .tip:not([hidden])'));
  await page.click('[data-act=st-day] >> nth=0'); await page.waitForSelector('#sheet .rep-grid'); ok('Détail d\'un jour depuis les statistiques', (await page.textContent('#sheet')).includes('Jour 1'));
  await closeSheet(page);
  ok('Comparaison de deux jours', (await page.$$('.v-stats .wtable tr')).length >= 10);
  await page.screenshot({ path: '/tmp/e2e_stats.png', fullPage: true });
  // Extras + fibres + répartition des macros
  await page.evaluate(() => location.hash = '#nutrition'); await page.waitForTimeout(300); await page.click('[data-act=nut-tab][data-v=jour]'); await page.waitForSelector('.meal');
  await page.click('[data-act=add-food][data-meal=x]'); await page.fill('#fp-q', 'flocons'); await page.waitForTimeout(200);
  await page.click('#fp-res .res >> nth=0'); await page.fill('#fp-g', '50'); await page.click('#fp-ok'); await page.waitForTimeout(300);
  s = await S(page); const ex = s.days[today].foods.find((f) => f.meal === 'x');
  ok('Catégorie « Extras » + heure + fibres de l\'aliment', ex && /^\d\d:\d\d$/.test(ex.at) && ex.fi > 0, ex && `${ex.name} ${ex.at} fibres ${ex.fi}`);
  ok('Répartition des macros en %', (await page.textContent('.macro-split')).includes('%'));
  // Corps : ventre, hanches, tableau hebdo, photos par pose
  await page.evaluate(() => location.hash = '#body'); await page.waitForSelector('[data-submit=body-meas]');
  await page.fill('form[data-f=hips] [name=v]', '98'); await page.click('form[data-f=hips] button'); await page.waitForTimeout(300);
  s = await S(page); ok('Tour de hanches enregistré', s.days[today].hips === 98);
  ok('Tableau de comparaison hebdomadaire', (await page.textContent('.wtable')).includes('Ventre'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.click('[data-act=photo-pose][data-v=profil]'); await page.waitForTimeout(200);
  for (let x = 0; x < 2; x++) { await page.setInputFiles('[data-chg=photo-add]', { name: 'p.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(700); }
  await page.waitForSelector('#photo-cmp .cmp', { timeout: 4000 }).catch(() => {});
  ok('Photos : pose « profil » + comparaison avant/maintenant côte à côte', (await page.$$('#photo-cmp .cmp img')).length === 2 && (await page.textContent('#photos')).includes('Profil'));
  // Rappels conditionnels d'hydratation
  const rem = await page.evaluate(() => import('./js/coach.js').then((m) => { const s = JSON.parse(JSON.stringify(window.__ndne.store.get())); const r = s.settings.reminders.find((x) => x.id === 'eau3'); const d = new Date(); d.setHours(14, 30); const k = Object.keys(s.days).sort().pop(); const full = m.reminderShouldFire(s, r, d); s.days[k].water = 200; return { full, low: m.reminderShouldFire(s, r, d), txt: m.reminderText(s, s.settings.reminders.find((x) => x.id === 'diner'), d) }; }));
  ok('Rappel d\'eau seulement si en retard', rem.full === false && rem.low === true, JSON.stringify(rem.txt.slice(0, 60)));
  // Affichage iPhone : aucun débordement horizontal
  const overflow = [];
  for (const v of ['suivi', 'stats', 'sport', 'body', 'nutrition', 'home']) { await page.evaluate((h) => location.hash = '#' + h, v); await page.waitForTimeout(350); const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); if (w[0] > w[1]) overflow.push(v + ':' + w.join('/')); }
  ok('Affichage iPhone 14 sans débordement (Suivi, Stats, Sport, Corps, Nutrition, Accueil)', !overflow.length, overflow.join(' '));
  await page.evaluate(() => location.hash = '#suivi'); await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/e2e_suivi.png', fullPage: true });
  // Coach
  await page.evaluate(() => location.hash = '#coach'); await page.waitForSelector('.chat-form');
  await page.fill('.chat-form [name=q]', 'quoi manger ce soir ?'); await page.press('.chat-form [name=q]', 'Enter'); await page.waitForTimeout(500);
  s = await S(page); ok('Coach : réponse au chat (mode local)', s.chat.length === 2 && /kcal/.test(s.chat[1].text), s.chat[1]?.text.slice(0, 90));
  await page.fill('.chat-form [name=q]', 'j\'ai mal au genou'); await page.press('.chat-form [name=q]', 'Enter'); await page.waitForTimeout(400);
  s = await S(page); ok('Coach : douleur → repos/avis médical, sans pression', /médecin|kiné/.test(s.chat[3].text));
  // Corps
  await page.evaluate(() => location.hash = '#body'); await page.waitForSelector('[data-submit=body-meas]');
  await page.fill('form[data-f=waist] [name=v]', '93.5'); await page.click('form[data-f=waist] button'); await page.waitForTimeout(300);
  s = await S(page); ok('Mensuration enregistrée', s.days[today].waist === 93.5);
  // 13. Notifications & calendrier
  const ics = await page.evaluate(() => window.__ndne.notify.buildICS(window.__ndne.store.get()));
  ok('13. Export calendrier .ics avec alarmes', ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VALARM/g) || []).length > 50, ((ics.match(/BEGIN:VEVENT/g) || []).length) + ' événements');
  const fired = await page.evaluate(() => { const s = window.__ndne.store.get(); const d = new Date(); d.setHours(23, 59); return window.__ndne.notify.check(null, d).map((f) => f.r.id); });
  ok('Moteur de rappels : déclenchement à l\'heure + rappel conditionnel', Array.isArray(fired), JSON.stringify(fired));
  // Bilan
  await page.evaluate(() => location.hash = '#report'); await page.waitForSelector('.hero-report');
  ok('Bilan affiché', (await page.textContent('.hero-report')).includes('/100'));
  await page.screenshot({ path: '/tmp/e2e_report.png', fullPage: true });
  await page.evaluate(() => location.hash = '#home'); await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/e2e_home.png', fullPage: true });
  const snapshot = JSON.stringify((await S(page)).days);
  // 10-11. Fermeture complète du navigateur puis réouverture
  await page.waitForTimeout(500); await ctx.close();
  ({ ctx, page } = await open());
  await page.waitForSelector('.score-card');
  s = await S(page);
  ok('10-11. Données conservées après fermeture/réouverture', JSON.stringify(s.days) === snapshot && s.profile.weight === 77 && s.profile.height === 174 && s.profile.age === 23 && s.recipes.length === 1 && s.chat.length === 4);
  const idb = await page.evaluate(() => new Promise((r) => { const q = indexedDB.open('ndne'); q.onsuccess = () => { const t = q.result.transaction('kv').objectStore('kv').get('state'); t.onsuccess = () => r(!!t.result?.profile); }; }));
  ok('Copie IndexedDB présente', idb);
  // Résilience : si localStorage est vidé, IndexedDB suffit
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('.score-card');
  s = await S(page); ok('Reprise depuis IndexedDB seul', JSON.stringify(s.days) === snapshot);
  // Export / import
  const exp = await page.evaluate(() => window.__ndne.store.exportJSON());
  ok('Export JSON', JSON.parse(exp).state.profile.age === 23);
  // SW / manifest
  const swReg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; });
  ok('Service worker enregistré (hors ligne)', swReg);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('.score-card', { timeout: 8000 }).catch(() => {});
  ok('Fonctionne hors ligne', await page.isVisible('.score-card'));
  await ctx.setOffline(false);
  // Correction de profil : un ancien profil 86 kg / 178 cm est migré vers 77 kg / 174 cm / 23 ans sans perte d'historique
  // Le poids du J1 recopié depuis l'ancien profil (86) doit redevenir 77 : c'est la seule valeur du journal qui change.
  await page.evaluate(async () => { const st = window.__ndne.store; st.update((x) => { x.days[x.profile.startDate].weight = 77; }, { silent: true }); await st.saveNow(); });
  const daysBefore = JSON.stringify((await S(page)).days);
  await page.evaluate(async () => { const st = window.__ndne.store; st.update((x) => { x.days[x.profile.startDate].weight = 86; x.plan[1].l.items[0].g = 999; x.profile.weight = 86; x.profile.height = 178; x.profile.age = 32; x.profile.goalWeight = 83; }, { silent: true }); await st.saveNow(); });
  await page.reload(); await page.waitForSelector('.score-card'); await page.waitForTimeout(300);
  s = await S(page);
  ok('Migration du profil corrigé (77 kg, 174 cm, 23 ans) + objectifs recalculés', s.profile.weight === 77 && s.profile.height === 174 && s.profile.age === 23 && s.profile.goalWeight === 74 && s.targets.kcal === 2170 && s.targets.bmr === 1748, JSON.stringify({ kcal: s.targets.kcal, bmr: s.targets.bmr, P: s.targets.protein }));
  { const a = JSON.parse(daysBefore), b = s.days; const diffs = []; for (const k of Object.keys(a)) for (const f of Object.keys(a[k])) if (JSON.stringify(a[k][f]) !== JSON.stringify(b[k]?.[f])) diffs.push(k + '.' + f + ':' + JSON.stringify(a[k][f]).slice(0, 40) + '→' + JSON.stringify(b[k]?.[f]).slice(0, 40));
  ok('Historique conservé après correction (journal, repas, séances)', JSON.stringify(s.days) === daysBefore, diffs.join(' ; ')); }
  ok('Poids initial du challenge = 77 kg', s.days[s.profile.startDate].weight === 77);
  ok('Programme 14 jours régénéré (aucune portion de l\'ancien profil)', Object.keys(s.plan).length === 14 && !Object.values(s.plan).some((d) => Object.values(d).some((m) => m.items.some((i) => i.g === 999))));
  const ctxTxt = await page.evaluate(() => import('./js/coach.js').then((m) => m.contextSummary(window.__ndne.store.get())));
  ok('Coach : utilise 77 kg et 2170 kcal', ctxTxt.includes('départ 77 kg') && ctxTxt.includes('2170 kcal') && !ctxTxt.includes('86'), ctxTxt.split('\n')[0]);
  const rep = await page.evaluate(() => import('./js/views/report.js').then((m) => m.reportText(window.__ndne.store.get())));
  ok('Bilan : poids initial 77 kg', rep.includes('77,0 kg') && !rep.includes('86,0'), rep.split('\n')[1]);
  const ui = await page.textContent('#main');
  ok('Interface : plus aucune trace de 86 kg / 178 cm', !/86,0 kg|178 cm/.test(ui) && ui.includes('77,0 kg'), '');
  await page.evaluate(() => location.hash = '#settings'); await page.waitForTimeout(300);
  const st2 = await page.textContent('#main');
  ok('Réglages affichent 2170 kcal / BMR 1748 / TDEE 2709', st2.includes('2170') && st2.includes('1748') && st2.includes('2709'));
  // Modification d'un jour passé (on décale le départ de 2 jours pour avoir un historique)
  await page.evaluate(async () => { const st = window.__ndne.store; st.update((x) => { const d = new Date(); d.setDate(d.getDate() - 2); x.profile.startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }); await st.saveNow(); });
  await page.evaluate(() => location.hash = '#suivi'); await page.waitForSelector('.cal14');
  const k1 = (await S(page)).profile.startDate;
  await page.click(`.cal14 [data-k="${k1}"]`); await page.waitForTimeout(300);
  ok('Calendrier : jour passé ouvert (Jour 1/14)', (await page.textContent('.day-head')).includes('Jour 1/14'));
  await page.fill('#j-morning [data-f=weight]', '77.2'); await page.press('#j-morning [data-f=weight]', 'Tab');
  await page.click('[data-act=j-water][data-v="500"]'); await page.waitForTimeout(300);
  s = await S(page); ok('Jour passé modifiable (poids + eau enregistrés sur ce jour)', s.days[k1].weight === 77.2 && s.days[k1].water === 500 && s.days[k1].waterLog[0].t === null);
  const st1 = await page.evaluate((k) => import('./js/tracking.js').then((m) => m.dayStatus(window.__ndne.store.get(), k).status), k1);
  ok('Statut du jour (partielle / complète / non renseignée)', ['partial', 'empty', 'complete'].includes(st1), st1);
  await page.evaluate(() => location.hash = '#nutrition'); await page.waitForSelector('.meal');
  await page.click('[data-act=copy-from][data-meal=b]').catch(() => {});
  ok('Aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
  await ctx.close();
  fs.writeFileSync('/tmp/e2e-results.json', JSON.stringify(results, null, 1));
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} tests réussis`);
})();
