'use client';
/*
 * Peças globais: avisos (toasts), janela modal, confirmação e a dica flutuante dos gráficos (data-tip).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Icon } from './Icon';
import { toasts, modal, closeModal, confirmState } from '@/lib/orbi/ui';

function useStore<T>(s: { get: () => T; subscribe: (l: () => void) => () => void }, server: T) {
  return useSyncExternalStore(s.subscribe, s.get, () => server);
}

export function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('locked');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.body.classList.remove('locked'); document.removeEventListener('keydown', k); };
  }, [onClose]);
  return (
    <div className="layer">
      <div className="scrim" onClick={onClose} />
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default function UiHost() {
  const list = useStore(toasts, []);
  const m = useStore(modal, null);
  const c = useStore(confirmState, null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // dica flutuante para elementos com data-tip (conteúdo gerado pelo próprio portal, já escapado)
  useEffect(() => {
    const hide = () => { if (tipRef.current) { tipRef.current.remove(); tipRef.current = null; } };
    const move = (e: PointerEvent) => {
      const t = (e.target as Element).closest && (e.target as Element).closest('[data-tip]');
      if (!t) { hide(); return; }
      if (!tipRef.current) { tipRef.current = document.createElement('div'); tipRef.current.className = 'chart-tip'; document.body.appendChild(tipRef.current); }
      const tip = tipRef.current;
      tip.innerHTML = t.getAttribute('data-tip') || '';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 14, y = e.clientY - h - 12;
      if (x + w > innerWidth - 8) x = e.clientX - w - 14;
      if (y < 8) y = e.clientY + 18;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('scroll', hide, true); hide(); };
  }, []);

  return (
    <>
      <div id="toasts">{list.map(t => (
        <div key={t.id} className={`toast ${t.out ? 'out' : ''}`}>{t.icon && <Icon name={t.icon} size="sm" />}<span>{t.msg}</span></div>
      ))}</div>
      {m && <Modal title={m.title} wide={m.wide} onClose={closeModal}>{m.render(closeModal)}</Modal>}
      {c && (
        <Modal title={c.title} onClose={() => confirmState.set(null)}>
          <p className="muted" style={{ margin: '0 0 20px' }}>{c.text}</p>
          <div className="row end">
            <button className="btn ghost" onClick={() => confirmState.set(null)}>Cancelar</button>
            <button className={`btn ${c.danger ? 'danger' : 'primary'}`} onClick={() => { confirmState.set(null); c.run(); }}>{c.ok}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
