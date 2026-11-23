'use client';
/*
 * Porta de entrada das páginas internas: só renderiza no navegador, exige login de gestor
 * e carrega os dados da Orbi API antes de mostrar as telas.
 */
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import PageFrame from './Shell';
import { useOrbi, useIsClient } from '@/lib/orbi/useOrbi';

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

  // Carga inicial + atualização periódica via Orbi API
  const needsLoad = me && !P.sync.last;
  useEffect(() => {
    if (!me) return;
    let alive = true;
    if (!P.sync.last) {
      const load = () => P.syncNow(true).finally(() => { if (!alive) return; if (P.sync.last) P.startPolling(); else setTimeout(load, 4000); });
      load();
    } else if (!P.isPolling()) P.startPolling();
    return () => { alive = false; };
  }, [P, me, needsLoad]);

  if (!me) return null;
  if (needsLoad) {
    const st = P.sync.state;
    return (
      <PageFrame active="" title="Carregando…" noHead>
        <section className="card loading-card"><span className="loader-ring" />
          <h3>{st === 'waking' ? 'Acordando o servidor da Orbi API…' : st === 'error' ? 'Não foi possível conectar à Orbi API' : 'Carregando dados da Orbi API…'}</h3>
          <p className="muted">{st === 'error' ? (P.sync.error || '') + ' · tentando de novo…' : 'O servidor em nuvem pode levar alguns instantes para responder.'}</p>
        </section>
      </PageFrame>
    );
  }
  return <>{children}</>;
}
