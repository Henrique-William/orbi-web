/*
 * Peças comuns das telas: etiquetas, indicadores, barras de progresso e cálculos compartilhados.
 */
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Spark } from './charts';
import { esc, pct, pad2, PRIORITY, STOP_STATUS } from '@/lib/orbi/format';

export const COLORS = { ok: '#0F9F6E', skip: '#E59A1A', cancel: '#D64545', blue: '#2557D6', sky: '#3E8EDE', violet: '#6E56CF', pink: '#C2417A', teal: '#14857A', amber: '#F59E0B', gray: '#94A3B8' };

export function Badge({ tone, children, tip }: { tone: string; children: ReactNode; tip?: string }) {
  return <span className={`badge ${tone}`} data-tip={tip}>{children}</span>;
}
export function StatusBadge({ map, st }: { map: Record<string, [string, string]>; st: string }) {
  const v = map[st] || [st, 'neutral'];
  return <span className={`badge ${v[1]}`}>{v[0]}</span>;
}

export function HealthDot({ P, r }: { P: any; r: any }) {
  const h = P.health(r);
  const tip = `<b>${({ ok: 'Tudo certo', warn: 'Requer atenção', bad: 'Ação necessária' } as any)[h.worst]}</b>${h.checks.filter((c: any) => c[0] !== 'ok').map((c: any) => `<div>• ${esc(c[1])}</div>`).join('')}`;
  return <span className={`hdot ${h.worst}`} data-tip={tip} />;
}

export function RouteFlags({ P, r }: { P: any; r: any }) {
  return (
    <>
      {P.hasSos(r.id) && <span className="badge red"><Icon name="shield" size="xs" /> SOS</span>}
      {P.prioRank(r) > 0 && <span className={`badge ${PRIORITY[r.priority.level][1]}`}><Icon name="zap" size="xs" /> {PRIORITY[r.priority.level][0]}</span>}
    </>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  return <span className={`bar ${tone || ''}`}><i style={{ width: `${value}%` }} /></span>;
}

export function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty"><Icon name={icon} size="lg" /><h3>{title}</h3><p>{text}</p></div>;
}

export type KpiProps = { label: string; color: string; value: ReactNode; sub?: ReactNode; spark?: number[]; href?: string; tip?: string; foot?: ReactNode; delta?: number | null; deltaUnit?: string; goodUp?: boolean };
export function Kpi(o: KpiProps) {
  const delta = o.delta == null ? null : (
    <span className={`delta ${(o.delta >= 0) === (o.goodUp !== false) ? 'up' : 'down'}`}>{o.delta >= 0 ? '▲' : '▼'} {Math.abs(o.delta)}{o.deltaUnit || '%'}</span>
  );
  return (
    <Link className="kpi card" href={o.href || '/reports'} data-tip={o.tip}>
      <div className="kpi-top"><span className="kpi-label">{o.label}</span>{delta}</div>
      <div className="kpi-val">{o.value}{o.sub ? <small>{o.sub}</small> : null}</div>
      {o.spark && <div className="kpi-spark"><Spark values={o.spark} color={o.color} /></div>}
      {o.foot && <div className="kpi-foot">{o.foot}</div>}
    </Link>
  );
}
export const Of = ({ children }: { children: ReactNode }) => <span className="of">{children}</span>;

export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// taxa de sucesso por dia; dias sem operação herdam o valor anterior (não contam como 0%)
export function successSeries(days: any[]) {
  let last: number | null = null;
  const raw = days.map(d => { const t = d.delivered + d.skipped + d.cancelled; return t ? pct(d.delivered, t) : null; });
  const firstV = raw.find(v => v != null);
  return raw.map(v => { if (v != null) last = v; return v != null ? v : (last != null ? last : (firstV != null ? firstV : 0)); });
}
export const workDays = (days: any[]) => days.filter(d => d.stops > 0);
export function driverStats(id: any, hist: any[]) {
  const ds = hist.map(d => d.drivers[id]).filter(Boolean);
  const sum = (k: string) => ds.reduce((a, x) => a + x[k], 0);
  const stops = sum('stops'), del = sum('delivered');
  return { days: ds.length, routes: sum('routes'), stops, delivered: del, skipped: sum('skipped'), cancelled: sum('cancelled'), km: sum('km'), minutes: sum('minutes'), success: pct(del, stops), onTime: pct(sum('onTime'), sum('routes') || 1), rating: ds.length ? avg(ds.map(x => x.rating)) : 0, series: hist.map(d => (d.drivers[id] ? d.drivers[id].delivered : 0)) };
}

