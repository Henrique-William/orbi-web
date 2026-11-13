'use client';
/*
 * Mapa simulado da demonstração: cidade fictícia em SVG, com zoom, arraste
 * e a posição estimada dos motoristas atualizada a cada segundo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { esc, initials } from '@/lib/orbi/format';

type VB = { x: number; y: number; w: number; h: number };
type Props = { P: any; routes: any[]; focus?: string | null; onPick?: (id: string) => void; viewKey?: string; legend?: boolean; className?: string };

// enquadramento de cada mapa, guardado entre trocas de página (ex.: "Ao vivo")
const views = new Map<string, VB>();

export default function LiveMap({ P, routes, focus, onPick, viewKey, legend, className }: Props) {
  const { D, M } = P;
  const host = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const city = useMemo(() => M.citySvg(), [M]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [vb, setVb] = useState<VB | null>(() => (viewKey && views.get(viewKey)) || null);
  const [prevFocus, setPrevFocus] = useState(focus);
  const [drag, setDrag] = useState<{ x: number; y: number; vb: VB } | null>(null);
  const [, tick] = useState(0);

  const fit = (sz: { w: number; h: number }): VB => {
    const pts = [D.DEPOT].concat(routes.flatMap(r => r.stops));
    const minX = Math.min(...pts.map((p: any) => p.x)), maxX = Math.max(...pts.map((p: any) => p.x));
    const minY = Math.min(...pts.map((p: any) => p.y)), maxY = Math.max(...pts.map((p: any) => p.y));
    const pad = 140;
    let vw = maxX - minX + pad * 2, vh = maxY - minY + pad * 2;
    if (vw / vh < sz.w / sz.h) vw = (vh * sz.w) / sz.h; else vh = (vw * sz.h) / sz.w;
    return { x: (minX + maxX) / 2 - vw / 2, y: (minY + maxY) / 2 - vh / 2, w: vw, h: vh };
  };
  const sz = size || { w: 600, h: 400 };
  const cur: VB = vb || fit(sz);

  // ao focar outra rota, centraliza no motorista (ou na primeira parada)
  if (focus !== prevFocus) {
    setPrevFocus(focus);
    const r = focus && routes.find(x => x.id === focus);
    if (r) { const p = P.livePos(r) || r.stops[0]; setVb({ x: p.x - cur.w / 2, y: p.y - cur.h / 2, w: cur.w, h: cur.h }); }
  }

  // tamanho do mapa e posição dos motoristas (a cada segundo)
  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 600, h: el.clientHeight || 400 }));
    ro.observe(el);
    const t = setInterval(() => tick(x => x + 1), 1000);
    return () => { ro.disconnect(); clearInterval(t); };
  }, []);
  useEffect(() => { if (viewKey && vb) views.set(viewKey, vb); }, [viewKey, vb]);

  const K = Math.max(0.8, (cur.w / sz.w) * 1.1);
  const zoom = (f: number, cx?: number, cy?: number) => {
    const nw = Math.max(250, Math.min(3200, cur.w * f)); const real = nw / cur.w;
    const px = cx == null ? 0.5 : cx, py = cy == null ? 0.5 : cy;
    setVb({ x: cur.x + cur.w * px * (1 - real), y: cur.y + cur.h * py * (1 - real), w: nw, h: cur.h * real });
  };
  // zoom com a roda do mouse (precisa de listener não passivo)
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; });
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomRef.current(e.deltaY > 0 ? 1.15 : 0.87, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const colorOf = (r: any) => P.routeColor(r);
  const live = routes.filter(r => r.status === 'IN_PROGRESS');

  return (
    <div ref={host} className={className || 'map-host'}>
      <svg ref={svgRef} className={`lmap ${drag ? 'drag' : ''}`} preserveAspectRatio="xMidYMid slice" viewBox={`${cur.x} ${cur.y} ${cur.w} ${cur.h}`}
        onPointerDown={e => { if ((e.target as Element).closest('.lv-drv')) return; setDrag({ x: e.clientX, y: e.clientY, vb: { ...cur } }); (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (!drag) return; const r = e.currentTarget.getBoundingClientRect(); const s = Math.max(drag.vb.w / r.width, drag.vb.h / r.height); setVb({ x: drag.vb.x - (e.clientX - drag.x) * s, y: drag.vb.y - (e.clientY - drag.y) * s, w: drag.vb.w, h: drag.vb.h }); }}
        onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        <g dangerouslySetInnerHTML={{ __html: city }} />
        <g>{routes.map(r => {
          const dim = focus && focus !== r.id;
          return <polyline key={r.id} points={M.polyline(M.pathThrough([D.DEPOT].concat(r.stops)))} fill="none" stroke={colorOf(r)} strokeWidth={(r.status === 'IN_PROGRESS' ? 7 : 4.5) * K} strokeLinecap="round" strokeLinejoin="round" opacity={dim ? 0.18 : r.status === 'IN_PROGRESS' ? 0.9 : 0.55} strokeDasharray={r.status === 'IN_PROGRESS' ? undefined : `${2 * K} ${10 * K}`} />;
        })}</g>
        <g dangerouslySetInnerHTML={{ __html: M.depotMarker(0, K) + routes.map(r => r.stops.map((s: any, i: number) => (focus && focus !== r.id ? '' : M.stopMarker(s, i + 1, M.kindOf(s.status), 0, K * 0.8))).join('')).join('') }} />
        <g>{live.map(r => {
          const pos = P.livePos(r); if (!pos) return null;
          const d = P.user(r.driverId); const sos = P.hasSos(r.id);
          const tip = `<b>${esc(d ? d.name : '')} · ${esc(r.code)}</b><div>${sos ? 'Alerta de segurança ativo' : `Indo para ${esc(pos.next ? P.stopAddr(pos.next) : '—')}`}</div><div>Chegada em ~${pos.eta} min · em ${esc(P.streetAt(pos))}</div>`;
          return (
            <g key={r.id} className={`lv-drv ${sos ? 'sos' : ''}`} data-tip={tip} onClick={() => onPick && onPick(r.id)}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${K})`, opacity: focus && focus !== r.id ? 0.35 : 1 }}>
              <circle className="lv-pulse" r="22" /><circle r="15" fill={sos ? '#D64545' : colorOf(r)} stroke="#fff" strokeWidth="3" /><text y="4.5" textAnchor="middle">{initials(d ? d.name : '?')}</text>
            </g>
          );
        })}</g>
      </svg>
      <div className="lmap-ctl">
        <button className="icon-btn" aria-label="Aproximar" onClick={() => zoom(0.7)}><Icon name="plus" /></button>
        <button className="icon-btn" aria-label="Afastar" onClick={() => zoom(1.4)}><Icon name="minus" /></button>
        <button className="icon-btn" aria-label="Centralizar" onClick={() => setVb(fit(sz))}><Icon name="target" /></button>
      </div>
      {legend !== false && (
        <div className="lmap-legend">{routes.filter(r => r.status !== 'COMPLETED').slice(0, 6).map(r => <span key={r.id}><i style={{ background: colorOf(r) }} />{r.code}</span>)}</div>
      )}
    </div>
  );
}

/** Mapa estático da rota inteira (detalhe da rota e nova rota, modo demonstração). */
export function RouteSvg({ P, route, highlightNext, className }: { P: any; route: any; highlightNext?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.6);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const upd = () => setRatio(el.clientWidth / Math.max(1, el.clientHeight));
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={host} className={className || 'map-host'} dangerouslySetInnerHTML={{ __html: route.stops.length ? P.M.overviewSvg(route, { ratio, highlightNext }) : '' }} />;
}
