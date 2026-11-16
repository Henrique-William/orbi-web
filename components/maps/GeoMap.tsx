'use client';
/*
 * Mapa oficial da Orbi Logística usando Google Maps Platform (Maps JavaScript API).
 * Desenha as rotas pelas vias reais (DirectionsService), paradas numeradas, posição do motorista e pino de seleção.
 */
import { useEffect, useRef, useState } from 'react';
import { esc, initials, TERMINAL } from '@/lib/orbi/format';
import { useIsDarkMode, GOOGLE_MAPS_DARK_STYLE } from './mapTheme';

type Props = {
  P: any;
  routes: any[];
  focus?: string | null;
  onPick?: (id: string) => void;
  keep?: { view?: { center: any; zoom: number } | null };
  scrollZoom?: boolean;
  onReady?: (map: any, googleObj: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  tempMarker?: { lat: number; lng: number } | null;
  className?: string;
};

// Obtém coordenadas reais ou converte coordenadas do modo demonstração (x, y) para a região de Sumaré/Campinas
function getCoords(s: any): { lat: number; lng: number } | null {
  if (!s) return null;
  if (isFinite(s.lat) && isFinite(s.lng) && (Number(s.lat) !== 0 || Number(s.lng) !== 0)) {
    return { lat: Number(s.lat), lng: Number(s.lng) };
  }
  if (isFinite(s.x) && isFinite(s.y)) {
    return {
      lat: -22.82137 + (Number(s.y) - 800) * 0.00003,
      lng: -47.2665 + (Number(s.x) - 800) * 0.00003
    };
  }
  return null;
}

const valid = (s: any) => getCoords(s) !== null;

function makeStopSvg(order: number | string, color: string, isNext: boolean) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      ${isNext ? '<circle cx="14" cy="14" r="13" fill="none" stroke="#2557D6" stroke-width="2.5" opacity="0.8"/>' : ''}
      <text x="14" y="18" font-size="11.5" font-family="system-ui, -apple-system, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">${order}</text>
    </svg>
  `)}`;
}

function makeDriverSvg(text: string, color: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="16.5" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
      <text x="19" y="24" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">${text}</text>
    </svg>
  `)}`;
}

function makePinSvg() {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <path d="M18 2C9.7 2 3 8.7 3 17c0 10.5 15 25 15 25s15-14.5 15-25c0-8.3-6.7-15-15-15z" fill="#EA4335" stroke="#ffffff" stroke-width="2"/>
      <circle cx="18" cy="17" r="6" fill="#B31412"/>
    </svg>
  `)}`;
}