/** Lista unificada de ocorrências (alertas, revisões, paradas com problema, atrasos). */
export function occurrences(P: any) {
  const out: any[] = [];
  P.S.incidents.forEach((i: any) => { const d = P.user(i.driverId); out.push({ id: 'i:' + i.id, kind: 'SOS', open: i.status === 'OPEN', at: i.at, icon: 'shield', tone: 'red', title: `${i.label} · ${d ? d.name : ''}`, sub: `Perto de ${i.street}${i.routeId ? ' · ' + (P.route(i.routeId) || {}).code : ''}`, status: i.status === 'OPEN' ? (i.seenAt ? 'Acompanhando' : 'Novo') : 'Resolvido', ref: i }); });
  P.S.routes.forEach((r: any) => {
    const d = P.user(r.driverId);
    r.stops.forEach((s: any, idx: number) => {
      if (s.review && s.review.status === 'REQUESTED') out.push({ id: `rv:${r.id}:${s.id}`, kind: 'REVIEW', open: true, at: s.review.at, icon: 'chat', tone: 'violet', title: `Revisão pedida · ${r.code} #${pad2(idx + 1)}`, sub: `${d ? d.name : ''}: ${s.review.text || STOP_STATUS[s.status][0]}`, status: 'Aguardando você', r, s });
      if (s.status === 'SKIPPED' || s.status === 'CANCELLED') {
        const answered = (s.comments || []).some((c: any) => c.role === 'ADMIN');
        out.push({ id: `st:${r.id}:${s.id}`, kind: s.status, open: P.isToday(r) && !answered, at: s.at, icon: s.status === 'SKIPPED' ? 'skip' : 'xcircle', tone: s.status === 'SKIPPED' ? 'amber' : 'red', title: `${STOP_STATUS[s.status][0]} · ${r.code} #${pad2(idx + 1)}`, sub: `${s.reason || ''} · ${P.stopAddr(s)}`, status: answered ? 'Respondida' : 'Sem resposta', r, s });
      }
    });
    if (r.status === 'DELAYED') out.push({ id: 'dl:' + r.id, kind: 'DELAY', open: true, at: (P.windowStart(r) || new Date()).toISOString(), icon: 'clock', tone: 'red', title: `Rota atrasada · ${r.code}`, sub: `${d ? d.name : 'Sem motorista'} · janela ${r.window}`, status: r.priority ? 'Alerta enviado' : 'Sem ação', r });
    if (r.status === 'CREATED') out.push({ id: 'nd:' + r.id, kind: 'NODRIVER', open: true, at: r.createdAt, icon: 'users', tone: 'amber', title: `Rota sem motorista · ${r.code}`, sub: `${r.stops.length} paradas · ${r.window}`, status: 'Sem ação', r });
    if (r.priority && r.priority.requireAck && !r.priority.ackAt && r.status !== 'COMPLETED') out.push({ id: 'pa:' + r.id, kind: 'ACK', open: true, at: r.priority.at, icon: 'zap', tone: 'amber', title: `Aguardando “Ciente” · ${r.code}`, sub: `${d ? d.name : ''} ainda não confirmou o alerta`, status: 'Aguardando', r });
  });
  return out.sort((a, b) => (Number(b.open) - Number(a.open)) || (Date.parse(b.at || 0) - Date.parse(a.at || 0)));
}
export const openOccurrences = (P: any) => occurrences(P).filter(o => o.open);

/** Estado de tela que sobrevive à troca de página (filtros, busca, aba). */
const memo = new Map<string, any>();
export function remembered<T>(key: string, init: T): T {
  if (!memo.has(key)) memo.set(key, init);
  return memo.get(key);
}

/** Como remembered(), mas redesenha a tela ao mudar: const [st, set] = usePageState('rotas', {...}). */
export function usePageState<T extends object>(key: string, init: T): [T, (patch: Partial<T>) => void] {
  const obj = remembered(key, init);
  const [, force] = useState(0);
  return [obj, (patch: Partial<T>) => { Object.assign(obj, patch); force(x => x + 1); }];
}

export function Legend() {
  return <div className="legend-row"><span><i style={{ background: COLORS.ok }} />Entregues</span><span><i style={{ background: COLORS.skip }} />Puladas</span><span><i style={{ background: COLORS.cancel }} />Canceladas</span></div>;
}
