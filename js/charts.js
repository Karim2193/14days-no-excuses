// Graphiques SVG légers et interactifs (aucune dépendance) : courbes, barres, anneaux.
import { esc } from './util.js';

export function ring(pct, { size = 120, stroke = 10, color = 'var(--green)', track = 'var(--track)', label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)} ${esc(sub)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--c:${c}"/>
    <text x="50%" y="${sub ? '47%' : '53%'}" text-anchor="middle" class="ring-label">${esc(label)}</text>
    ${sub ? `<text x="50%" y="64%" text-anchor="middle" class="ring-sub">${esc(sub)}</text>` : ''}
  </svg>`;
}

// points : [{x (1..n), y, label}] ; opts.target ligne horizontale ; opts.xMax
export function lineChart(points, { xMax = 14, height = 170, target = null, unit = '', color = 'var(--green)', id = 'c', yPad = 0.6, trend = null } = {}) {
  const W = 340, H = height, L = 34, R = 10, T = 12, B = 22;
  if (!points.length) return `<div class="chart-empty">Aucune donnée pour l'instant. Ajoute une mesure dans le journal.</div>`;
  const ys = points.map((p) => p.y).concat(target != null ? [target] : []);
  let min = Math.min(...ys) - yPad, max = Math.max(...ys) + yPad;
  if (max - min < 1) { max += 0.5; min -= 0.5; }
  const sx = (x) => L + ((x - 1) / Math.max(1, xMax - 1)) * (W - L - R);
  const sy = (y) => T + (1 - (y - min) / (max - min)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path} L${sx(points[points.length - 1].x).toFixed(1)},${H - B} L${sx(points[0].x).toFixed(1)},${H - B} Z`;
  const grid = [0, 0.5, 1].map((f) => { const v = min + f * (max - min); const y = sy(v); return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" class="axis">${v.toFixed(1)}</text>`; }).join('');
  const xt = [1, Math.ceil(xMax / 2), xMax].map((x) => `<text x="${sx(x)}" y="${H - 6}" text-anchor="middle" class="axis">J${x}</text>`).join('');
  const tl = target != null ? `<line x1="${L}" x2="${W - R}" y1="${sy(target)}" y2="${sy(target)}" class="target"/><text x="${W - R}" y="${sy(target) - 4}" text-anchor="end" class="axis tgt">cible ${target}${unit}</text>` : '';
  const tr = trend && trend.length > 1 ? `<path d="${trend.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')}" class="trend"/>` : '';
  const dots = points.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4.5" class="dot" style="fill:${color}" data-tip="${esc(p.label || `J${p.x} : ${p.y}${unit}`)}"/>
    <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="14" class="hit" data-tip="${esc(p.label || `J${p.x} : ${p.y}${unit}`)}"/>`).join('');
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xt}${tl}<path d="${area}" fill="url(#g-${id})"/>${tr}<path d="${path}" class="line" style="stroke:${color}"/>${dots}</svg><div class="tip" hidden></div></div>`;
}

export function barChart(bars, { height = 150, max = 100, id = 'b', threshold = null } = {}) {
  const W = 340, H = height, L = 6, R = 6, T = 10, B = 20;
  const n = Math.max(bars.length, 14); const bw = (W - L - R) / n;
  const sy = (v) => T + (1 - v / max) * (H - T - B);
  const th = threshold != null ? `<line x1="${L}" x2="${W - R}" y1="${sy(threshold)}" y2="${sy(threshold)}" class="target"/>` : '';
  const rects = bars.map((b, i) => {
    const x = L + i * bw + bw * 0.18; const w = bw * 0.64; const y = sy(b.v || 0);
    return `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, H - B - y)}" rx="3" class="bar ${b.cls || ''}" data-tip="${esc(b.tip || '')}"/>
      <text x="${x + w / 2}" y="${H - 6}" text-anchor="middle" class="axis">${esc(b.x)}</text>`;
  }).join('');
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}">${th}${rects}</svg><div class="tip" hidden></div></div>`;
}

export function bar(value, target, { cls = '', label = '', unit = 'g' } = {}) {
  const p = target ? Math.min(1.15, value / target) : 0;
  const over = target && value > target * 1.1;
  return `<div class="pbar ${cls}${over ? ' over' : ''}"><div class="pbar-top"><span>${esc(label)}</span><span><b>${Math.round(value)}</b> / ${Math.round(target)} ${unit}</span></div>
    <div class="pbar-track"><div class="pbar-fill" style="width:${Math.min(100, p * 100)}%"></div></div></div>`;
}

export function bindTips(root) {
  root.querySelectorAll('.chart').forEach((ch) => {
    const tip = ch.querySelector('.tip');
    ch.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t || !t.dataset.tip) { tip.hidden = true; return; }
      const rc = ch.getBoundingClientRect(); const rt = t.getBoundingClientRect();
      tip.textContent = t.dataset.tip; tip.hidden = false;
      tip.style.left = Math.min(rc.width - 70, Math.max(70, rt.left - rc.left + rt.width / 2)) + 'px';
      tip.style.top = (rt.top - rc.top - 8) + 'px';
    });
  });
}

// Plusieurs courbes sur une même échelle (ex : sommeil h, récupération /10, performance /10).
// series : [{ name, color, points: [{x, y, label}] }]
export function multiLine(series, { xMax = 14, height = 170, yMin = 0, yMax = 10, id = 'ml', unit = '' } = {}) {
  const W = 340, H = height, L = 28, R = 10, T = 12, B = 22;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return `<div class="chart-empty">Pas encore assez de données.</div>`;
  const sx = (x) => L + ((x - 1) / Math.max(1, xMax - 1)) * (W - L - R);
  const sy = (y) => T + (1 - (Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin)) * (H - T - B);
  const grid = [0, 0.5, 1].map((f) => { const v = yMin + f * (yMax - yMin); const y = sy(v); return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" class="axis">${Math.round(v)}</text>`; }).join('');
  const xt = [1, Math.ceil(xMax / 2), xMax].map((x) => `<text x="${sx(x)}" y="${H - 6}" text-anchor="middle" class="axis">J${x}</text>`).join('');
  const lines = series.map((s) => { if (!s.points.length) return ''; const pts = [...s.points].sort((a, b) => a.x - b.x);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    return `<path d="${path}" class="line" style="stroke:${s.color}"/>${pts.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" class="dot" style="fill:${s.color}"/><circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="12" class="hit" data-tip="${esc(p.label || `${s.name} J${p.x} : ${p.y}${unit}`)}"/>`).join('')}`; }).join('');
  const legend = `<div class="legend">${series.map((s) => `<span class="lg" style="background:${s.color};border-radius:2px;height:3px"></span>${esc(s.name)}`).join(' ')}</div>`;
  return `<div class="chart" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${xt}${lines}</svg><div class="tip" hidden></div></div>${legend}`;
}
