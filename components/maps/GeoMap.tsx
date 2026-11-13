'use client';
/*
 * Mapa real (Leaflet + OpenStreetMap) usado no modo API.
 * Desenha as rotas pelas coordenadas das entregas; a posição do motorista é a última parada registrada.
 */
import { useEffect, useRef } from 'react';
import { esc, initials, TERMINAL } from '@/lib/orbi/format';

type Props = {
  P: any;
  routes: any[];
  focus?: string | null;
  onPick?: (id: string) => void;
  keep?: { view?: { center: any; zoom: number } | null };
  scrollZoom?: boolean;
  /** recebe o mapa pronto (ex.: para marcar pontos com clique na tela de nova rota) */
  onReady?: (map: any, L: any) => void;
  className?: string;
};

const valid = (s: any) => isFinite(s.lat) && isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0);

export default function GeoMap({ P, routes, focus, onPick, keep, scrollZoom, onReady, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<any>({ map: null, L: null, layer: null, fitted: false, lastFocus: undefined });
  const pick = useRef(onPick);
  const ready = useRef(onReady);
  useEffect(() => { pick.current = onPick; ready.current = onReady; });

  // assinatura dos dados: redesenha só quando algo relevante muda
  const sig = JSON.stringify(routes.map(r => [r.id, r.status, r.driverId, r.stops.map((s: any) => [s.status, s.lat, s.lng])])) + '|' + (focus || '');

  const draw = () => {
    const { map, L, layer } = st.current;
    if (!map) return;
    if (st.current.sig === sig) return;
    st.current.sig = sig;
    layer.clearLayers();
    const bounds: any[] = [];
    routes.forEach(r => {
      const color = P.routeColor(r);
      const dim = focus && focus !== r.id;
      const pts = r.stops.filter(valid);
      const latlngs = pts.map((s: any) => [s.lat, s.lng]);
      if (latlngs.length > 1) L.polyline(latlngs, { color, weight: r.status === 'IN_PROGRESS' ? 5 : 3.5, opacity: dim ? 0.2 : 0.85, dashArray: r.status === 'IN_PROGRESS' || r.status === 'COMPLETED' ? null : '6 8' }).addTo(layer);
      const next = P.nextStop(r);
      const seen = new Set();
      pts.forEach((s: any, i: number) => {
        const key = s.lat.toFixed(5) + ',' + s.lng.toFixed(5);
        if (seen.has(key) && i === pts.length - 1) return; // ponto final = retorno ao início
        seen.add(key);
        const isNext = s === next && r.status === 'IN_PROGRESS';
        const icon = L.divIcon({ className: 'gm-stop', html: `<span style="background:${P.STOP_COLORS[s.status] || '#667085'};${isNext ? 'box-shadow:0 0 0 4px rgba(37,87,214,.35);transform:scale(1.25)' : ''};${dim ? 'opacity:.3' : ''}">${s.order}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        L.marker([s.lat, s.lng], { icon, title: s.street }).addTo(layer)
          .bindTooltip(P.stopTooltip ? P.stopTooltip(r, s) : esc(s.street), { direction: 'top', offset: [0, -10] })
          .on('click', () => { if (pick.current) pick.current(r.id); });
        bounds.push([s.lat, s.lng]);
      });
      if (r.status === 'IN_PROGRESS') {
        const last = r.stops.filter((s: any) => TERMINAL.includes(s.status) && valid(s)).pop() || (next && valid(next) ? next : null);
        if (last) {
          const d = P.user(r.driverId);
          const icon = L.divIcon({ className: 'gm-drv', html: `<span style="background:${color}">${esc(initials(d ? d.name : r.driverName || '?'))}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
          L.marker([last.lat, last.lng], { icon, zIndexOffset: 1000 }).addTo(layer)
            .bindTooltip(`<b>${esc(d ? d.name : r.driverName || 'Motorista')} · ${esc(r.code)}</b><br>Última parada registrada${next ? '<br>Próxima: ' + esc(next.street) : ''}`, { direction: 'top', offset: [0, -14] })
            .on('click', () => { if (pick.current) pick.current(r.id); });
        }
      }
    });
    // enquadramento: na primeira vez (ou ao focar outra rota)
    if (focus && focus !== st.current.lastFocus) {
      const r = routes.find(x => x.id === focus);
      const b = r ? r.stops.filter(valid).map((s: any) => [s.lat, s.lng]) : [];
      if (b.length) map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
    } else if (!st.current.fitted) {
      if (keep && keep.view) map.setView(keep.view.center, keep.view.zoom);
      else if (bounds.length) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      else map.setView([-22.9064, -47.0616], 12);
    }
    st.current.fitted = true;
    st.current.lastFocus = focus;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!alive || !host.current) return;
      const map = L.map(host.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: scrollZoom !== false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      st.current.map = map; st.current.L = L; st.current.layer = L.layerGroup().addTo(map);
      if (keep) map.on('moveend', () => { keep.view = { center: map.getCenter(), zoom: map.getZoom() }; });
      draw();
      setTimeout(() => { if (alive) map.invalidateSize(); }, 60);
      if (ready.current) ready.current(map, L);
    })();
    const state = st.current;
    return () => { alive = false; if (state.map) { state.map.remove(); state.map = null; } };
    // o mapa é criado uma única vez por montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (st.current.map) draw(); });


  return <div ref={host} className={className || 'map-host'} />;
}
