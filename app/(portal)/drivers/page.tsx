'use client';
/*
 * Motoristas: situação atual, desempenho dos últimos 7 dias e veículo (ou contato, no modo API).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { COLORS, driverStats } from '@/components/common';
import { Spark } from '@/components/charts';
import { newDriverModal } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { num, plural, initials, OWNERSHIP } from '@/lib/orbi/format';

const STATE_TONE: Record<string, string> = { SOS: 'red', 'Em rota': 'blue', 'Disponível': 'green', Escalado: 'neutral' };

export default function DriversPage() {
  const P = useOrbi();
  const router = useRouter();
  const hist = P.history(7);
  const ds = P.drivers();
  return (
    <PageFrame active="drivers" title="Motoristas" sub={plural(ds.length, 'motorista cadastrado', 'motoristas cadastrados')}
      actions={P.API ? undefined : <button className="btn primary" onClick={() => newDriverModal(P, router)}><Icon name="plus" size="sm" /> Novo motorista</button>}>
      <div className="toolbar"><div className="row wrap" style={{ gap: 8 }}>
        {['Em rota', 'Escalado', 'Disponível', 'SOS'].map(s => { const n = ds.filter((d: any) => P.driverState(d)[0] === s).length; return n ? <span key={s} className={`badge ${STATE_TONE[s]}`}>{s}: {n}</span> : null; })}
      </div></div>
      <div className="dgrid">{ds.map((d: any) => {
        const st = P.driverState(d); const s7 = driverStats(d.id, hist);
        const v = P.API ? null : P.vehicleOf(d); const ins = P.API ? {} : P.insuranceOf(d);
        return (
          <Link key={d.id} className="dcard card" href={'/drivers/' + d.id}>
            <div className="row" style={{ gap: 12 }}><span className={`avatar lg ${st[0] === 'SOS' ? 'sos' : ''}`}>{initials(d.name)}</span>
              <span className="grow"><b>{d.name}</b><small className="block muted">{P.API ? d.email || d.phone || 'Motorista' : `Nota ${num(d.rating || 0, 1)} · ${d.ratingsCount || 0} avaliações`}</small></span>
              <span className={`badge ${st[1]}`}>{st[0]}</span></div>
            <div className="dc-stats"><span><b>{s7.delivered}</b>entregas 7d</span><span><b>{s7.success}%</b>sucesso</span><span><b>{P.API ? s7.routes : s7.onTime + '%'}</b>{P.API ? 'rotas 7d' : 'pontual'}</span></div>
            <div className="dc-spark"><Spark values={s7.series} color={COLORS.blue} /></div>
            {P.API
              ? <div className="dc-veh"><Icon name="phone" size="sm" /><span>{d.phone || 'Telefone não informado'}</span></div>
              : <div className="dc-veh"><Icon name="truck" size="sm" /><span>{d.vehicle}</span><span className={`badge ${OWNERSHIP[v.ownership][1]}`}>{OWNERSHIP[v.ownership][0]}</span>{!(ins as any).phone && <span className="badge amber" data-tip="Assistência 24h não cadastrada"><Icon name="alert" size="xs" /></span>}</div>}
          </Link>
        );
      })}</div>
    </PageFrame>
  );
}
