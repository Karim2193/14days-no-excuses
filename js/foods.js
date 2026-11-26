// Base nutritionnelle locale (valeurs moyennes pour 100 g, inspirées de la table CIQUAL / étiquetage courant).
// cat : prot | carb | fruit | veg | fat | dairy | other
// tags : allergènes / régimes → meat, pork, fish, shellfish, egg, lactose, gluten, nuts, peanut, soy, sesame
// price : prix indicatif en € / kg (France, grande surface, 2025-2026) — estimation, pas une donnée certaine.
// cook : facteur cru → cuit (poids cuit ≈ poids cru × cook). state : 'cru' | 'cuit' | undefined
const F = (id, n, cat, k, p, c, f, o = {}) => ({ id, n, cat, k, p, c, f, tags: [], ...o });

export const FOODS = [
  // ——— Protéines animales (poids CRU) ———
  F('poulet', 'Blanc de poulet', 'prot', 110, 23, 0, 1.5, { tags: ['meat'], price: 11, state: 'cru', cook: 0.75, meals: 'ld' }),
  F('dinde', 'Escalope de dinde', 'prot', 107, 24, 0, 1.2, { tags: ['meat'], price: 12, state: 'cru', cook: 0.75, meals: 'ld' }),
  F('boeuf5', 'Steak haché 5 % MG', 'prot', 125, 21, 0, 5, { tags: ['meat'], price: 12, state: 'cru', cook: 0.8, meals: 'ld' }),
  F('rumsteck', 'Rumsteck de bœuf', 'prot', 121, 22, 0, 3.5, { tags: ['meat'], price: 22, state: 'cru', cook: 0.8, meals: 'ld' }),
  F('porc_filet', 'Filet mignon de porc', 'prot', 120, 22, 0, 3.5, { tags: ['meat', 'pork'], price: 14, state: 'cru', cook: 0.75, meals: 'ld' }),
  F('saumon', 'Pavé de saumon', 'prot', 200, 20, 0, 13, { tags: ['fish'], price: 24, state: 'cru', cook: 0.85, meals: 'ld' }),
  F('cabillaud', 'Dos de cabillaud', 'prot', 80, 18, 0, 0.7, { tags: ['fish'], price: 20, state: 'cru', cook: 0.85, meals: 'ld' }),
  F('thon', 'Thon au naturel (égoutté)', 'prot', 115, 26, 0, 1, { tags: ['fish'], price: 14, meals: 'lds' }),
  F('crevettes', 'Crevettes cuites décortiquées', 'prot', 95, 21, 0, 1.2, { tags: ['shellfish'], price: 22, state: 'cuit', meals: 'ld' }),
  F('oeuf', 'Œuf entier', 'prot', 140, 12.5, 0.7, 9.5, { tags: ['egg'], price: 6, unit: { g: 55, label: 'œuf' }, meals: 'bd' }),
  F('blanc_oeuf', "Blancs d'œufs (liquides)", 'prot', 48, 10.5, 0.7, 0.2, { tags: ['egg'], price: 6, meals: 'b' }),
  F('jambon_volaille', 'Blanc de volaille (tranches)', 'prot', 105, 19, 1.5, 2.5, { tags: ['meat'], price: 15, meals: 's' }),
  F('jambon', 'Jambon blanc découenné', 'prot', 110, 20, 1, 3, { tags: ['meat', 'pork'], price: 13, meals: 's' }),
  // ——— Protéines végétales ———
  F('tofu', 'Tofu ferme nature', 'prot', 145, 15, 2, 8.5, { tags: ['soy'], price: 10, meals: 'ld' }),
  F('tempeh', 'Tempeh', 'prot', 190, 19, 9, 10, { tags: ['soy'], price: 18, meals: 'ld' }),
  F('pst', 'Protéines de soja texturées (sèches)', 'prot', 335, 50, 20, 1, { tags: ['soy'], price: 12, state: 'cru', cook: 2.5, meals: 'ld' }),
  // ——— Produits laitiers / desserts protéinés ———
  F('skyr', 'Skyr nature 0 %', 'dairy', 63, 11, 4, 0.2, { tags: ['lactose'], price: 4.5, meals: 'bs' }),
  F('fb0', 'Fromage blanc 0 %', 'dairy', 47, 7.5, 4, 0.2, { tags: ['lactose'], price: 3, meals: 'bs' }),
  F('fb3', 'Fromage blanc 3 %', 'dairy', 75, 7, 4, 3.2, { tags: ['lactose'], price: 3.2 }),
  F('grec', 'Yaourt grec 2 %', 'dairy', 75, 9, 4, 2, { tags: ['lactose'], price: 5, meals: 'bs' }),
  F('cottage', 'Cottage cheese', 'dairy', 98, 11, 3.4, 4.3, { tags: ['lactose'], price: 9, meals: 'bs' }),
  F('whey', 'Whey protéine (poudre)', 'dairy', 380, 78, 6, 5, { tags: ['lactose'], price: 30, unit: { g: 30, label: 'dose' }, meals: 'bs' }),
  F('prot_pois', 'Protéine végétale de pois (poudre)', 'dairy', 380, 75, 5, 6, { price: 32, unit: { g: 30, label: 'dose' }, meals: 'bs' }),
  F('soja_yaourt', 'Yaourt au soja nature', 'dairy', 45, 4, 2, 2.3, { tags: ['soy'], price: 4, meals: 'bs' }),
  F('lait_ecreme', 'Lait écrémé', 'dairy', 35, 3.4, 5, 0.1, { tags: ['lactose'], price: 1 }),
  F('lait_demi', 'Lait demi-écrémé', 'dairy', 46, 3.2, 4.8, 1.6, { tags: ['lactose'], price: 1.1 }),
  F('lait_amande', "Boisson à l'amande sans sucre", 'dairy', 15, 0.5, 0.3, 1.2, { tags: ['nuts'], price: 2.5 }),
  F('lait_soja', 'Boisson au soja nature', 'dairy', 33, 3.3, 0.5, 1.8, { tags: ['soy'], price: 2 }),
  F('emmental', 'Emmental', 'dairy', 380, 28, 0, 29, { tags: ['lactose'], price: 11 }),
  F('feta', 'Feta', 'dairy', 265, 14, 4, 21, { tags: ['lactose'], price: 14 }),
  F('mozza_light', 'Mozzarella light', 'dairy', 165, 19, 1.5, 9, { tags: ['lactose'], price: 10 }),
  // ——— Féculents (poids CRU / SEC sauf mention) ———
  F('avoine', "Flocons d'avoine", 'carb', 370, 13, 60, 7, { tags: ['gluten'], price: 2.5, meals: 'bs' }),
  F('pain_complet', 'Pain complet', 'carb', 245, 9, 43, 3.5, { tags: ['gluten'], price: 5, unit: { g: 35, label: 'tranche' }, meals: 'b' }),
  F('galette_riz', 'Galettes de riz soufflé', 'carb', 385, 8, 82, 3, { price: 9, unit: { g: 9, label: 'galette' }, meals: 'bs' }),
  F('muesli', 'Muesli sans sucres ajoutés', 'carb', 360, 10, 60, 6, { tags: ['gluten', 'nuts'], price: 6, meals: 'b' }),
  F('riz', 'Riz basmati', 'carb', 355, 8.5, 78, 0.8, { price: 3, state: 'cru', cook: 2.6, meals: 'ld' }),
  F('riz_complet', 'Riz complet', 'carb', 350, 7.5, 74, 2.5, { price: 3.5, state: 'cru', cook: 2.5, meals: 'ld' }),
  F('pates', 'Pâtes complètes', 'carb', 350, 13, 64, 2.5, { tags: ['gluten'], price: 2.5, state: 'cru', cook: 2.3, meals: 'ld' }),
  F('quinoa', 'Quinoa', 'carb', 368, 14, 64, 6, { price: 8, state: 'cru', cook: 2.7, meals: 'ld' }),
  F('semoule', 'Semoule complète', 'carb', 340, 12, 68, 2, { tags: ['gluten'], price: 3, state: 'cru', cook: 2.3, meals: 'ld' }),
  F('patate_douce', 'Patate douce', 'carb', 86, 1.6, 20, 0.1, { price: 3.5, state: 'cru', cook: 0.9, meals: 'ld' }),
  F('pdt', 'Pomme de terre', 'carb', 77, 2, 17, 0.1, { price: 1.5, state: 'cru', cook: 0.95, meals: 'ld' }),
  F('lentilles', 'Lentilles vertes', 'carb', 330, 24, 49, 1.5, { price: 4, state: 'cru', cook: 2.5, meals: 'ld' }),
  F('pois_chiches', 'Pois chiches (conserve égouttés)', 'carb', 130, 7, 17, 2.5, { price: 3.5, meals: 'ld' }),
  F('haricots_rouges', 'Haricots rouges (conserve égouttés)', 'carb', 115, 8, 16, 0.5, { price: 3, meals: 'ld' }),
  F('tortilla', 'Tortilla de blé', 'carb', 310, 8.5, 52, 7, { tags: ['gluten'], price: 6, unit: { g: 40, label: 'tortilla' } }),
  // Versions CUITES (pour la saisie au calculateur)
  F('riz_cuit', 'Riz basmati', 'carb', 135, 3.2, 30, 0.3, { state: 'cuit' }),
  F('pates_cuites', 'Pâtes complètes', 'carb', 150, 5.5, 28, 1.1, { tags: ['gluten'], state: 'cuit' }),
  F('quinoa_cuit', 'Quinoa', 'carb', 136, 5, 24, 2.2, { state: 'cuit' }),
  F('lentilles_cuites', 'Lentilles vertes', 'carb', 130, 9.5, 19.5, 0.6, { state: 'cuit' }),
  F('pdt_cuite', 'Pomme de terre vapeur', 'carb', 80, 2, 17.5, 0.1, { state: 'cuit' }),
  F('poulet_cuit', 'Blanc de poulet', 'prot', 148, 31, 0, 2, { tags: ['meat'], state: 'cuit' }),
  F('boeuf5_cuit', 'Steak haché 5 % MG', 'prot', 155, 26, 0, 6, { tags: ['meat'], state: 'cuit' }),
  // ——— Fruits ———
  F('banane', 'Banane', 'fruit', 90, 1.1, 20, 0.3, { price: 2, unit: { g: 120, label: 'banane' }, meals: 'bs' }),
  F('pomme', 'Pomme', 'fruit', 52, 0.3, 12, 0.2, { price: 2.5, unit: { g: 150, label: 'pomme' }, meals: 'bs' }),
  F('fruits_rouges', 'Fruits rouges (surgelés)', 'fruit', 45, 1, 8, 0.3, { price: 7, meals: 'bs' }),
  F('kiwi', 'Kiwi', 'fruit', 60, 1, 12, 0.5, { price: 4, unit: { g: 75, label: 'kiwi' }, meals: 'bs' }),
  F('orange', 'Orange', 'fruit', 47, 0.9, 10, 0.1, { price: 2.2, unit: { g: 150, label: 'orange' }, meals: 'bs' }),
  F('poire', 'Poire', 'fruit', 55, 0.4, 13, 0.1, { price: 3, unit: { g: 150, label: 'poire' }, meals: 's' }),
  F('ananas', 'Ananas', 'fruit', 50, 0.5, 12, 0.1, { price: 3.5, meals: 's' }),
  F('mangue', 'Mangue', 'fruit', 65, 0.7, 15, 0.3, { price: 5 }),
  F('dattes', 'Dattes', 'fruit', 280, 2.5, 66, 0.4, { price: 8 }),
  // ——— Légumes (crus) ———
  F('brocoli', 'Brocoli', 'veg', 34, 2.8, 4, 0.4, { price: 3.5, meals: 'ld' }),
  F('haricots_verts', 'Haricots verts', 'veg', 31, 1.8, 4.5, 0.2, { price: 4, meals: 'ld' }),
  F('courgette', 'Courgette', 'veg', 17, 1.2, 2.4, 0.3, { price: 2.5, meals: 'ld' }),
  F('epinards', 'Épinards', 'veg', 23, 2.9, 1.4, 0.4, { price: 4, meals: 'ld' }),
  F('poivron', 'Poivron', 'veg', 26, 1, 4.5, 0.3, { price: 4, meals: 'ld' }),
  F('salade', 'Salade verte', 'veg', 15, 1.3, 1.5, 0.2, { price: 5, meals: 'ld' }),
  F('tomate', 'Tomate', 'veg', 18, 0.9, 3, 0.2, { price: 3, meals: 'ld' }),
  F('carotte', 'Carotte', 'veg', 36, 0.8, 7, 0.2, { price: 1.5, meals: 'ld' }),
  F('champignons', 'Champignons de Paris', 'veg', 22, 3, 1.5, 0.3, { price: 5, meals: 'ld' }),
  F('chou_fleur', 'Chou-fleur', 'veg', 25, 2, 3, 0.3, { price: 3, meals: 'ld' }),
  F('concombre', 'Concombre', 'veg', 13, 0.6, 2, 0.1, { price: 2.5 }),
  F('poelee', 'Poêlée de légumes surgelés (nature)', 'veg', 40, 2, 5.5, 0.7, { price: 3.5, meals: 'ld' }),
  // ——— Matières grasses ———
  F('huile_olive', "Huile d'olive", 'fat', 900, 0, 0, 100, { price: 12, unit: { g: 10, label: 'c. à soupe' }, meals: 'ld' }),
  F('huile_colza', 'Huile de colza', 'fat', 900, 0, 0, 100, { price: 4, unit: { g: 10, label: 'c. à soupe' }, meals: 'ld' }),
  F('avocat', 'Avocat', 'fat', 160, 2, 2, 15, { price: 8, unit: { g: 140, label: 'avocat (chair)' }, meals: 'ld' }),
  F('amandes', 'Amandes', 'fat', 600, 21, 7, 52, { tags: ['nuts'], price: 16, meals: 'bs' }),
  F('noix', 'Cerneaux de noix', 'fat', 690, 15, 7, 65, { tags: ['nuts'], price: 20, meals: 'bs' }),
  F('cajou', 'Noix de cajou', 'fat', 590, 18, 27, 46, { tags: ['nuts'], price: 18, meals: 's' }),
  F('beurre_cacahuete', 'Beurre de cacahuète 100 %', 'fat', 610, 25, 14, 50, { tags: ['peanut'], price: 10, unit: { g: 15, label: 'c. à soupe' }, meals: 'b' }),
  F('chia', 'Graines de chia', 'fat', 490, 17, 8, 31, { price: 12, meals: 'b' }),
  F('graines_courge', 'Graines de courge', 'fat', 560, 30, 10, 46, { price: 15, meals: 's' }),
  F('choco85', 'Chocolat noir 85 %', 'fat', 600, 11, 20, 50, { price: 15, unit: { g: 10, label: 'carré' }, meals: 's' }),
  F('beurre', 'Beurre', 'fat', 740, 0.7, 0.6, 82, { tags: ['lactose'], price: 10 }),
  F('houmous', 'Houmous', 'fat', 250, 7, 14, 18, { tags: ['sesame'], price: 10 }),
  // ——— Divers / plats courants (saisie libre) ———
  F('miel', 'Miel', 'other', 330, 0.4, 81, 0, { price: 12 }),
  F('sucre', 'Sucre', 'other', 400, 0, 100, 0),
  F('baguette', 'Baguette blanche', 'other', 270, 9, 55, 1.5, { tags: ['gluten'] }),
  F('croissant', 'Croissant', 'other', 410, 8, 45, 21, { tags: ['gluten', 'lactose'], unit: { g: 60, label: 'croissant' } }),
  F('pizza', 'Pizza margherita', 'other', 250, 10, 30, 9, { tags: ['gluten', 'lactose'] }),
  F('burger', 'Burger fast-food', 'other', 260, 13, 25, 12, { tags: ['gluten', 'meat'] }),
  F('frites', 'Frites', 'other', 300, 3.5, 38, 15),
  F('kebab', 'Sandwich kebab', 'other', 230, 12, 22, 10, { tags: ['gluten', 'meat'] }),
  F('sushi', 'Sushi / maki saumon', 'other', 150, 6, 25, 3, { tags: ['fish'] }),
  F('chips', 'Chips', 'other', 530, 6, 52, 33),
  F('barre_prot', 'Barre protéinée', 'other', 360, 30, 35, 12, { tags: ['lactose'], unit: { g: 50, label: 'barre' } }),
  F('camembert', 'Camembert', 'other', 290, 20, 0.5, 23, { tags: ['lactose'] }),
  F('poulet_roti', 'Poulet rôti avec peau', 'other', 220, 25, 0, 13, { tags: ['meat'], state: 'cuit' }),
  F('soda', 'Soda sucré (cola)', 'other', 42, 0, 10.6, 0),
  F('soda_zero', 'Soda zéro', 'other', 1, 0, 0, 0),
  F('jus_orange', "Jus d'orange", 'other', 45, 0.7, 10, 0.2),
  F('biere', 'Bière blonde', 'other', 43, 0.4, 3.5, 0),
  F('vin', 'Vin rouge', 'other', 85, 0.1, 2.6, 0),
  F('sauce_soja', 'Sauce soja', 'other', 60, 8, 6, 0, { tags: ['soy', 'gluten'] }),
  F('ketchup', 'Ketchup', 'other', 110, 1.2, 25, 0.2),
  F('mayonnaise', 'Mayonnaise', 'other', 700, 1.5, 1.5, 76, { tags: ['egg'] }),
];

