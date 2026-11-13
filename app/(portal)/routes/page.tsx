'use client';
/*
 * Rotas: busca, filtros por situação, ordenação, paginação e exportação em CSV.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { HealthDot, RouteFlags, StatusBadge, Progress, Empty, usePageState } from '@/components/common';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { downloadCSV, toast } from '@/lib/orbi/ui';
import { num, money, plural, initials, ROUTE_STATUS } from '@/lib/orbi/format';

const ORDER = ['IN_PROGRESS', 'DELAYED', 'CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'];
const PER = 25;
const CHIPS: [string, string][] = [['ALL', 'Todas'], ['ATTN', 'Precisam de atenção'], ['IN_PROGRESS', 'Em andamento'], ['DELAYED', 'Atrasadas'], ['ASSIGNED', 'A iniciar'], ['CREATED', 'Sem motorista'], ['COMPLETED', 'Concluídas']];

export default function RoutesPage() {
  const P = useOrbi();
  const router = useRouter();
  const [st, set] = usePageState('rotas', { q: '', st: 'ALL', sort: 'status', dir: 1, day: 'today', page: 0 });
  const base = P.S.routes.filter((r: any) => st.day === 'all' || P.isToday(r));
  const q = st.q.toLowerCase();
  const match = (r: any, s: string) => s === 'ALL' || r.status === s || (s === 'ATTN' && P.health(r).worst !== 'ok');
  const list = base.filter((r: any) => match(r, st.st)).filter((r: any) => {
    if (!q) return true; const d = P.user(r.driverId);
    return (r.code + ' ' + (d ? d.name : '') + ' ' + r.stops.map((s: any) => P.stopAddr(s) + ' ' + s.recipient).join(' ')).toLowerCase().includes(q);
  });
  const key: Record<string, (r: any) => any> = { status: r => ORDER.indexOf(r.status) * 10 - P.prioRank(r), code: r => r.code, driver: r => (P.user(r.driverId) || {}).name || 'zz', window: r => r.window, progress: r => P.routeInfo(r).pct, km: r => P.routeInfo(r).km, cost: r => P.routeInfo(r).cost };
  list.sort((a: any, b: any) => { const x = key[st.sort](a), y = key[st.sort](b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
  const nPages = Math.max(1, Math.ceil(list.length / PER)); const pg = Math.min(st.page, nPages - 1);
  const winLabel = P.API ? 'Criação' : 'Janela';
  const th = (k: string, l: string) => (
    <th key={k} className={st.sort === k ? 'sorted' : ''} style={{ cursor: 'pointer' }} onClick={() => set(st.sort === k ? { dir: st.dir * -1 } : { sort: k, dir: 1 })}>{l}{st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>
  );
  const csv = () => {
    downloadCSV(`orbi-rotas-${new Date().toISOString().slice(0, 10)}.csv`, [['Rota', 'Status', 'Motorista', winLabel, 'Paradas', 'Tratadas', 'Entregues', 'Puladas', 'Canceladas', 'Km', 'Custo (R$)']].concat(
      list.map((r: any) => { const i = P.routeInfo(r); return [r.code, ROUTE_STATUS[r.status][0], (P.user(r.driverId) || {}).name || '', r.window, i.total, i.handled, i.done, i.skipped, i.cancelled, num(i.km, 1), num(i.cost, 2)]; })));
    toast('Planilha CSV gerada', 'download');
  };

  return (
    <PageFrame active="routes" title="Rotas" sub={`${plural(base.length, 'rota', 'rotas')} ${st.day === 'today' ? 'hoje' : 'no total'}`}
      actions={<><button className="btn ghost" onClick={csv}><Icon name="download" size="sm" /> Exportar CSV</button><Link className="btn primary" href="/routes/new"><Icon name="plus" size="sm" /> Nova rota</Link></>}>
      <div className="toolbar">
        <div className="input grow"><Icon name="search" size="sm" /><input value={st.q} placeholder="Buscar por código, motorista, endereço ou cliente" onChange={e => set({ q: e.target.value, page: 0 })} /></div>
        <div className="seg">
          <button className={st.day === 'today' ? 'on' : ''} onClick={() => set({ day: 'today', page: 0 })}>Hoje</button>
          <button className={st.day === 'all' ? 'on' : ''} onClick={() => set({ day: 'all', page: 0 })}>Todas</button>
        </div>
      </div>
      <div className="chips">{CHIPS.map(x => <button key={x[0]} className={`chip ${st.st === x[0] ? 'on' : ''}`} onClick={() => set({ st: x[0], page: 0 })}>{x[1]} <em>{base.filter((r: any) => match(r, x[0])).length}</em></button>)}</div>
      <section className="card pad0">{list.length ? <>
        <table className="tbl">
          <thead><tr><th />{th('code', 'Rota')}{th('status', 'Status')}{th('driver', 'Motorista')}{th('window', winLabel)}{th('progress', 'Progresso')}{th('km', 'Distância')}{th('cost', 'Custo')}<th /></tr></thead>
          <tbody>{list.slice(pg * PER, pg * PER + PER).map((r: any) => {
            const inf = P.routeInfo(r); const d = P.user(r.driverId); const go = () => router.push('/routes/' + r.id);
            return (
              <tr key={r.id} tabIndex={0} onClick={go} onKeyDown={e => { if (e.key === 'Enter') go(); }}>
                <td data-l=""><HealthDot P={P} r={r} /></td>
                <td data-l="Rota"><b>{r.code}</b></td>
                <td data-l="Status"><span className="row wrap" style={{ gap: 4 }}><StatusBadge map={ROUTE_STATUS} st={r.status} /><RouteFlags P={P} r={r} /></span></td>
                <td data-l="Motorista">{d ? <span className="who"><span className="avatar xs">{initials(d.name)}</span>{d.name}</span> : <span className="muted">—</span>}</td>
                <td data-l={winLabel}>{r.window}</td>
                <td data-l="Progresso"><span className="prog-cell"><Progress value={inf.pct} tone={r.status === 'COMPLETED' ? 'green' : ''} /><small>{inf.handled}/{inf.total}</small></span></td>
                <td data-l="Distância">{num(inf.km, 1)} km</td>
                <td data-l="Custo">{money(inf.cost)}</td>
                <td className="chev"><Icon name="chev" size="sm" /></td>
              </tr>
            );
          })}</tbody>
        </table>
        {nPages > 1 && <div className="pager"><span>{pg * PER + 1}–{Math.min(list.length, pg * PER + PER)} de {list.length}</span>
          <span className="row"><button className="btn sm ghost" disabled={!pg} onClick={() => { set({ page: pg - 1 }); window.scrollTo(0, 0); }}>Anterior</button><button className="btn sm ghost" disabled={pg >= nPages - 1} onClick={() => { set({ page: pg + 1 }); window.scrollTo(0, 0); }}>Próxima</button></span></div>}
      </> : <Empty icon="route" title="Nenhuma rota encontrada" text="Ajuste a busca ou os filtros." />}</section>
    </PageFrame>
  );
}