// Carregador singleton do Google Maps JavaScript API
let googleMapsPromise: Promise<any> | null = null;
function loadGoogleMapsScript(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve((window as any).google);
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js-sdk');
    if (existing) {
      const check = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(check);
          resolve((window as any).google);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = err => {
      googleMapsPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export default function GeoMap({
  P,
  routes,
  focus,
  onPick,
  keep,
  scrollZoom,
  onReady,
  onMapClick,
  tempMarker,
  className
}: Props) {
  const isDark = useIsDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState<string>(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [loadError, setLoadError] = useState<string>('');

  const gState = useRef<{
    map: any;
    google: any;
    markers: any[];
    polylines: any[];
    tempMarker: any;
    infoWindow: any;
    lastSig: string;
    lastFocus: any;
    fitted: boolean;
  }>({
    map: null,
    google: null,
    markers: [],
    polylines: [],
    tempMarker: null,
    infoWindow: null,
    lastSig: '',
    lastFocus: undefined,
    fitted: false
  });

  const pickRef = useRef(onPick);
  const readyRef = useRef(onReady);
  const clickRef = useRef(onMapClick);
  useEffect(() => {
    pickRef.current = onPick;
    readyRef.current = onReady;
    clickRef.current = onMapClick;
  });

  // Busca a chave do Google Maps no servidor caso não esteja embutida no bundle público
  useEffect(() => {
    let alive = true;
    if (apiKey) return;
    fetch('/maps-config')
      .then(r => r.json())
      .then(data => {
        if (!alive) return;
        if (data && data.key) {
          setApiKey(data.key);
        } else {
          setLoadError('Chave GOOGLE_API_KEY não encontrada no arquivo .env');
        }
      })
      .catch(() => {
        if (alive) setLoadError('Não foi possível carregar a configuração do Google Maps');
      });
    return () => {
      alive = false;
    };
  }, [apiKey]);

  const sig =
    JSON.stringify(
      (routes || []).map(r => [
        r.id,
        r.status,
        r.driverId,
        (r.stops || []).map((s: any, i: number) => {
          const c = getCoords(s);
          return [s.status, c ? c.lat : 0, c ? c.lng : 0, s.order || i + 1];
        })
      ])
    ) +
    '|' +
    (focus || '');

  const drawGoogle = () => {
    const { map, google, infoWindow } = gState.current;
    if (!map || !google) return;
    if (gState.current.lastSig === sig && gState.current.lastFocus === focus) return;
    gState.current.lastSig = sig;
    gState.current.lastFocus = focus;

    // Limpa marcadores e polylines anteriores
    gState.current.markers.forEach(m => m.setMap(null));
    gState.current.markers = [];
    gState.current.polylines.forEach(p => p.setMap(null));
    gState.current.polylines = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    (routes || []).forEach(r => {
      const color = P?.routeColor ? P.routeColor(r) : '#2557D6';
      const dim = focus && focus !== r.id;
      const pts = (r.stops || []).filter(valid);
      const next = P?.nextStop ? P.nextStop(r) : null;
      const latlngs = pts.map((s: any) => getCoords(s)!);

      // Traçado da rota
      if (latlngs.length > 1) {
        const poly = new google.maps.Polyline({
          path: latlngs,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: dim ? 0.25 : 0.85,
          strokeWeight: r.status === 'IN_PROGRESS' ? 5 : 4,
          map
        });
        gState.current.polylines.push(poly);
      }

      // Paradas da rota
      pts.forEach((s: any, idx: number) => {
        const c = getCoords(s)!;
        const isNext = s === next && r.status === 'IN_PROGRESS';
        const stColor = (P?.STOP_COLORS && P.STOP_COLORS[s.status]) || '#2557D6';
        const orderLabel = s.order != null ? s.order : idx + 1;
        const iconUrl = makeStopSvg(orderLabel, stColor, isNext);

        const marker = new google.maps.Marker({
          position: c,
          map,
          title: s.street || s.address || `Parada #${orderLabel}`,
          opacity: dim ? 0.35 : 1.0,
          zIndex: isNext ? 100 : 10,
          icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(28, 28),
            anchor: new google.maps.Point(14, 14)
          }
        });

        marker.addListener('click', () => {
          if (pickRef.current && r.id) pickRef.current(r.id);
          const tip = P?.stopTooltip ? P.stopTooltip(r, s) : `<b>#${orderLabel} · ${esc(s.street || s.address || '')}</b>`;
          infoWindow.setContent(
            `<div style="font-family:system-ui,sans-serif;font-size:12.5px;line-height:1.4;padding:4px 2px;color:#101828;">${tip}</div>`
          );
          infoWindow.open(map, marker);
        });

        gState.current.markers.push(marker);
        bounds.extend(c);
        hasPoints = true;
      });

      // Marcador do Motorista em tempo real
      if (r.status === 'IN_PROGRESS') {
        const last =
          pts.filter((s: any) => TERMINAL.includes(s.status)).pop() || (next && valid(next) ? next : null);
        const lastCoords = getCoords(last);
        if (lastCoords) {
          const d = P?.user ? P.user(r.driverId) : null;
          const drvName = d ? d.name : r.driverName || 'Motorista';
          const drvIcon = makeDriverSvg(initials(drvName), color);

          const drvMarker = new google.maps.Marker({
            position: lastCoords,
            map,
            title: drvName,
            zIndex: 999,
            icon: {
              url: drvIcon,
              scaledSize: new google.maps.Size(38, 38),
              anchor: new google.maps.Point(19, 19)
            }
          });

          drvMarker.addListener('click', () => {
            if (pickRef.current && r.id) pickRef.current(r.id);
            infoWindow.setContent(`
              <div style="font-family:system-ui,sans-serif;font-size:12.5px;padding:4px 2px;color:#101828;">
                <b>${esc(drvName)} · ${esc(r.code || '')}</b><br>
                <span style="color:#667085;">Última posição registrada</span>
                ${next ? `<br><b>Próxima:</b> ${esc(next.street || '')}` : ''}
              </div>
            `);
            infoWindow.open(map, drvMarker);
          });

          gState.current.markers.push(drvMarker);
          bounds.extend(lastCoords);
          hasPoints = true;
        }
      }
    });

    if (focus) {
      const focusedRoute = (routes || []).find(x => x.id === focus);
      if (focusedRoute) {
        const fb = new google.maps.LatLngBounds();
        (focusedRoute.stops || []).filter(valid).forEach((s: any) => fb.extend(getCoords(s)!));
        if (!fb.isEmpty()) map.fitBounds(fb, 50);
      }
    } else if (hasPoints && (!gState.current.fitted || !tempMarker)) {
      map.fitBounds(bounds, 50);
      gState.current.fitted = true;
    }
  };

  // Atualiza o pino vermelho do Google Maps quando o endereço é buscado ou clicado
  useEffect(() => {
    const { map, google } = gState.current;
    if (!map || !google) return;

    if (gState.current.tempMarker) {
      gState.current.tempMarker.setMap(null);
      gState.current.tempMarker = null;
    }

    if (tempMarker && valid(tempMarker)) {
      const pos = { lat: tempMarker.lat, lng: tempMarker.lng };
      gState.current.tempMarker = new google.maps.Marker({
        position: pos,
        map,
        zIndex: 1000,
        icon: {
          url: makePinSvg(),
          scaledSize: new google.maps.Size(36, 44),
          anchor: new google.maps.Point(18, 42)
        }
      });
      map.setCenter(pos);
      map.setZoom(18);
    }
  }, [tempMarker]);

  // Inicializa o Google Maps
  useEffect(() => {
    if (!apiKey || !host.current) return;
    let alive = true;

    loadGoogleMapsScript(apiKey)
      .then(google => {
        if (!alive || !host.current) return;

        const initialCenter =
          tempMarker && valid(tempMarker)
            ? { lat: tempMarker.lat, lng: tempMarker.lng }
            : keep && keep.view && keep.view.center
              ? { lat: keep.view.center.lat, lng: keep.view.center.lng }
              : { lat: -22.82137, lng: -47.2665 };

        const initialZoom =
          tempMarker && valid(tempMarker)
            ? 18
            : keep && keep.view && keep.view.zoom
              ? keep.view.zoom
              : 13;

        const map = new google.maps.Map(host.current, {
          center: initialCenter,
          zoom: initialZoom,
          controlSize: 30,
          gestureHandling: scrollZoom !== false ? 'greedy' : 'cooperative',
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
          },
          cameraControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.RIGHT_TOP
          },
          internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
          styles: isDark ? GOOGLE_MAPS_DARK_STYLE : []
        });

        const infoWindow = new google.maps.InfoWindow();
        gState.current = {
          map,
          google,
          markers: [],
          polylines: [],
          tempMarker: null,
          infoWindow,
          lastSig: '',
          lastFocus: undefined,
          fitted: false
        };

        if (keep) {
          map.addListener('idle', () => {
            const c = map.getCenter();
            if (c) keep.view = { center: { lat: c.lat(), lng: c.lng() }, zoom: map.getZoom() };
          });
        }

        map.addListener('click', (e: any) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (clickRef.current) clickRef.current(lat, lng);
        });

        if (tempMarker && valid(tempMarker)) {
          const pos = { lat: tempMarker.lat, lng: tempMarker.lng };
          gState.current.tempMarker = new google.maps.Marker({
            position: pos,
            map,
            zIndex: 1000,
            icon: {
              url: makePinSvg(),
              scaledSize: new google.maps.Size(36, 44),
              anchor: new google.maps.Point(18, 42)
            }
          });
          map.setCenter(pos);
          map.setZoom(18);
        }

        if (readyRef.current) {
          readyRef.current(map, { isGoogle: true, google, maps: google.maps });
        }

        drawGoogle();
      })
      .catch(() => {
        if (alive) {
          setLoadError(
            'Falha ao carregar o Google Maps JavaScript API. Verifique se a "Maps JavaScript API" está ativada no Google Cloud Console.'
          );
        }
      });

    return () => {
      alive = false;
      if (gState.current.markers) gState.current.markers.forEach(m => m.setMap(null));
      if (gState.current.polylines) gState.current.polylines.forEach(p => p.setMap(null));
      if (gState.current.tempMarker) gState.current.tempMarker.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Atualiza o estilo do mapa em tempo real quando o usuário alterna entre temas Light e Dark
  useEffect(() => {
    if (gState.current.map) {
      gState.current.map.setOptions({
        styles: isDark ? GOOGLE_MAPS_DARK_STYLE : []
      });
    }
  }, [isDark]);

  // Garante que o Google Maps redimensione corretamente caso o container mude de tamanho
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const { map, google } = gState.current;
      if (map && google && google.maps && google.maps.event) {
        const center = map.getCenter();
        google.maps.event.trigger(map, 'resize');
        if (center) map.setCenter(center);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (gState.current.map) drawGoogle();
  });

  return (
    <div ref={containerRef} className={className || 'map-host'}>
      <div ref={host} className="gm-canvas" />
      {loadError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            height: '100%',
            padding: 24,
            textAlign: 'center',
            color: 'var(--red)',
            fontSize: 13,
            background: 'var(--map-bg)',
            zIndex: 10
          }}
        >
          {loadError}
        </div>
      )}
    </div>
  );
}