// Fibres (g / 100 g), valeurs moyennes.
const FIBER = {
  avoine: 10, pain_complet: 7, galette_riz: 3, muesli: 8, riz: 1.3, riz_complet: 3.5, pates: 8, quinoa: 7, semoule: 7, patate_douce: 3, pdt: 2,
  lentilles: 11, pois_chiches: 5, haricots_rouges: 6, tortilla: 3, riz_cuit: 0.4, pates_cuites: 3.5, quinoa_cuit: 2.8, lentilles_cuites: 4, pdt_cuite: 1.8,
  banane: 2, pomme: 2.4, fruits_rouges: 5, kiwi: 3, orange: 2.2, poire: 3, ananas: 1.4, mangue: 1.6, dattes: 7,
  brocoli: 2.6, haricots_verts: 3, courgette: 1, epinards: 2.2, poivron: 2, salade: 1.3, tomate: 1.2, carotte: 2.8, champignons: 1, chou_fleur: 2, concombre: 0.5, poelee: 2.5,
  avocat: 6.7, amandes: 12, noix: 6.5, cajou: 3, beurre_cacahuete: 6, chia: 34, graines_courge: 6, choco85: 11, houmous: 6,
  tofu: 1, tempeh: 5, pst: 15, soja_yaourt: 0.5, baguette: 3, croissant: 2, pizza: 2, burger: 1.5, frites: 3, kebab: 2, sushi: 0.5, chips: 4, barre_prot: 5, prot_pois: 1,
};
for (const f of FOODS) f.fi = FIBER[f.id] ?? 0;

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const ALLERGENS = [
  ['gluten', 'Gluten'], ['lactose', 'Lactose'], ['egg', 'Œufs'], ['nuts', 'Fruits à coque'], ['peanut', 'Arachide'],
  ['fish', 'Poisson'], ['shellfish', 'Crustacés'], ['soy', 'Soja'], ['sesame', 'Sésame'],
];

export const DIETS = [
  ['omnivore', 'Omnivore'], ['sans_porc', 'Sans porc / halal'], ['pescetarien', 'Pescétarien'], ['vegetarien', 'Végétarien'], ['vegan', 'Végan'],
];

export const dietExcludes = (diet) => ({
  omnivore: [], sans_porc: ['pork'], pescetarien: ['meat'], vegetarien: ['meat', 'fish', 'shellfish'],
  vegan: ['meat', 'fish', 'shellfish', 'egg', 'lactose'],
}[diet] || []);

export const foodLabel = (f) => f.n + (f.state ? ` (${f.state})` : '');
export const macrosFor = (f, g) => ({ kcal: f.k * g / 100, p: f.p * g / 100, c: f.c * g / 100, f: f.f * g / 100, fi: (f.fi || 0) * g / 100 });
