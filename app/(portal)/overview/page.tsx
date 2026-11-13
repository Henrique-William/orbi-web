'use client';
/*
 * Visão geral: indicadores do dia, entregas recentes, frota, rotas de hoje, motivos e ranking.
 */
import Link from 'next/link';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { Kpi, Of, COLORS, HealthDot, RouteFlags, StatusBadge, Progress, Empty, avg, successSeries, workDays, driverStats, openOccurrences, Legend } from '@/components/common';
import { StackedBars, Donut, HBars } from '@/components/charts';
import GeoMap from '@/components/maps/GeoMap';
import LiveMap from '@/components/maps/LiveMap';
import { incidentModal } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { useRouter } from 'next/navigation';
import { num, pct, money, plural, rel, initials, ROUTE_STATUS } from '@/lib/orbi/format';

export default function OverviewPage() {
  const P = useOrbi();
  const router = useRouter();
  const t = P.todayStats(); const hist = P.history(30); const h14 = hist.slice(-13); const h7 = hist.slice(-7);
  const goals = P.S.company.goals || { successRate: 92, onTime: 90 };
  const successToday = pct(t.delivered, t.delivered + t.skipped + t.cancelled);
  const avg7 = (k: string) => avg(h7.map((d: any) => d[k]));
  const succ7 = avg(workDays(h7).map((d: any) => pct(d.delivered, d.stops)));
  const occ = openOccurrences(P);
  const sos = P.openIncidents();
  const todayRoutes = P.S.routes.filter(P.isToday).sort((a: any, b: any) => P.health(b).worst.localeCompare(P.health(a).worst)).slice(0, 6);
  const labels = h14.map((d: any) => d.label).concat(['Hoje']);
  const reasons: Record<string, number> = {};
  hist.forEach((d: any) => Object.entries(d.reasons).forEach(([k, v]: any) => { reasons[k] = (reasons[k] || 0) + v; }));
  Object.entries(t.reasons).forEach(([k, v]: any) => { reasons[k] = (reasons[k] || 0) + v; });
  const rank = P.drivers().map((d: any) => Object.assign({ d }, driverStats(d.id, h7))).sort((a: any, b: any) => b.success - a.success || b.delivered - a.delivered);
  const activeDrivers = P.drivers().filter((d: any) => ['Em rota', 'SOS', 'Escalado'].includes(P.driverState(d)[0])).length;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const sub = `${today.charAt(0).toUpperCase() + today.slice(1)} · ${t.live ? plural(t.live, 'rota em andamento', 'rotas em andamento') : 'nenhuma rota em andamento'} · ${occ.length ? plural(occ.length, 'pendência', 'pendências') : 'sem pendências'}`;
  const mapRoutes = P.S.routes.filter((r: any) => P.isToday(r) && r.status !== 'COMPLETED');

  return (
    <PageFrame active="overview" title="Visão geral" sub={sub}
      actions={<><Link className="btn ghost" href="/reports"><Icon name="bars" size="sm" /> Relatórios</Link><Link className="btn primary" href="/routes/new"><Icon name="plus" size="sm" /> Nova rota</Link></>}>
      {sos.map((i: any) => { const d = P.user(i.driverId); return (
        <button key={i.id} className="sos-strip" onClick={() => incidentModal(P, i)}><span className="pulse-ic"><Icon name="shield" /></span>
          <span><b>Alerta de segurança · {d.name}</b><small>{i.label} · perto de {i.street} · {rel(i.at)}{i.seenAt ? ' · você está acompanhando' : ' · ainda não visualizado'}</small></span><span className="btn sm light">Ver alerta</span></button>
      ); })}
      <div className="kpi-grid">
        <Kpi label="Entregas concluídas" color={COLORS.ok} value={<>{t.delivered}<Of>/{t.stops}</Of></>} sub={`${t.pending} pendentes`} spark={h14.map((d: any) => d.delivered).concat([t.delivered])} href="/routes"
          tip={`<b>Entregas de hoje</b><div>${pct(t.delivered, t.stops)}% das paradas do dia · média diária: ${num(avg7('delivered'))}</div>`} foot={`${pct(t.delivered, t.stops)}% do planejado para hoje`} />
        <Kpi label="Taxa de sucesso" color={COLORS.blue} value={`${successToday}%`} sub={`meta ${goals.successRate}%`} spark={successSeries(h14).concat([successToday])} href="/reports"
          delta={workDays(h7).length ? successToday - Math.round(succ7) : null} deltaUnit=" p.p." tip={`<b>Entregues ÷ paradas tratadas</b><div>Média dos últimos 7 dias: ${Math.round(succ7)}%</div>`} />
        <Kpi label="Rotas em andamento" color={COLORS.sky} value={<>{t.live}<Of>/{t.routes}</Of></>} sub={t.delayed ? plural(t.delayed, 'atrasada', 'atrasadas') : 'nenhuma atrasada'} href="/live" foot={`${activeDrivers} de ${P.drivers().length} motoristas na operação`} />
        <Kpi label="Ocorrências abertas" color={COLORS.cancel} value={`${occ.length}`} sub={`${P.API ? '' : sos.length + ' SOS · '}${plural(t.skipped + t.cancelled, 'parada com problema', 'paradas com problema')}`} href="/occurrences" goodUp={false} foot={occ.length ? 'Ver e resolver' : 'Nenhuma pendência'} />
        {P.API
          ? <Kpi label="Rotas concluídas hoje" color={COLORS.violet} value={`${P.S.routes.filter((r: any) => P.isToday(r) && r.status === 'COMPLETED').length}`} sub={`de ${t.routes} rotas`} href="/routes" />
          : <Kpi label="Pontualidade · 7 dias" color={COLORS.violet} value={`${pct(h7.reduce((a: number, d: any) => a + d.onTime, 0), h7.reduce((a: number, d: any) => a + d.routes, 0) || 1)}%`} sub={`meta ${goals.onTime}%`} href="/reports" spark={h14.map((d: any) => pct(d.onTime, d.routes || 1))} foot={`Hoje: ${t.onTimePct}% das rotas iniciadas no horário`} tip="<b>Rotas iniciadas até 20 min após o início da janela</b>" />}
        <Kpi label="Distância prevista" color={COLORS.teal} value={<>{num(t.km, 1)}<Of> km</Of></>} sub={`média 7d ${num(avg7('km'), 0)} km`} href="/reports" spark={h14.map((d: any) => d.km).concat([t.km])} />
        <Kpi label="Custo estimado hoje" color={COLORS.skip} value={money(t.cost)} sub={t.delivered ? `${money(t.cost / Math.max(1, t.stops))} por parada` : ''} href="/reports" tip="<b>Estimativa</b><div>km × R$ 1,85 + R$ 2,50 por parada</div>" />
        {P.API
          ? <Kpi label="Motoristas" color={COLORS.amber} value={<>{activeDrivers}<Of>/{P.drivers().length}</Of></>} sub="em rota ou escalados" href="/drivers" />
          : <Kpi label="Avaliação média" color={COLORS.amber} value={<>{num(avg(P.drivers().map((d: any) => d.rating || 0)), 1)}<Of> / 5</Of></>} sub={`${P.S.reviews.length} avaliações recentes`} href="/drivers" />}
      </div>
      <div className="grid g-2-1">
        <section className="card"><div className="card-head"><h3>Entregas nos últimos 14 dias</h3><Link className="link" href="/reports">Ver relatório <Icon name="chev" size="xs" /></Link></div>
          <StackedBars labels={labels} highlightLast tipLabels={h14.map((d: any) => `${d.wd} ${d.label}`).concat(['Hoje (dados do app)'])}
            stacks={[{ name: 'Entregues', color: COLORS.ok, values: h14.map((d: any) => d.delivered).concat([t.delivered]) }, { name: 'Puladas', color: COLORS.skip, values: h14.map((d: any) => d.skipped).concat([t.skipped]) }, { name: 'Canceladas', color: COLORS.cancel, values: h14.map((d: any) => d.cancelled).concat([t.cancelled]) }]} />
          <Legend /></section>
        <section className="card"><div className="card-head"><h3>Paradas de hoje</h3></div>
          <Donut center={`${pct(t.delivered + t.skipped + t.cancelled, t.stops)}%`} sub="tratadas"
            segs={[{ label: 'Entregues', value: t.delivered, color: COLORS.ok }, { label: 'Pendentes', value: t.pending, color: COLORS.gray }, { label: 'Puladas', value: t.skipped, color: COLORS.skip }, { label: 'Canceladas', value: t.cancelled, color: COLORS.cancel }]} /></section>
      </div>
      <div className="grid g-1-1">
        <section className="card pad0"><div className="card-head pad"><h3>Frota ao vivo</h3><Link className="link" href="/live">Abrir mapa <Icon name="chev" size="xs" /></Link></div>
          {P.API ? <GeoMap P={P} routes={mapRoutes} className="mini-map" onPick={id => router.push('/routes/' + id)} /> : <LiveMap P={P} routes={mapRoutes} className="mini-map" legend onPick={id => router.push('/routes/' + id)} />}</section>
        <section className="card"><div className="card-head"><h3>Rotas de hoje</h3><Link className="link" href="/routes">Todas <Icon name="chev" size="xs" /></Link></div>
          <div className="rlist">{todayRoutes.length ? todayRoutes.map((r: any) => { const inf = P.routeInfo(r); const d = P.user(r.driverId); return (
            <Link key={r.id} className="rrow" href={'/routes/' + r.id}><HealthDot P={P} r={r} /><span className="rr-main"><b>{r.code}</b><small>{d ? d.name : 'Sem motorista'} · {r.window}</small></span>
              <span className="rr-flags"><RouteFlags P={P} r={r} /><StatusBadge map={ROUTE_STATUS} st={r.status} /></span><span className="rr-prog"><Progress value={inf.pct} tone={r.status === 'COMPLETED' ? 'green' : ''} /><small>{inf.handled}/{inf.total}</small></span></Link>
          ); }) : <Empty icon="route" title="Nenhuma rota hoje" text="Crie a primeira rota do dia." />}</div></section>
      </div>
      <div className="grid g-1-1">
        <section className="card"><div className="card-head"><h3>Motivos de ocorrência · 30 dias</h3><Link className="link" href="/occurrences">Ocorrências <Icon name="chev" size="xs" /></Link></div>
          <HBars items={Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v], i) => ({ label: k, value: v, color: i === 0 ? COLORS.cancel : i < 3 ? COLORS.skip : COLORS.gray }))} /></section>
        <section className="card"><div className="card-head"><h3>Ranking de motoristas · 7 dias</h3><Link className="link" href="/drivers">Motoristas <Icon name="chev" size="xs" /></Link></div>
          <div className="rank">{rank.map((x: any, i: number) => (
            <Link key={x.d.id} className="rank-row" href={'/drivers/' + x.d.id}><span className="pos">{i + 1}º</span><span className="avatar sm">{initials(x.d.name)}</span>
              <span className="rk-main"><b>{x.d.name}</b><small>{x.delivered} entregas{P.API ? '' : ` · nota ${num(x.d.rating || 0, 1)}`}</small></span><span className="rk-val"><b>{x.success}%</b><small>sucesso</small></span></Link>
          ))}</div></section>
      </div>
    </PageFrame>
  );
}

