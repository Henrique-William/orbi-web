'use client';
/*
 * Ocorrências: tudo que pede ação do gestor em uma só fila, com filtros e motivos informados.
 */
import { useRouter } from 'next/navigation';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { COLORS, Empty, occurrences, usePageState } from '@/components/common';
import { HBars } from '@/components/charts';
import { openOccurrence } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { rel } from '@/lib/orbi/format';

export default function OccurrencesPage() {
  const P = useOrbi();
  const router = useRouter();
  const [st, set] = usePageState('ocorrencias', { f: 'OPEN', q: '' });
  const all = occurrences(P);
  const F: [string, string, (o: any) => boolean][] = [['OPEN', 'Abertas', o => o.open]];
  if (!P.API) F.push(['SOS', 'SOS', o => o.kind === 'SOS' && o.open], ['REVIEW', 'Revisões', o => o.kind === 'REVIEW']);
  F.push(['DELAY', 'Atrasos', o => o.kind === 'DELAY' || o.kind === 'NODRIVER' || o.kind === 'ACK'], ['SKIPPED', 'Puladas', o => o.kind === 'SKIPPED'], ['CANCELLED', 'Canceladas', o => o.kind === 'CANCELLED'], ['DONE', P.API ? 'Anteriores' : 'Resolvidas', o => !o.open]);
  const fn = (F.find(x => x[0] === st.f) || F[0])[2];
  const q = st.q.toLowerCase();
  const list = all.filter(fn).filter(o => !q || (o.title + ' ' + o.sub).toLowerCase().includes(q));
  const reasons: Record<string, number> = {};
  P.S.routes.flatMap((r: any) => r.stops).filter((s: any) => s.reason).forEach((s: any) => { reasons[s.reason] = (reasons[s.reason] || 0) + 1; });
  const summary: [string, number][] = [
    ['SOS ativos', all.filter(o => o.kind === 'SOS' && o.open).length],
    ['Revisões pedidas', all.filter(o => o.kind === 'REVIEW').length],
    ['Atrasos e pendências', all.filter(o => ['DELAY', 'NODRIVER', 'ACK'].includes(o.kind)).length],
    ['Paradas sem resposta', all.filter(o => ['SKIPPED', 'CANCELLED'].includes(o.kind) && o.open).length]
  ];

  return (
    <PageFrame active="occurrences" title="Ocorrências" sub="Atrasos, paradas com problema e rotas sem motorista">
      <div className="sum-grid">{summary.map(s => <div key={s[0]} className="sum"><b>{s[1]}</b><span>{s[0]}</span></div>)}</div>
      <div className="grid g-2-1">
        <section>
          <div className="toolbar"><div className="input grow"><Icon name="search" size="sm" /><input value={st.q} placeholder="Buscar ocorrência" onChange={e => set({ q: e.target.value })} /></div></div>
          <div className="chips">{F.map(x => <button key={x[0]} className={`chip ${st.f === x[0] ? 'on' : ''}`} onClick={() => set({ f: x[0] })}>{x[1]} <em>{all.filter(x[2]).length}</em></button>)}</div>
          <div className="card pad0 occ-list">{list.length ? list.map(o => (
            <button key={o.id} className="occ" onClick={() => openOccurrence(P, o, router)}>
              <span className={`occ-ic ${o.tone}`}><Icon name={o.icon} size="sm" /></span>
              <span className="occ-main"><b>{o.title}</b><small>{o.sub}</small></span>
              <span className="occ-end"><span className={`badge ${o.open ? (o.tone === 'red' ? 'red' : 'amber') : 'green'}`}>{o.status}</span><small>{rel(o.at)}</small></span>
            </button>
          )) : <Empty icon="check" title="Nada por aqui" text="Nenhuma ocorrência neste filtro." />}</div>
        </section>
        <div className="stack"><section className="card"><div className="card-head"><h3>Motivos informados</h3><span className="muted small">dados do app</span></div>
          <HBars items={Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ label: k, value: v, color: i === 0 ? COLORS.cancel : COLORS.skip }))} empty="Nenhum motivo registrado." /></section></div>
      </div>
    </PageFrame>
  );
}
