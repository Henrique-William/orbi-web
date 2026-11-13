'use client';
/*
 * Detalhe do motorista: indicadores de 30 dias, desempenho, veículo/contato, rotas e avaliações.
 */
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PageFrame, { NotFound } from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { Kpi, Of, COLORS, StatusBadge, Progress, Empty, driverStats } from '@/components/common';
import { LineChart } from '@/components/charts';
import { vehicleModal } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { toast } from '@/lib/orbi/ui';
import { num, date, fmtMin, initials, ROUTE_STATUS, OWNERSHIP } from '@/lib/orbi/format';

export default function DriverPage() {
  const P = useOrbi();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const d = P.user(decodeURIComponent(id));
  if (!d || d.role !== 'DRIVER') return <NotFound />;
  const hist = P.history(30); const s30 = driverStats(d.id, hist); const st = P.driverState(d);
  const v = P.API ? { ownership: 'PERSONAL', model: '', plate: '' } : P.vehicleOf(d); const ins = P.API ? {} as any : P.insuranceOf(d);
  const rs = P.S.routes.filter((r: any) => r.driverId === d.id).sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const reviews = P.S.reviews.filter((r: any) => r.driverId === d.id);
  const lastChat = rs.find((r: any) => r.status !== 'COMPLETED') || rs[0];

  return (
    <PageFrame active="drivers" title={d.name} path={[{ href: '/drivers', label: 'Motoristas' }]} noHead>
      <div className="page-head">
        <Link className="icon-btn" href="/drivers" aria-label="Voltar"><Icon name="back" /></Link>
        <span className="avatar lg">{initials(d.name)}</span>
        <div className="ph-main"><h2>{d.name}</h2><span className="row wrap" style={{ gap: 6 }}><span className={`badge ${st[1]}`}>{st[0]}</span><span className="muted small">{[d.email, d.phone].filter(Boolean).join(' · ')} · desde {date(d.since || new Date())}</span></span></div>
        <div className="row wrap ph-actions">
          <button className="btn ghost" onClick={() => toast(`Ligando para ${d.name}${d.phone ? ` (${d.phone})` : ''}… (simulado)`, 'phone')}><Icon name="phone" size="sm" /> Ligar</button>
          {lastChat && !P.API && <Link className="btn ghost" href={'/messages/' + lastChat.id}><Icon name="chat" size="sm" /> Mensagem</Link>}
          <Link className="btn primary" href="/routes/new"><Icon name="plus" size="sm" /> Nova rota</Link>
        </div>
      </div>
      <div className="kpi-grid k5">
        <Kpi label="Entregas · 30 dias" color={COLORS.ok} value={s30.delivered} sub={`${s30.stops} paradas`} spark={s30.series.slice(-14)} href="/reports" />
        <Kpi label="Taxa de sucesso" color={COLORS.blue} value={s30.success + '%'} sub={`${s30.skipped} puladas · ${s30.cancelled} canceladas`} href="/reports" />
        <Kpi label={P.API ? 'Rotas · 30 dias' : 'Pontualidade'} color={COLORS.violet} value={P.API ? s30.routes : s30.onTime + '%'} sub={P.API ? 'criadas no período' : `${s30.routes} rotas`} href="/reports" />
        <Kpi label="Distância" color={COLORS.teal} value={<>{num(s30.km, 0)}<Of> km</Of></>} sub={`${fmtMin(s30.minutes / Math.max(1, s30.days))} por dia`} href="/reports" />
        {P.API
          ? <Kpi label="Rotas ativas" color={COLORS.amber} value={rs.filter((x: any) => ['ASSIGNED', 'IN_PROGRESS'].includes(x.status)).length} sub="atribuídas ou em andamento" href="/routes" />
          : <Kpi label="Avaliação" color={COLORS.amber} value={<>{num(d.rating || 0, 1)}<Of> / 5</Of></>} sub={`${d.ratingsCount || 0} avaliações`} href="/drivers" />}
      </div>
      <div className="grid g-2-1">
        <section className="card"><div className="card-head"><h3>Desempenho · 30 dias</h3></div>
          <LineChart labels={hist.map((x: any) => x.label)} series={[{ name: 'Entregas', color: COLORS.blue, values: s30.series, area: true }]} height={200} tipLabels={hist.map((x: any) => `${x.wd} ${x.label}`)} /></section>
        {P.API ? (
          <section className="card"><div className="card-head"><h3>Contato</h3></div>
            <div className="kv compact"><div><span>Telefone</span><b>{d.phone || '—'}</b></div><div><span>E-mail</span><b>{d.email || '—'}</b></div><div><span>CNH</span><b>{d.cnh ? '•••••' + String(d.cnh).slice(-4) : '—'}</b></div><div><span>Cadastro</span><b>{d.since ? date(d.since) : '—'}</b></div></div>
            <p className="muted small">Veículo e seguro ainda não existem na Orbi API.</p></section>
        ) : (
          <section className="card"><div className="card-head"><h3>Veículo</h3><button className="link" onClick={() => vehicleModal(P, d)}><Icon name="edit" size="xs" /> Editar</button></div>
            <div className="veh"><span className="veh-ic"><Icon name="truck" /></span><span><b>{v.model}</b><small>{v.plate}</small></span><span className={`badge ${OWNERSHIP[v.ownership][1]}`}>{OWNERSHIP[v.ownership][0]}</span></div>
            <div className="kv compact"><div><span>Seguradora</span><b>{ins.insurer || '—'}</b></div><div><span>Apólice</span><b>{ins.policy || '—'}</b></div><div><span>Assistência 24h</span><b>{ins.phone ? ins.phone : <span className="txt-amber">Não cadastrada</span>}</b></div><div><span>Quem cadastra</span><b>{v.ownership === 'COMPANY' ? 'A gestão (você)' : 'O motorista, pelo app'}</b></div></div></section>
        )}
      </div>
      <div className="grid g-2-1">
        <section className="card pad0"><div className="card-head pad"><h3>Rotas</h3></div>
          {rs.length ? <table className="tbl"><thead><tr><th>Rota</th><th>Status</th><th>{P.API ? 'Criação' : 'Janela'}</th><th>Progresso</th><th /></tr></thead>
            <tbody>{rs.map((r: any) => { const inf = P.routeInfo(r); return (
              <tr key={r.id} onClick={() => router.push('/routes/' + r.id)}><td data-l="Rota"><b>{r.code}</b></td><td data-l="Status"><StatusBadge map={ROUTE_STATUS} st={r.status} /></td><td data-l="Janela">{r.window}</td>
                <td data-l="Progresso"><span className="prog-cell"><Progress value={inf.pct} /><small>{inf.handled}/{inf.total}</small></span></td><td className="chev"><Icon name="chev" size="sm" /></td></tr>
            ); })}</tbody></table> : <Empty icon="route" title="Sem rotas" text="Nenhuma rota atribuída." />}</section>
        {!P.API && <section className="card"><div className="card-head"><h3>Avaliações dos clientes</h3></div>
          {reviews.length ? reviews.map((x: any, i: number) => (
            <div key={i} className="review"><span className="stars">{'★'.repeat(x.stars)}<i>{'★'.repeat(5 - x.stars)}</i></span><p>“{x.text}”</p><small>{x.author}</small></div>
          )) : <p className="muted small">Sem avaliações ainda.</p>}</section>}
      </div>
    </PageFrame>
  );
}
