/* eslint-disable */
// Mapa vetorial simulado do modo demonstração (sem API externa), portado de prototipo/js/map.js
// @ts-nocheck
import { D } from './data';

  const SIZE = 1600;
  const STEP = 100;
  const METERS_PER_UNIT = 3;
  const CITY_SPEED_KMH = 28;

  // --------------------------------------------------------------------------
  // Geometria
  // --------------------------------------------------------------------------
  function samePt(a, b) { return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01; }

  // Trajeto entre dois pontos que estão sobre ruas verticais (x múltiplo de 100)
  function pathBetween(a, b) {
    const pts = [{ x: a.x, y: a.y }];
    if (a.x === b.x) {
      pts.push({ x: b.x, y: b.y });
    } else {
      // vai até o cruzamento mais próximo na direção do destino
      let yh = (b.y >= a.y) ? Math.ceil(a.y / STEP) * STEP : Math.floor(a.y / STEP) * STEP;
      yh = Math.max(0, Math.min(SIZE, yh));
      pts.push({ x: a.x, y: yh });
      pts.push({ x: b.x, y: yh });
      pts.push({ x: b.x, y: b.y });
    }
    return dedupe(pts);
  }

  function dedupe(pts) {
    const out = [];
    pts.forEach(p => { if (!out.length || !samePt(out[out.length - 1], p)) out.push(p); });
    // remove pontos colineares
    const clean = [];
    out.forEach((p, i) => {
      if (i > 0 && i < out.length - 1) {
        const a = out[i - 1], c = out[i + 1];
        const cross = (p.x - a.x) * (c.y - p.y) - (p.y - a.y) * (c.x - p.x);
        if (Math.abs(cross) < 0.01) return;
      }
      clean.push(p);
    });
    return clean;
  }

  function pathThrough(points) {
    let all = [];
    for (let i = 0; i < points.length - 1; i++) {
      const seg = pathBetween(points[i], points[i + 1]);
      all = all.concat(i === 0 ? seg : seg.slice(1));
    }
    return all.length ? dedupe(all) : points.slice();
  }

  function pathLength(pts) {
    let d = 0;
    for (let i = 0; i < pts.length - 1; i++) d += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    return d;
  }

  function headingOf(a, b) {
    return (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI + 360) % 360;
  }

  function pointAt(pts, dist) {
    if (pts.length < 2) return { x: pts[0].x, y: pts[0].y, heading: 0, seg: 0 };
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (acc + len >= dist) {
        const t = len ? (dist - acc) / len : 0;
        return {
          x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
          y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
          heading: headingOf(pts[i], pts[i + 1]),
          seg: i
        };
      }
      acc += len;
    }
    const n = pts.length;
    return { x: pts[n - 1].x, y: pts[n - 1].y, heading: headingOf(pts[n - 2], pts[n - 1]), seg: n - 2 };
  }

  // Parte restante do trajeto a partir de "dist"
  function remainingPath(pts, dist) {
    const p = pointAt(pts, dist);
    return [{ x: p.x, y: p.y }].concat(pts.slice(p.seg + 1));
  }

  function streetOf(a, b) {
    if (Math.abs(a.x - b.x) < 0.01) return D.VERTICAL_STREETS[Math.round(a.x / STEP)] || 'Rua sem nome';
    return D.HORIZONTAL_STREETS[Math.round(a.y / STEP)] || 'Rua sem nome';
  }

  // Próxima manobra a partir da distância percorrida
  function nextManeuver(pts, dist) {
    const total = pathLength(pts);
    const here = pointAt(pts, dist);
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      acc += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      if (acc > dist + 0.5 && i < pts.length - 2) {
        const a = pts[i], b = pts[i + 1], c = pts[i + 2];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        return {
          type: cross > 0 ? 'right' : 'left',
          meters: (acc - dist) * METERS_PER_UNIT,
          street: streetOf(b, c),
          current: streetOf(pts[here.seg], pts[here.seg + 1])
        };
      }
    }
    return {
      type: 'arrive',
      meters: Math.max(0, total - dist) * METERS_PER_UNIT,
      street: pts.length > 1 ? streetOf(pts[pts.length - 2], pts[pts.length - 1]) : '',
      current: pts.length > 1 ? streetOf(pts[here.seg], pts[here.seg + 1]) : ''
    };
  }

  function unitsToKm(u) { return (u * METERS_PER_UNIT) / 1000; }
  function unitsToMin(u) { return Math.max(1, Math.round(unitsToKm(u) / CITY_SPEED_KMH * 60)); }
  function manhattan(a, b) { return pathLength(pathBetween(a, b)); }

  // --------------------------------------------------------------------------
  // Otimização simulada (vizinho mais próximo + 2-opt) — substitui o ORS no protótipo
  // --------------------------------------------------------------------------
  function totalDistance(start, list) {
    return pathLength(pathThrough([start].concat(list)));
  }

  function optimize(start, stops) {
    const remaining = stops.slice();
    const order = [];
    let cur = start;
    while (remaining.length) {
      let best = 0, bestD = Infinity;
      remaining.forEach((s, i) => { const d = manhattan(cur, s); if (d < bestD) { bestD = d; best = i; } });
      cur = remaining.splice(best, 1)[0];
      order.push(cur);
    }
    // 2-opt
    let improved = true, guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let i = 0; i < order.length - 1; i++) {
        for (let k = i + 1; k < order.length; k++) {
          const cand = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
          if (totalDistance(start, cand) + 0.01 < totalDistance(start, order)) { order.splice(0, order.length, ...cand); improved = true; }
        }
      }
    }
    return order;
  }

  // --------------------------------------------------------------------------
  // Desenho da cidade
  // --------------------------------------------------------------------------
  function rand(seed) { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  const PARKS = new Set(['2,1', '9,3', '13,9', '5,10', '10,13', '1,12', '14,2']);

  let cityCache = null;
  function citySvg() {
    if (cityCache) return cityCache;
    const parts = [];
    parts.push(`<rect class="m-bg" x="-400" y="-400" width="${SIZE + 800}" height="${SIZE + 800}"/>`);
    // quarteirões e prédios
    for (let i = 0; i < SIZE / STEP; i++) {
      for (let j = 0; j < SIZE / STEP; j++) {
        const x = i * STEP, y = j * STEP;
        if (PARKS.has(i + ',' + j)) {
          parts.push(`<rect class="m-park" x="${x + 10}" y="${y + 10}" width="80" height="80" rx="6"/>`);
          parts.push(`<circle class="m-tree" cx="${x + 32}" cy="${y + 38}" r="9"/><circle class="m-tree" cx="${x + 62}" cy="${y + 60}" r="11"/><circle class="m-tree" cx="${x + 66}" cy="${y + 30}" r="7"/>`);
          continue;
        }
        const n = 2 + Math.floor(rand(i * 31 + j) * 3);
        for (let k = 0; k < n; k++) {
          const r1 = rand(i * 97 + j * 13 + k), r2 = rand(i * 7 + j * 101 + k * 3);
          const w = 22 + r1 * 30, h = 22 + r2 * 30;
          const bx = x + 14 + rand(i + j * 5 + k * 11) * (72 - w);
          const by = y + 14 + rand(i * 3 + j + k * 17) * (72 - h);
          parts.push(`<rect class="m-bld" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`);
        }
      }
    }
    // rio
    parts.push(`<path class="m-water" d="M -400 1235 C 200 1180, 400 1290, 800 1235 S 1300 1180, 2000 1240 L 2000 1275 C 1300 1215, 1200 1330, 800 1272 S 200 1215, -400 1272 Z"/>`);
    // ruas: borda + pista
    const roads = [];
    for (let i = 0; i <= SIZE / STEP; i++) {
      const av = i % D.AVENUE_EVERY === 0;
      const p = i * STEP;
      roads.push({ d: `M ${p} -400 L ${p} ${SIZE + 400}`, av });
      roads.push({ d: `M -400 ${p} L ${SIZE + 400} ${p}`, av });
    }
    roads.forEach(r => parts.push(`<path class="m-road-b ${r.av ? 'av' : ''}" d="${r.d}"/>`));
    roads.forEach(r => parts.push(`<path class="m-road ${r.av ? 'av' : ''}" d="${r.d}"/>`));
    // nomes das ruas
    for (let i = 0; i <= SIZE / STEP; i++) {
      const p = i * STEP;
      for (let k = 0; k < 4; k++) {
        const t = 50 + k * 400 + (i % 2) * 200;
        parts.push(`<text class="m-label" x="${p}" y="${t}" transform="rotate(-90 ${p} ${t})" dy="3.5">${D.VERTICAL_STREETS[i]}</text>`);
        parts.push(`<text class="m-label" x="${t}" y="${p}" dy="3.5">${D.HORIZONTAL_STREETS[i]}</text>`);
      }
    }
    cityCache = parts.join('');
    return cityCache;
  }

  function polyline(pts) { return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '); }

  function depotMarker(rot, k) {
    const d = D.DEPOT;
    return `<g class="m-upright" data-x="${d.x}" data-y="${d.y}" transform="translate(${d.x} ${d.y}) rotate(${rot || 0}) scale(${k || 1})"><rect class="m-depot" x="-13" y="-13" width="26" height="26" rx="7"/>` +
      `<path d="M-6 3 V-3 L0 -7 L6 -3 V3 Z" fill="#fff"/></g>`;
  }

  function stopMarker(s, n, kind, rot, k) {
    const tr = `translate(${s.x} ${s.y}) rotate(${rot || 0}) scale(${k || 1})`;
    // kind: next | pending | done | skipped | cancelled
    if (kind === 'next') {
      return `<g class="m-pin-next m-upright" data-x="${s.x}" data-y="${s.y}" transform="${tr}"><path d="M0 0 C -6 -12 -16 -18 -16 -30 A 16 16 0 1 1 16 -30 C 16 -18 6 -12 0 0 Z"/>` +
        `<text x="0" y="-25" class="m-pin-text">${n}</text></g>`;
    }
    return `<g class="m-stop m-upright ${kind}" data-x="${s.x}" data-y="${s.y}" transform="${tr}"><circle r="11"/><text y="4" class="m-stop-text">${n}</text></g>`;
  }

  function driverMarker() {
    return `<g id="m-driver"><circle class="m-driver-pulse" r="26"/><circle class="m-driver-halo" r="15"/>` +
      `<path class="m-driver-arrow" d="M0 -12 L9 10 L0 5 L-9 10 Z"/></g>`;
  }

  function kindOf(status) {
    return { COMPLETED: 'done', SKIPPED: 'skipped', CANCELLED: 'cancelled' }[status] || 'pending';
  }

  // Mapa estático com toda a rota (visão geral)
  function overviewSvg(route, opts) {
    opts = opts || {};
    const stops = route.stops;
    const pts = [D.DEPOT].concat(stops);
    const line = pathThrough(pts);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    const pad = 90;
    let w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const ratio = opts.ratio || 1.6; // largura/altura
    if (w / h < ratio) { const nw = h * ratio; minX -= (nw - w) / 2; w = nw; } else { const nh = w / ratio; minY -= (nh - h) / 2; h = nh; }
    const nextIdx = stops.findIndex(s => s.status === 'PENDING' || s.status === 'IN_TRANSIT');
    const k = Math.max(1, Math.min(4, w / 480));
    let markers = depotMarker(0, k);
    stops.forEach((s, i) => { markers += stopMarker(s, i + 1, i === nextIdx && opts.highlightNext ? 'next' : kindOf(s.status), 0, k); });
    return `<svg class="map-svg" viewBox="${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid slice" aria-label="Mapa da rota">` +
      citySvg() +
      `<polyline class="m-route-glow" style="stroke-width:${22 * k}" points="${polyline(line)}"/><polyline class="m-route ${opts.dashed ? 'dashed' : ''}" style="stroke-width:${9 * k}" points="${polyline(line)}"/>` +
      markers + `</svg>`;
  }

  
export const M: any = {
    SIZE, METERS_PER_UNIT,
    pathBetween, pathThrough, pathLength, pointAt, remainingPath, nextManeuver, headingOf,
    unitsToKm, unitsToMin, totalDistance, optimize, citySvg, polyline, stopMarker, depotMarker, driverMarker, kindOf, overviewSvg
  };
