'use client';
/*
 * Ao vivo: mapa da frota com a lista de rotas do dia e o detalhe da rota em foco.
 */
import Link from 'next/link';
import { useRef } from 'react';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { HealthDot, RouteFlags, StatusBadge, Progress, Empty, usePageState } from '@/components/common';
import GeoMap from '@/components/maps/GeoMap';
import LiveMap from '@/components/maps/LiveMap';
import { priorityModal } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { toast } from '@/lib/orbi/ui';
import { CONFIG } from '@/lib/orbi/config';
import { num, first, initials, ROUTE_STATUS } from '@/lib/orbi/format';

const keep: any = { view: null }; // enquadramento do mapa real entre visitas

export default function LivePage() {
  const P = useOrbi();
  const [st, set] = usePageState('ao-vivo', { focus: null as string | null, filter: 'ALL' });
  const wrap = useRef<HTMLDivElement>(null);
  const rs = P.S.routes.filter((r: any) => P.isToday(r) && r.status !== 'COMPLETED');
  const attn = (r: any) => P.health(r).worst !== 'ok';
  const FL: [string, string, number][] = [['ALL', 'Todas', rs.length], ['IN_PROGRESS', 'Em andamento', rs.filter((r: any) => r.status === 'IN_PROGRESS').length], ['LATE', 'Atenção', rs.filter(attn).length]];
  if (!P.API) FL.push(['SOS', 'SOS', rs.filter((r: any) => P.hasSos(r.id)).length]);
  const list = rs.filter((r: any) => st.filter === 'ALL' || (st.filter === 'IN_PROGRESS' && r.status === 'IN_PROGRESS') || (st.filter === 'LATE' && attn(r)) || (st.filter === 'SOS' && P.hasSos(r.id)));
  const f = st.focus && P.route(st.focus);
  const fullscreen = () => {
    const w = wrap.current; if (!w) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (w.requestFullscreen) w.requestFullscreen();
    else toast('Seu navegador não suporta tela cheia', 'info');
  };

  return (
    <PageFrame active="live" title="Ao vivo" sub={P.API ? 'Rotas e paradas da Orbi API, atualizadas automaticamente' : 'Posição estimada da frota em tempo real'}>
      <div className="live" ref={wrap}>
        <section className="live-map card pad0">
          {P.API ? <GeoMap P={P} routes={rs} keep={keep} focus={st.focus} onPick={id => set({ focus: id })} /> : <LiveMap P={P} routes={rs} viewKey="ao-vivo" focus={st.focus} onPick={id => set({ focus: id })} />}
          <div className="live-top"><span className="live-dot" /><b>{rs.filter((r: any) => r.status === 'IN_PROGRESS').length} em rota</b>
            <span className="muted small">{P.API ? `atualiza a cada ${CONFIG.pollSeconds} s · posição = última parada registrada` : 'atualiza a cada segundo'}</span>
            <button className="btn sm ghost" onClick={fullscreen}><Icon name="expand" size="sm" /> Tela cheia</button></div>
        </section>
        <aside className="live-side">
          <div className="chips">{FL.map(x => <button key={x[0]} className={`chip ${st.filter === x[0] ? 'on' : ''}`} onClick={() => set({ filter: x[0] })}>{x[1]} <em>{x[2]}</em></button>)}</div>
          {f && <FocusCard P={P} r={f} onClose={() => set({ focus: null })} />}
          <div className="live-list">{list.length ? list.map((r: any) => {
            const d = P.user(r.driverId); const inf = P.routeInfo(r); const pos = P.livePos(r); const n = P.nextStop(r);
            return (
              <button key={r.id} className={`lrow ${st.focus === r.id ? 'on' : ''}`} onClick={() => set({ focus: st.focus === r.id ? null : r.id })}>
                <span className="lr-color" style={{ background: P.routeColor(r) }} />
                <span className="avatar sm">{d ? initials(d.name) : '?'}</span>
                <span className="lr-main"><b>{r.code} · {d ? first(d.name) : 'sem motorista'}</b>
                  <small>{pos ? `Próxima: ${n ? P.stopAddr(n) : '—'} · ~${pos.eta} min` : `${ROUTE_STATUS[r.status][0]} · ${r.window}`}</small><Progress value={inf.pct} /></span>
                <span className="lr-end"><HealthDot P={P} r={r} /><RouteFlags P={P} r={r} /></span>
              </button>
            );
          }) : <Empty icon="radar" title="Nada neste filtro" text="Nenhuma rota corresponde ao filtro." />}</div>
        </aside>
      </div>
    </PageFrame>
  );
}

function FocusCard({ P, r, onClose }: { P: any; r: any; onClose: () => void }) {
  const d = P.user(r.driverId); const inf = P.routeInfo(r); const pos = P.livePos(r); const h = P.health(r);
  return (
    <div className="focus card">
      <div className="row between"><b>{r.code} <StatusBadge map={ROUTE_STATUS} st={r.status} /></b><button className="icon-btn sm" aria-label="Fechar" onClick={onClose}><Icon name="close" size="sm" /></button></div>
      <p className="muted small" style={{ margin: '4px 0 10px' }}>{d ? `${d.name}${P.API ? (d.phone ? ' · ' + d.phone : '') : ' · ' + d.vehicle}` : 'Sem motorista'}{pos ? ` · em ${P.streetAt(pos)}` : ''}</p>
      <div className="mini-stats"><span><b>{inf.handled}/{inf.total}</b>paradas</span><span><b>{pos ? `~${pos.eta} min` : '—'}</b>próxima</span><span><b>{num(inf.km, 1)}</b>km</span></div>
      {h.checks.filter((c: any) => c[0] !== 'ok').map((c: any, i: number) => <div key={i} className={`hc ${c[0]}`}><Icon name="alert" size="xs" /> {c[1]}</div>)}
      <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
        {!P.API && <><button className="btn sm ghost" onClick={() => priorityModal(P, r)}><Icon name="zap" size="sm" /> Prioridade</button><Link className="btn sm ghost" href={'/messages/' + r.id}><Icon name="chat" size="sm" /> Mensagem</Link></>}
        <Link className="btn sm primary" href={'/routes/' + r.id}>Abrir rota</Link>
      </div>
    </div>
  );
}
