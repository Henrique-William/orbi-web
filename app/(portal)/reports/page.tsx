'use client';
/*
 * Relatórios: indicadores do período, resumo, gráficos, mapa de calor e desempenho por motorista.
 */
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import PageFrame from '@/components/Shell';
import { Icon, Logo } from '@/components/Icon';
import { Kpi, Of, COLORS, Progress, Legend, avg, successSeries, workDays, driverStats, usePageState } from '@/components/common';
import { StackedBars, Donut, LineChart, Heat } from '@/components/charts';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { downloadCSV, toast } from '@/lib/orbi/ui';
import { num, pct, money, date, initials } from '@/lib/orbi/format';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HRS = Array.from({ length: 13 }, (_, i) => `${7 + i}h`);

export default function ReportsPage() {
  const P = useOrbi();
  const router = useRouter();
  const [st, set] = usePageState('relatorios', { days: 14 });
  const hist = P.history(st.days - 1); const t = P.todayStats();
  const today = { label: 'Hoje', wd: 'hoje', routes: t.routes, stops: t.stops, delivered: t.delivered, skipped: t.skipped, cancelled: t.cancelled, km: t.km, minutes: 0, onTime: 0, reasons: t.reasons, hours: t.hours, drivers: {}, dow: new Date().getDay() };
  const days = hist.concat([today]);
  const sum = (k: string) => days.reduce((a: number, d: any) => a + d[k], 0);
  const stops = sum('stops'), del = sum('delivered'), kmv = sum('km'), routes = sum('routes');
  const goals = P.S.company.goals || { successRate: 92, onTime: 90 };
  const success = successSeries(days);
  const onTime = pct(hist.reduce((a: number, d: any) => a + d.onTime, 0), hist.reduce((a: number, d: any) => a + d.routes, 0) || 1);
  const cost = kmv * 1.85 + stops * 2.5;
  const reasons: Record<string, number> = {};
  days.forEach((d: any) => Object.entries(d.reasons).forEach(([k, v]: any) => { reasons[k] = (reasons[k] || 0) + v; }));
  const heat = WD.map((_, w) => HRS.map((_, j) => days.filter((d: any) => d.dow === w).reduce((a: number, d: any) => a + d.hours[7 + j], 0)));
  const drows = P.drivers().map((d: any) => Object.assign({ d }, driverStats(d.id, hist))).sort((a: any, b: any) => b.delivered - a.delivered);
  const best = drows.slice().sort((a: any, b: any) => b.success - a.success)[0];
  const worstDay = workDays(hist).slice().sort((a: any, b: any) => pct(a.delivered, a.stops) - pct(b.delivered, b.stops))[0];
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  const avgSucc = Math.round(avg(workDays(days).map((d: any) => pct(d.delivered, d.delivered + d.skipped + d.cancelled || 1))));
  const insights: ReactNode[] = [
    best && <><b>{best.d.name}</b> teve a melhor taxa de sucesso do período ({best.success}%).</>,
    topReason && <>O motivo de ocorrência mais comum foi <b>“{topReason[0]}”</b> ({topReason[1]}×). {/ausente|fechado/i.test(topReason[0]) ? 'Avisar o cliente antes da entrega pode reduzir esse número.' : /bloqueada|obras/i.test(topReason[0]) ? 'Vale revisar os trajetos dessas regiões.' : 'Vale investigar com a equipe.'}</>,
    worstDay && <>O pior dia foi <b>{worstDay.wd} {worstDay.label}</b>, com {pct(worstDay.delivered, worstDay.stops)}% de sucesso.</>,
    <>A taxa média de sucesso ficou em <b>{avgSucc}%</b>, {avgSucc >= goals.successRate ? 'acima' : 'abaixo'} da meta de {goals.successRate}%.</>,
    <>Custo estimado de <b>{money(cost / Math.max(1, del))}</b> por entrega concluída.</>
  ].filter(Boolean);
  const csv = () => {
    downloadCSV(`orbi-relatorio-${st.days}d.csv`, [['Dia', 'Rotas', 'Paradas', 'Entregues', 'Puladas', 'Canceladas', 'Sucesso (%)', 'Km']].concat(days.map((d: any, i: number) => [d.label, d.routes, d.stops, d.delivered, d.skipped, d.cancelled, success[i], num(d.km, 1)])));
    toast('Relatório CSV gerado', 'download');
  };
  const tipLabels = days.map((d: any) => `${d.wd} ${d.label}`);

  return (
    <PageFrame active="reports" title="Relatórios" sub={`Últimos ${st.days} dias · ${days[0].label} a hoje`}
      actions={<>
        <div className="seg">{[7, 14, 30].map(n => <button key={n} className={st.days === n ? 'on' : ''} onClick={() => set({ days: n })}>{n} dias</button>)}</div>
        <button className="btn ghost" onClick={csv}><Icon name="download" size="sm" /> Exportar CSV</button>
        <button className="btn ghost" onClick={() => window.print()}><Icon name="printer" size="sm" /> Imprimir</button>
      </>}>
      <div className="print-head"><span className="brand-logo"><Logo /></span><div><b>{P.S.company.name}</b><small>Relatório operacional · {days[0].label} a {date(new Date())} · gerado por {P.me().name}</small></div></div>
      <div className="kpi-grid k6">
        <Kpi label="Entregas" color={COLORS.ok} value={num(del)} sub={`${num(stops)} paradas`} spark={days.map((d: any) => d.delivered)} />
        <Kpi label="Taxa de sucesso" color={COLORS.blue} value={avgSucc + '%'} sub={`meta ${goals.successRate}%`} spark={success} />
        {P.API
          ? <Kpi label="Ocorrências" color={COLORS.violet} value={num(sum('skipped') + sum('cancelled'))} sub={`${sum('skipped')} puladas · ${sum('cancelled')} canceladas`} />
          : <Kpi label="Pontualidade" color={COLORS.violet} value={onTime + '%'} sub={`meta ${goals.onTime}%`} />}
        <Kpi label="Rotas" color={COLORS.sky} value={num(routes)} sub={`${num(routes / days.length, 1)} por dia`} />
        <Kpi label="Distância" color={COLORS.teal} value={<>{num(kmv, 0)}<Of> km</Of></>} sub={`${num(kmv / Math.max(1, del), 1)} km por entrega`} />
        <Kpi label="Custo estimado" color={COLORS.skip} value={money(cost)} sub={`${money(cost / Math.max(1, del))} por entrega`} />
      </div>
      <section className="card insights"><div className="card-head"><h3>Resumo do período</h3></div><ul>{insights.map((i, k) => <li key={k}>{i}</li>)}</ul></section>
      <div className="grid g-2-1">
        <section className="card"><div className="card-head"><h3>Entregas por dia</h3></div>
          <StackedBars labels={days.map((d: any) => d.label)} highlightLast tipLabels={tipLabels}
            stacks={[{ name: 'Entregues', color: COLORS.ok, values: days.map((d: any) => d.delivered) }, { name: 'Puladas', color: COLORS.skip, values: days.map((d: any) => d.skipped) }, { name: 'Canceladas', color: COLORS.cancel, values: days.map((d: any) => d.cancelled) }]} />
          <Legend /></section>
        <section className="card"><div className="card-head"><h3>Motivos de ocorrência</h3></div>
          <Donut center={num(Object.values(reasons).reduce((a, b) => a + b, 0))} sub="ocorrências"
            segs={Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v], i) => ({ label: k, value: v, color: [COLORS.cancel, COLORS.skip, COLORS.violet, COLORS.sky, COLORS.gray][i] }))} /></section>
      </div>
      <div className="grid g-1-1">
        <section className="card"><div className="card-head"><h3>Taxa de sucesso diária</h3><span className="muted small">linha tracejada = meta</span></div>
          <LineChart labels={days.map((d: any) => d.label)} max={100} unit="%" height={200} tipLabels={tipLabels}
            series={[{ name: 'Sucesso', color: COLORS.blue, values: success, area: true }, { name: 'Meta', color: COLORS.cancel, values: days.map(() => goals.successRate), dash: true }]} /></section>
        <section className="card"><div className="card-head"><h3>Entregas por dia da semana e horário</h3></div><Heat rows={WD} cols={HRS} matrix={heat} /></section>
      </div>
      <section className="card pad0"><div className="card-head pad"><h3>Desempenho por motorista</h3><span className="muted small">período selecionado, sem o dia de hoje</span></div>
        <table className="tbl"><thead><tr><th>Motorista</th><th>Rotas</th><th>Entregas</th><th>Sucesso</th>{!P.API && <th>Pontualidade</th>}<th>Km</th><th>Custo/entrega</th>{!P.API && <th>Avaliação</th>}</tr></thead>
          <tbody>{drows.map((x: any) => (
            <tr key={x.d.id} onClick={() => router.push('/drivers/' + x.d.id)}>
              <td data-l="Motorista"><span className="who"><span className="avatar xs">{initials(x.d.name)}</span>{x.d.name}</span></td><td data-l="Rotas">{x.routes}</td><td data-l="Entregas">{x.delivered}</td>
              <td data-l="Sucesso"><span className="prog-cell"><Progress value={x.success} tone={x.success >= goals.successRate ? 'green' : 'amber'} /><small>{x.success}%</small></span></td>
              {!P.API && <td data-l="Pontualidade">{x.onTime}%</td>}
              <td data-l="Km">{num(x.km, 0)}</td><td data-l="Custo/entrega">{money((x.km * 1.85 + x.stops * 2.5) / Math.max(1, x.delivered))}</td>
              {!P.API && <td data-l="Avaliação">{num(x.rating, 1)}</td>}
            </tr>
          ))}</tbody></table></section>
      <p className="muted small center" style={{ margin: '16px 0 4px' }}>{P.API ? 'Dados reais da Orbi API (os mesmos do app do motorista). Distâncias estimadas pelas coordenadas das entregas.' : 'Dias anteriores: histórico simulado para demonstração. Hoje: dados do app.'}</p>
    </PageFrame>
  );
}
