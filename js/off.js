// Open Food Facts (base collaborative gratuite, sans clé) + scan de code-barres (ZXing, local).
const UA_FIELDS = 'code,product_name,product_name_fr,brands,nutriments';

function toFood(p) {
  const n = p.nutriments || {};
  const k = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (k == null) return null;
  return {
    id: 'off_' + p.code, n: (p.product_name_fr || p.product_name || 'Produit ' + p.code).trim(), brand: (p.brands || '').split(',')[0].trim(),
    cat: 'other', k: Math.round(k), p: Math.round((n.proteins_100g || 0) * 10) / 10, c: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
    f: Math.round((n.fat_100g || 0) * 10) / 10, fi: Math.round((n.fiber_100g || 0) * 10) / 10, tags: [], off: true, code: p.code,
  };
}

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${UA_FIELDS}`);
  if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (j.status !== 1 || !j.product) return null;
  return toFood({ ...j.product, code });
}

export async function searchOFF(term) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=20&fields=${UA_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return (j.products || []).map(toFood).filter(Boolean);
}

let zxingLoading = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingLoading) zxingLoading = new Promise((resolve, reject) => {
    const sc = document.createElement('script'); sc.src = 'js/vendor/zxing.min.js';
    sc.onload = () => resolve(window.ZXing); sc.onerror = () => reject(new Error('lecteur indisponible')); document.head.appendChild(sc);
  });
  return zxingLoading;
}

// Démarre la caméra et appelle onCode(code) une seule fois. Renvoie une fonction d'arrêt.
export async function scanBarcode(video, onCode) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('caméra non supportée');
  const ZX = await loadZXing();
  const hints = new Map();
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E]);
  const reader = new ZX.BrowserMultiFormatReader(hints);
  let done = false;
  await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result) => {
    if (result && !done) { done = true; try { navigator.vibrate?.(60); } catch {} reader.reset(); onCode(result.getText()); }
  });
  return () => { done = true; try { reader.reset(); } catch {} };
}
