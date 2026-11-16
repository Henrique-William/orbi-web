'use client';
/*
 * Mapa interativo para comparação visual das rotas e modelos de benchmark (Orbi IC).
 * Suporta Google Maps JavaScript API (com Dark Mode reativo) e fallback vetorial SVG.
 * Layout organizado em 2 painéis: mapa à esquerda e legenda interativa dedicada à direita.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsDarkMode, GOOGLE_MAPS_DARK_STYLE } from './mapTheme';

export interface RoutePoint {
  order: number;
  id?: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  surfaceFactor?: number;
  isReturn?: boolean;
}

export interface ModelRouteData {
  algorithmName: string;
  algorithmType?: string;
  complexity?: string;
  executionTimeMs?: number;
  color: string;
  dash?: boolean;
  strokeWeight?: number;
  distanceKm: number;
  durationMin: number;
  efficiencyGainPct?: number;
  points: RoutePoint[];
}

interface BenchmarkMapProps {
  models: ModelRouteData[];
  selectedModelName: string;
  onSelectModel?: (name: string) => void;
  initialDurationMin?: number;
  initialDistanceKm?: number;
}

let googleMapsPromise: Promise<any> | null = null;
function loadGoogleMapsScript(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve((window as any).google);
  }
  if (googleMapsPromise) return googleMapsPromise;

  return (googleMapsPromise = new Promise((resolve, reject) => {
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
    script.onerror = err => reject(err);
    document.head.appendChild(script);
  }));
}

function makeStopSvg(order: number | string, color: string, isStart: boolean) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
      ${isStart ? '<circle cx="15" cy="15" r="14.5" fill="none" stroke="#2557D6" stroke-width="2.5"/>' : ''}
      <text x="15" y="19" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">${order}</text>
    </svg>
  `)}`;
}

export default function BenchmarkMap({
  models,
  selectedModelName,
  onSelectModel,
  initialDurationMin,
  initialDistanceKm
}: BenchmarkMapProps) {
  const isDark = useIsDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState<string>(() => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [activeStop, setActiveStop] = useState<RoutePoint | null>(null);

  // Resolve qual modelo deve ficar em evidência (se o selecionado não existir neste cenário, foca o ALNS Orbi ou primeiro)
  const resolvedSelectedName = useMemo(() => {
    if (!models || models.length === 0) return '';
    const exact = models.find(m => m.algorithmName === selectedModelName);
    if (exact) return exact.algorithmName;
    const alns = models.find(m => m.algorithmName.includes('ALNS Orbi'));
    if (alns) return alns.algorithmName;
    const nonBaseline = models.find(m => !m.algorithmName.includes('Baseline'));
    return nonBaseline ? nonBaseline.algorithmName : models[0].algorithmName;
  }, [models, selectedModelName]);

  const currentModel = useMemo(
    () => models.find(m => m.algorithmName === resolvedSelectedName) || models[0],
    [models, resolvedSelectedName]
  );

  // Modelos visíveis no mapa (toggle individual)
  const [visibleModelNames, setVisibleModelNames] = useState<Record<string, boolean>>({});

  // Ao trocar de cenário (lista de modelos), ativa Baseline + modelo em evidência
  useEffect(() => {
    const initVis: Record<string, boolean> = {};
    models.forEach(m => {
      initVis[m.algorithmName] = m.algorithmName.includes('Baseline') || m.algorithmName === resolvedSelectedName;
    });
    setVisibleModelNames(initVis);
    setActiveStop(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // Ao selecionar um novo algoritmo na legenda/tabela, garante que seu traçado esteja visível sem apagar os demais ativados
  useEffect(() => {
    if (!resolvedSelectedName) return;
    setVisibleModelNames(prev => (prev[resolvedSelectedName] ? prev : { ...prev, [resolvedSelectedName]: true }));
  }, [resolvedSelectedName]);

  const toggleModelVisibility = (name: string) => {
    setVisibleModelNames(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const showAllModels = () => {
    const next: Record<string, boolean> = {};
    models.forEach(m => {
      next[m.algorithmName] = true;
    });
    setVisibleModelNames(next);
  };

  const showOnlyEvidenceAndBaseline = () => {
    const next: Record<string, boolean> = {};
    models.forEach(m => {
      next[m.algorithmName] = m.algorithmName.includes('Baseline') || m.algorithmName === resolvedSelectedName;
    });
    setVisibleModelNames(next);
  };

  // Busca a chave do Google Maps no servidor caso não esteja no bundle público
  useEffect(() => {
    if (apiKey) return;
    fetch('/maps-config')
      .then(r => r.json())
      .then(d => {
        if (d && d.key) setApiKey(d.key);
        else setUseFallback(true);
      })
      .catch(() => setUseFallback(true));
  }, [apiKey]);

  const gMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  // Inicializa o Google Maps
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let alive = true;

    loadGoogleMapsScript(apiKey)
      .then(google => {
        if (!alive || !containerRef.current) return;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: -22.905, lng: -47.058 },
          zoom: 12,
          controlSize: 28,
          gestureHandling: 'greedy',
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          styles: isDark ? GOOGLE_MAPS_DARK_STYLE : []
        });

        gMapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapLoaded(true);
      })
      .catch(() => {
        if (alive) setUseFallback(true);
      });

    return () => {
      alive = false;
      markersRef.current.forEach(m => m.setMap(null));
      polylinesRef.current.forEach(p => p.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Atualiza o estilo do mapa em tempo real quando o usuário alterna entre temas Light e Dark
  useEffect(() => {
    if (gMapRef.current) {
      gMapRef.current.setOptions({
        styles: isDark ? GOOGLE_MAPS_DARK_STYLE : []
      });
    }
  }, [isDark]);

  // Redesenha linhas e marcadores quando os modelos, visibilidade ou algoritmo em evidência mudam
  useEffect(() => {
    const map = gMapRef.current;
    if (!map || !(window as any).google) return;
    const google = (window as any).google;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // 1. Traçados dos modelos visíveis
    models.forEach(model => {
      if (!visibleModelNames[model.algorithmName]) return;
      if (!model.points || model.points.length === 0) return;

      const isFocused = model.algorithmName === resolvedSelectedName;
      const isBaseline = model.algorithmName.includes('Baseline');

      const path = model.points
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map(p => {
          const pt = { lat: Number(p.lat), lng: Number(p.lng) };
          bounds.extend(pt);
          hasPoints = true;
          return pt;
        });

      if (path.length < 2) return;

      const polyOptions: any = {
        path,
        geodesic: true,
        strokeColor: model.color,
        strokeOpacity: isFocused ? 0.95 : isBaseline ? 0.45 : 0.65,
        strokeWeight: isFocused ? 5 : isBaseline ? 3 : 3.5,
        zIndex: isFocused ? 20 : isBaseline ? 5 : 10,
        map
      };

      if (isBaseline || model.dash) {
        polyOptions.strokeOpacity = 0;
        polyOptions.icons = [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: isFocused ? 1 : 0.7,
              strokeColor: model.color,
              scale: isFocused ? 3.5 : 2.5
            },
            offset: '0',
            repeat: '12px'
          }
        ];
      }

      const polyline = new google.maps.Polyline(polyOptions);
      polyline.addListener('click', () => {
        if (onSelectModel) onSelectModel(model.algorithmName);
      });
      polylinesRef.current.push(polyline);
    });

    // 2. Pinos numerados na ordem do algoritmo em evidência
    if (currentModel && currentModel.points) {
      const validPoints = currentModel.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      const totalUniqueStops = validPoints.filter(x => !x.isReturn).length;

      validPoints.forEach((p, idx) => {
        if (p.isReturn) return;
        const pos = { lat: Number(p.lat), lng: Number(p.lng) };
        bounds.extend(pos);
        hasPoints = true;

        const isStart = idx === 0;
        const markerColor = isStart ? '#2557D6' : currentModel.color || '#067647';

        const marker = new google.maps.Marker({
          position: pos,
          map,
          zIndex: 100 + idx,
          icon: {
            url: makeStopSvg(p.order, markerColor, isStart),
            scaledSize: new google.maps.Size(30, 30),
            anchor: new google.maps.Point(15, 15)
          },
          title: `#${p.order} - ${p.name}`
        });

        marker.addListener('click', () => {
          setActiveStop(p);
          const content = `
            <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 260px;">
              <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">
                Parada #${p.order} de ${totalUniqueStops}
              </div>
              <div style="font-weight: 700; font-size: 14px; margin: 2px 0 4px; color: #0F172A;">
                ${p.name}
              </div>
              <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
                ${p.address || ''}
              </div>
              <div style="display: flex; gap: 8px; font-size: 11px; background: #F1F5F9; padding: 6px; border-radius: 4px; color: #0F172A;">
                <span><b>Pavimento:</b> ${p.surfaceFactor ? p.surfaceFactor.toFixed(2) : '1.00'}x</span>
                <span><b>Lat:</b> ${Number(p.lat).toFixed(4)}</span>
                <span><b>Lng:</b> ${Number(p.lng).toFixed(4)}</span>
              </div>
            </div>
          `;
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(map, marker);
          }
        });

        markersRef.current.push(marker);
      });
    }

    if (hasPoints) {
      map.fitBounds(bounds, 40);
    }
  }, [models, resolvedSelectedName, currentModel, visibleModelNames, mapLoaded, onSelectModel]);

  const fmtHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <style>{`
        .bm-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          min-height: 460px;
        }
        .bm-canvas-wrap {
          position: relative;
          min-height: 460px;
          background: var(--map-bg);
        }
        .bm-side {
          border-left: 1px solid var(--line);
          background: var(--card);
          display: flex;
          flex-direction: column;
          min-height: 0;
          max-height: 500px;
        }
        @media (max-width: 980px) {
          .bm-body {
            grid-template-columns: 1fr;
          }
          .bm-canvas-wrap {
            min-height: 360px;
          }
          .bm-side {
            border-left: 0;
            border-top: 1px solid var(--line);
            max-height: 360px;
          }
        }
      `}</style>

      {/* 1. FAIXA SUPERIOR DE EVIDÊNCIA DO MODELO (Sem dropdown) */}
      <div
        style={{
          padding: '12px 18px',
          background: 'var(--card-2)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        {currentModel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: currentModel.color,
                  boxShadow: `0 0 0 3px ${currentModel.color}33`,
                  flexShrink: 0
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{currentModel.algorithmName}</b>
                  <span className="badge blue" style={{ height: 19, fontSize: 10.5 }}>
                    EM EVIDÊNCIA
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {currentModel.algorithmType || 'Otimizador'}
                  {currentModel.complexity ? ` · Complexidade ${currentModel.complexity}` : ''}
                </span>
              </div>
            </div>

            {/* Indicadores do algoritmo em evidência */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Distância Total
                </span>
                <b className="num" style={{ fontSize: 13, color: currentModel.color }}>
                  {currentModel.distanceKm.toFixed(1)} km
                </b>
              </div>

              <div
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Tempo de Rota
                </span>
                <b className="num" style={{ fontSize: 13, color: 'var(--ink)' }}>
                  {fmtHours(currentModel.durationMin)}
                </b>
              </div>

              <div
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Tempo CPU
                </span>
                <b className="num" style={{ fontSize: 13, color: 'var(--primary)' }}>
                  {currentModel.executionTimeMs != null ? `${currentModel.executionTimeMs.toFixed(2)} ms` : '0.00 ms'}
                </b>
              </div>

              {currentModel.efficiencyGainPct != null && currentModel.efficiencyGainPct > 0 && (
                <div
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--green-bg)',
                    border: '1px solid var(--green-line)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <span style={{ fontSize: 10, color: 'var(--green)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Economia
                  </span>
                  <b className="num" style={{ fontSize: 13, color: 'var(--green)' }}>
                    -{currentModel.efficiencyGainPct.toFixed(1)}%
                  </b>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="muted small">Selecione um algoritmo na legenda lateral para colocar em evidência</div>
        )}

        {/* Referência: Rota Inicial Sem Otimização */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--red-bg)',
            border: '1px solid var(--red-line)',
            color: 'var(--red)'
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
          <span style={{ fontWeight: 500 }}>Rota Inicial (Sem Otimização):</span>
          <b className="num">{initialDurationMin ? fmtHours(initialDurationMin) : '—'}</b>
          <span className="num">({initialDistanceKm ? `${initialDistanceKm.toFixed(1)} km` : '—'})</span>
        </div>
      </div>

      {/* 2. CORPO DIVIDIDO: MAPA (ESQUERDA) + LEGENDA DEDICADA (DIREITA) */}
      <div className="bm-body">
        {/* Painel Esquerdo: Mapa */}
        <div className="bm-canvas-wrap">
          {!useFallback ? (
            <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 460 }} />
          ) : (
            <SvgFallbackMap
              models={models}
              selectedModelName={resolvedSelectedName}
              visibleModelNames={visibleModelNames}
              onSelectStop={setActiveStop}
              isDark={isDark}
            />
          )}

          {/* Detalhe de parada clicada */}
          {activeStop && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                maxWidth: 320,
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                boxShadow: 'var(--shadow-pop)',
                zIndex: 8,
                fontSize: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <b style={{ color: 'var(--ink)' }}>
                  Parada #{activeStop.order} · {activeStop.name}
                </b>
                <button
                  onClick={() => setActiveStop(null)}
                  style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
              {activeStop.address && (
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {activeStop.address}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel Direito: Legenda Interativa de Algoritmos */}
        <aside className="bm-side">
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'var(--card-2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                Legenda de Algoritmos
              </span>
              <span className="badge neutral" style={{ height: 20, fontSize: 11 }}>
                {models.length} modelos
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={showOnlyEvidenceAndBaseline}
                style={{ flex: 1, height: 26, fontSize: 11 }}
              >
                Evidência + Base
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={showAllModels}
                style={{ flex: 1, height: 26, fontSize: 11 }}
              >
                Mostrar Todos
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {models.length === 0 ? (
              <div className="muted small" style={{ padding: 16, textAlign: 'center' }}>
                Nenhum modelo disponível neste cenário.
              </div>
            ) : (
              models.map(m => {
                const isChecked = !!visibleModelNames[m.algorithmName];
                const isSelected = m.algorithmName === resolvedSelectedName;
                const isBaseline = m.algorithmName.includes('Baseline');

                return (
                  <div
                    key={m.algorithmName}
                    onClick={() => {
                      if (onSelectModel) onSelectModel(m.algorithmName);
                      setVisibleModelNames(prev => ({ ...prev, [m.algorithmName]: true }));
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-soft)' : 'var(--card)',
                      border: isSelected ? `1.5px solid ${m.color}` : '1px solid var(--line-2)',
                      transition: 'background 0.12s ease, border-color 0.12s ease'
                    }}
                    title="Clique para colocar este algoritmo em evidência no mapa e nos cards"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: m.color,
                          flexShrink: 0,
                          border: isBaseline ? '2px solid var(--card)' : 'none',
                          boxShadow: isSelected ? `0 0 0 2px ${m.color}44` : 'none'
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {m.algorithmName}
                        </div>
                        <div className="muted num" style={{ fontSize: 10.5 }}>
                          {m.distanceKm.toFixed(1)} km · {fmtHours(m.durationMin)} ·{' '}
                          {m.executionTimeMs != null ? `${m.executionTimeMs.toFixed(2)} ms` : '0.00 ms'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {m.efficiencyGainPct != null && m.efficiencyGainPct > 0 && (
                        <span
                          className="num"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: 'var(--green)'
                          }}
                        >
                          -{m.efficiencyGainPct.toFixed(0)}%
                        </span>
                      )}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleModelVisibility(m.algorithmName)}
                        title="Exibir ou ocultar linha da rota no mapa"
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: m.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// Fallback vetorial em SVG (caso a API do Google Maps esteja offline ou cota bloqueada)
function SvgFallbackMap({
  models,
  selectedModelName,
  visibleModelNames,
  onSelectStop,
  isDark
}: {
  models: ModelRouteData[];
  selectedModelName: string;
  visibleModelNames: Record<string, boolean>;
  onSelectStop: (s: RoutePoint) => void;
  isDark?: boolean;
}) {
  const selectedModel = models.find(m => m.algorithmName === selectedModelName) || models[0];
  const allPoints: RoutePoint[] = [];
  models.forEach(m => m.points && m.points.forEach(p => {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) allPoints.push(p);
  }));

  if (allPoints.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 460, color: 'var(--muted)' }}>
        Nenhum dado geográfico disponível para renderização neste cenário.
      </div>
    );
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  allPoints.forEach(p => {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  });

  const pad = 0.008;
  minLat -= pad;
  maxLat += pad;
  minLng -= pad;
  maxLng += pad;

  const width = 800;
  const height = 500;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / Math.max(0.0001, maxLng - minLng)) * (width - 80) + 40;
    const y = ((maxLat - lat) / Math.max(0.0001, maxLat - minLat)) * (height - 80) + 40;
    return { x, y };
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 460,
        display: 'block',
        background: isDark ? '#141B2B' : 'var(--map-bg)'
      }}
    >
      <defs>
        <pattern id="bm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? '#222B3D' : 'var(--line)'} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bm-grid)" />

      {/* Rotas dos modelos visíveis */}
      {models.map(m => {
        if (!visibleModelNames[m.algorithmName] || !m.points || m.points.length === 0) return null;
        const pts = m.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (pts.length < 2) return null;

        const isFocused = m.algorithmName === selectedModelName;
        const isBaseline = m.algorithmName.includes('Baseline');

        const pathD = pts
          .map((p, idx) => {
            const { x, y } = project(p.lat, p.lng);
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ');

        return (
          <path
            key={m.algorithmName}
            d={pathD}
            fill="none"
            stroke={m.color}
            strokeWidth={isFocused ? 3.5 : isBaseline ? 1.8 : 2.2}
            strokeDasharray={isBaseline || m.dash ? '6,4' : 'none'}
            strokeOpacity={isFocused ? 0.95 : isBaseline ? 0.45 : 0.65}
          />
        );
      })}

      {/* Marcadores numerados do modelo em evidência */}
      {selectedModel &&
        selectedModel.points &&
        selectedModel.points
          .filter(p => !p.isReturn && Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p, i) => {
            const { x, y } = project(p.lat, p.lng);
            const isStart = i === 0;
            return (
              <g key={i} transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }} onClick={() => onSelectStop(p)}>
                <circle r={isStart ? 13 : 11} fill={isStart ? '#2557D6' : selectedModel.color} stroke="#ffffff" strokeWidth="2" />
                <text textAnchor="middle" dy="4" fill="#ffffff" fontSize={isStart ? '10' : '9'} fontWeight="700">
                  {p.order}
                </text>
              </g>
            );
          })}
    </svg>
  );
}
