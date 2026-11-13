'use client';
/*
 * Porta de entrada das páginas internas: só renderiza no navegador, exige login de gestor
 * e, no modo API, carrega os dados da Orbi API antes de mostrar as telas.
 */
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import PageFrame from './Shell';
import { useOrbi, useIsClient } from '@/lib/orbi/useOrbi';
import { KEY } from '@/lib/orbi/portal';

export default function PortalGate({ children }: { children: ReactNode }) {
  const mounted = useIsClient();
  if (!mounted) return <div className="boot"><span className="loader-ring" /></div>;
  return <Gate>{children}</Gate>;
}

function Gate({ children }: { children: ReactNode }) {
  const P = useOrbi();
  const router = useRouter();
  const me = P.me();

  useEffect(() => { if (!me) router.replace('/login'); }, [me, router]);

  // modo API: primeira carga + atualização periódica
  const needsLoad = P.API && me && !P.sync.last;
  useEffect(() => {
    if (!P.API || !me) return;
    let alive = true;
    if (!P.sync.last) {
      const load = () => P.syncNow(true).finally(() => { if (!alive) return; if (P.sync.last) P.startPolling(); else setTimeout(load, 4000); });
      load();
    } else if (!P.isPolling()) P.startPolling();
    return () => { alive = false; };
  }, [P, me, needsLoad]);

  // modo demonstração: mudanças feitas no app (outra aba) chegam na hora; horários relativos a cada minuto
  useEffect(() => {
    if (P.API) return;
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) P.reload(); };
    window.addEventListener('storage', onStorage);
    const t = setInterval(() => { if (!document.querySelector('.layer')) P.reload(); }, 60000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, [P]);

  if (!me) return null;
  if (needsLoad) {
    const st = P.sync.state;
    return (
      <PageFrame active="" title="Carregando…" noHead>
        <section className="card loading-card"><span className="loader-ring" />
          <h3>{st === 'waking' ? 'Acordando o servidor da Orbi API…' : st === 'error' ? 'Não foi possível conectar à Orbi API' : 'Carregando dados da Orbi API…'}</h3>
          <p className="muted">{st === 'error' ? (P.sync.error || '') + ' · tentando de novo…' : 'O plano gratuito do Render pode levar até 1 minuto para acordar.'}</p>
        </section>
      </PageFrame>
    );
  }
  return <>{children}</>;
}
