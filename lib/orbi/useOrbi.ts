'use client';
/*
 * Hook que liga uma tela ao estado do portal: redesenha quando os dados mudam
 * (ação do gestor, sincronização com a Orbi API ou mudança vinda do app em outra aba).
 */
import { useSyncExternalStore } from 'react';
import { getPortal } from './portal';

const noop = () => () => { };
export function useOrbi(): any {
  const P = typeof window === 'undefined' ? null : getPortal();
  useSyncExternalStore(P ? P.subscribe : noop, () => (P ? P.version() : 0), () => 0);
  return P;
}

/** true somente no navegador (o portal depende de localStorage/sessionStorage). */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}
