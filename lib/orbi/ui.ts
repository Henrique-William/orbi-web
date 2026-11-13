/*
 * Estado das peças de interface globais (avisos e janelas), consumido por <UiHost/>.
 */
import type { ReactNode } from 'react';

type Listener = () => void;
function store<T>(initial: T) {
  let value = initial;
  const ls = new Set<Listener>();
  return {
    get: () => value,
    set: (v: T) => { value = v; ls.forEach(l => l()); },
    subscribe: (l: Listener) => { ls.add(l); return () => { ls.delete(l); }; }
  };
}

export type Toast = { id: number; msg: string; icon?: string; out?: boolean };
export const toasts = store<Toast[]>([]);
let seq = 0;
export function toast(msg: string, icon?: string) {
  const id = ++seq;
  toasts.set(toasts.get().concat([{ id, msg, icon }]));
  setTimeout(() => {
    toasts.set(toasts.get().map(t => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => toasts.set(toasts.get().filter(t => t.id !== id)), 300);
  }, 2800);
}

export type ModalState = { title: string; wide?: boolean; render: (close: () => void) => ReactNode } | null;
export const modal = store<ModalState>(null);
export function openModal(title: string, render: (close: () => void) => ReactNode, opts?: { wide?: boolean }) {
  modal.set({ title, render, wide: opts && opts.wide });
}
export function closeModal() { modal.set(null); }

/** Janela de confirmação simples. */
export const confirmState = store<{ title: string; text: string; ok: string; danger?: boolean; run: () => void } | null>(null);
export function confirmDialog(title: string, text: string, ok: string, danger: boolean, run: () => void) {
  confirmState.set({ title, text, ok, danger, run });
}

/** Tema: claro, escuro ou automático (segue o sistema). */
export function setTheme(t: string) {
  try { localStorage.setItem('orbi-portal-theme', t); } catch { /* ignora */ }
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function currentThemePref() {
  try { return localStorage.getItem('orbi-portal-theme') || 'auto'; } catch { return 'auto'; }
}

/** Gera e baixa um CSV (separador ;, compatível com Excel em português). */
export function downloadCSV(name: string, rows: any[][]) {
  const csv = rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
