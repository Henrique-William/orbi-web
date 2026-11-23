'use client';
/*
 * Tema e estilos escuros oficiais para o Google Maps JavaScript API (Orbi Logística).
 * Suporta detecção em tempo real via MutationObserver (data-theme="dark") e prefers-color-scheme.
 */
import { useEffect, useState } from 'react';

/**
 * Estilos oficiais de Modo Claro (Light Mode) Monocromático para Google Maps Platform (Brand Book Orbi).
 * Fundo off-white suave (#F7F7F5), vias brancas (#FFFFFF) e traçado em destaque Azul Orbi (#2557D6).
 */
export const GOOGLE_MAPS_LIGHT_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#f7f7f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f7f5' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e3' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#999999' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f0f0ee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#eef3eb' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#557755' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e3' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d8d8d4' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#f0f0ee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8898aa' }] }
];

/**
 * Estilos oficiais de Modo Escuro (Dark Mode) para Google Maps Platform.
 * Otimizado para visualização noturna em Preto Carbono (#0A0A0A) de alto contraste.
 */
export const GOOGLE_MAPS_DARK_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cccccc' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#111914' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#447755' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#161616' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#bbbbbb' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#777777' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d131f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0d131f' }] }
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
