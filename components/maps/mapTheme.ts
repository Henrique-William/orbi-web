'use client';
/*
 * Tema e estilos escuros oficiais para o Google Maps JavaScript API (Orbi Logística).
 * Suporta detecção em tempo real via MutationObserver (data-theme="dark") e prefers-color-scheme.
 */
import { useEffect, useState } from 'react';

/**
 * Estilos oficiais de Modo Escuro (Dark Mode) para Google Maps Platform.
 * Otimizado para visualização noturna de frotas, contraste de rotas e legibilidade de ruas.
 */
export const GOOGLE_MAPS_DARK_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f2c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f9bb3' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c5d1e8' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8f9bb3' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#152422' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#528265' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#273144' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1c2433' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a0aec0' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#31405e' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e283b' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e2e8f0' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#20293a' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8f9bb3' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0f172a' }]
  }
];

/**
 * Hook para monitorar se a aplicação web está no Modo Escuro (Dark Mode).
 * Escuta tanto a mudança do atributo data-theme no <html> quanto o prefers-color-scheme do sistema.
 */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const dt = document.documentElement.dataset.theme;
    if (dt === 'dark') return true;
    if (dt === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false;
  });

  useEffect(() => {
    const checkDark = () => {
      const dt = document.documentElement.dataset.theme;
      if (dt === 'dark') return true;
      if (dt === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false;
    };

    setIsDark(checkDark());

    // Observa alterações no atributo data-theme em tempo real (ex.: quando o usuário troca nas Configurações)
    const observer = new MutationObserver(() => {
      setIsDark(checkDark());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Escuta também mudanças automáticas no sistema operacional
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleMql = () => setIsDark(checkDark());
    if (mql) {
      if (mql.addEventListener) {
        mql.addEventListener('change', handleMql);
      } else if ((mql as any).addListener) {
        (mql as any).addListener(handleMql);
      }
    }

    return () => {
      observer.disconnect();
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', handleMql);
        } else if ((mql as any).removeListener) {
          (mql as any).removeListener(handleMql);
        }
      }
    };
  }, []);

  return isDark;
}
