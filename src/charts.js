// Gráficos em SVG puro (sem bibliotecas, funcionam offline).
// Cada função recebe a largura real do contêiner, para o texto não encolher no celular.
(function (root) {
  'use strict';

  const H = 190;
  const M = { top: 18, right: 14, bottom: 26, left: 38 };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function compact(v) {
    if (Math.abs(v) >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `${+(v / 1000).toFixed(1)}K`;
    return String(Math.round(v));
  }

  // Máximo "redondo" e passo para 3–5 linhas de grade.
  function niceScale(max, fixedMax) {
    if (fixedMax) return { max: fixedMax, step: fixedMax / 4 };
    const m = Math.max(max, 1);
    const raw = m / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((f) => f * mag).find((s) => s >= raw);
    const s = Math.max(1, step);
    return { max: Math.ceil(m / s) * s, step: s };
  }

  function grid(width, scale, format) {
    const plotH = H - M.top - M.bottom;
    let out = '';
    for (let v = 0; v <= scale.max + 1e-9; v += scale.step) {
      const y = M.top + plotH - (v / scale.max) * plotH;
      out += `<line class="grid" x1="${M.left}" x2="${width - M.right}" y1="${y}" y2="${y}"/>`;
      out += `<text class="tick" x="${M.left - 6}" y="${y + 4}" text-anchor="end">${esc(format(v))}</text>`;
    }
    return out;
  }

  // O último rótulo sempre aparece; um rótulo regular perto demais dele é pulado.
  function xLabels(points, xOf, every) {
    const last = points.length - 1;
    return points
      .map((p, i) => {
        const show = i === last || (i % every === 0 && last - i >= every * 0.75);
        return show ? `<text class="tick" x="${xOf(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : '';
      })
      .join('');
  }

  function labelEvery(n, width) {
    return Math.max(1, Math.ceil(n / Math.max(2, Math.floor((width - M.left - M.right) / 52))));
  }

  // Colunas com topo arredondado (4px) e base reta.
  function columnPath(x, y, w, base) {
    const r = Math.min(4, w / 2, (base - y) / 2);
    return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
  }

  function columnChart(points, width, opts) {
    const o = opts || {};
    const format = o.format || compact;
    const plotW = width - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const base = M.top + plotH;
    const values = points.map((p) => (p.value == null ? 0 : p.value));
    const scale = niceScale(Math.max(...values, 0), o.max);
    const band = plotW / points.length;
    const barW = Math.max(2, Math.min(24, band - 2));
    const xOf = (i) => M.left + i * band + band / 2;
    const maxVal = Math.max(...values);
    const maxIdx = maxVal > 0 ? values.lastIndexOf(maxVal) : -1;

    let bars = '';
    let hits = '';
    points.forEach((p, i) => {
      const cx = xOf(i);
      if (p.value != null && p.value > 0) {
        const y = base - (p.value / scale.max) * plotH;
        bars += `<path class="mark" d="${columnPath(cx - barW / 2, y, barW, base)}"/>`;
        if (i === maxIdx) bars += `<text class="value" x="${cx}" y="${y - 5}" text-anchor="middle">${esc(format(p.value))}</text>`;
      }
      hits += `<rect class="hit" x="${M.left + i * band}" y="${M.top}" width="${band}" height="${plotH}" tabindex="0" data-tip="${esc(p.tip)}"/>`;
    });

    return `<svg class="chart-svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${esc(o.label || '')}">
      ${grid(width, scale, format)}
      <line class="axis" x1="${M.left}" x2="${width - M.right}" y1="${base}" y2="${base}"/>
      ${bars}
      ${xLabels(points, xOf, labelEvery(points.length, width))}
      ${hits}
    </svg>`;
  }

  function lineChart(points, width, opts) {
    const o = opts || {};
    const format = o.format || compact;
    const plotW = width - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const base = M.top + plotH;
    const values = points.map((p) => p.value);
    const scale = niceScale(Math.max(...values, 0), o.max);
    const step = points.length > 1 ? plotW / (points.length - 1) : 0;
    const xOf = (i) => M.left + i * step;
    const yOf = (v) => base - (v / scale.max) * plotH;
    const coords = points.map((p, i) => [xOf(i), yOf(p.value)]);
    const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join('');
    const area = `${line}L${xOf(points.length - 1)},${base}L${M.left},${base}Z`;
    const last = coords[coords.length - 1];
    const lastVal = points[points.length - 1].value;
    const band = Math.max(step, 6);

    const hits = points
      .map((p, i) => {
        const [x, y] = coords[i];
        return `<g class="hit" tabindex="0" data-tip="${esc(p.tip)}">
          <rect x="${x - band / 2}" y="${M.top}" width="${band}" height="${plotH}" fill="transparent"/>
          <line class="guide" x1="${x}" x2="${x}" y1="${M.top}" y2="${base}"/>
          <circle class="hover-dot" cx="${x}" cy="${y}" r="4"/>
        </g>`;
      })
      .join('');

    return `<svg class="chart-svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${esc(o.label || '')}">
      ${grid(width, scale, format)}
      <line class="axis" x1="${M.left}" x2="${width - M.right}" y1="${base}" y2="${base}"/>
      <path class="area" d="${area}"/>
      <path class="line" d="${line}"/>
      <circle class="end-dot" cx="${last[0]}" cy="${last[1]}" r="4"/>
      <text class="value" x="${last[0] - 8}" y="${last[1] - 9}" text-anchor="end">${esc(format(lastVal))}</text>
      ${xLabels(points, xOf, labelEvery(points.length, width))}
      ${hits}
    </svg>`;
  }

  root.RPGCharts = { columnChart, lineChart, compact };
})(typeof self !== 'undefined' ? self : this);
