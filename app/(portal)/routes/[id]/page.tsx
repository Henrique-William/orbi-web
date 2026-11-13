'use client';
/*
 * Detalhe da rota: mapa, situação, dados, paradas e linha do tempo; atribuir, cancelar, excluir.
 */
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PageFrame, { NotFound } from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { RouteFlags, StatusBadge } from '@/components/common';
import GeoMap from '@/components/maps/GeoMap';
import { RouteSvg } from '@/components/maps/LiveMap';
import { stopModal, assignModal, priorityModal, incidentModal } from '@/components/modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { confirmDialog, downloadCSV, toast } from '@/lib/orbi/ui';
import { num, money, rel, hhmm, date, fmtMin, pad2, ROUTE_STATUS, STOP_STATUS, PRIORITY, OWNERSHIP } from '@/lib/orbi/format';

export default function RoutePage() {
  const P = useOrbi();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const r = P.route(decodeURIComponent(id));
  if (!r) return <NotFound />;
  const inf = P.routeInfo(r); const d = P.user(r.driverId); const h = P.health(r);
  const canDelete = ['CREATED', 'ASSIGNED', 'DELAYED'].concat(P.API ? ['CANCELLED'] : []).includes(r.status);
  const canCancel = P.API && !['COMPLETED', 'CANCELLED'].includes(r.status);
  const unread = P.unreadChat(r.id, P.me());

  const log: [string, string, string][] = [];
  if (r.createdAt) log.push([r.createdAt, 'Rota criada', 'route']);
  if (r.startedAt) log.push([r.startedAt, 'Rota iniciada pelo motorista', 'truck']);
  r.stops.forEach((s: any, i: number) => { if (s.at) log.push([s.at, `Parada #${pad2(i + 1)} · ${STOP_STATUS[s.status][0].toLowerCase()}${s.reason ? ' · ' + s.reason : ''}`, s.status === 'COMPLETED' ? 'check' : s.status === 'SKIPPED' ? 'skip' : 'xcircle']); });
  P.chatOf(r.id).filter((m: any) => m.kind !== 'text').forEach((m: any) => log.push([m.at, m.kind === 'priority' ? 'Alerta de prioridade enviado' : m.kind === 'ack' ? 'Motorista confirmou “Ciente”' : m.kind === 'sos' ? 'Alerta de segurança: ' + m.text : m.text, m.kind === 'sos' ? 'shield' : m.kind === 'priority' ? 'zap' : 'info']));
  if (r.finishedAt) log.push([r.finishedAt, 'Rota concluída', 'check']);
  log.sort((a, b) => Date.parse(b[0]) - Date.parse(a[0]));

  const csv = () => {
    downloadCSV(`orbi-${r.code}.csv`, [['#', 'Endereço', 'Bairro', 'Destinatário', 'Telefone', 'Status', 'Horário', 'Motivo', 'Recebido por']].concat(
      r.stops.map((s: any, i: number) => [i + 1, P.stopAddr(s), s.district, s.recipient, s.phone, STOP_STATUS[s.status][0], s.at ? hhmm(s.at) : '', s.reason || '', s.proof ? s.proof.receiver : ''])));
    toast('Planilha CSV gerada', 'download');
  };
  // volta para a lista antes de excluir (senão a página mostraria "não encontrado" por um instante)
  const del = () => confirmDialog(`Excluir ${r.code}?`, 'A rota e as paradas serão removidas. O motorista deixa de ver esta rota.', 'Excluir', true, () => {
    router.push('/routes');
    P.act.deleteRoute(r.id).then(() => { if (!P.API) toast('Rota excluída', 'trash'); });
  });
  const cancel = () => confirmDialog(`Cancelar ${r.code}?`, 'A rota e as entregas pendentes ficam canceladas. O motorista verá a mudança no app.', 'Cancelar rota', true, () => P.act.cancelRoute(r.id));

  return (
    <PageFrame active="routes" title={`Rota ${r.code}`} path={[{ href: '/routes', label: 'Rotas' }]} noHead>
      <div className="page-head">
        <Link className="icon-btn" href="/routes" aria-label="Voltar"><Icon name="back" /></Link>
        <div className="ph-main"><h2>{r.code}</h2><span className="row wrap" style={{ gap: 6 }}><StatusBadge map={ROUTE_STATUS} st={r.status} /><RouteFlags P={P} r={r} /></span></div>
        <div className="row wrap ph-actions">
          {!P.API && <>
            <button className="btn ghost" disabled={!d || r.status === 'COMPLETED'} onClick={() => priorityModal(P, r)}><Icon name="zap" size="sm" /> Prioridade</button>
            <Link className={`btn ghost ${d ? '' : 'disabled'}`} href={'/messages/' + r.id}><Icon name="chat" size="sm" /> Mensagem{unread ? <> <em className="pill-n">{unread}</em></> : null}</Link>
          </>}
          <button className="btn ghost" disabled={['COMPLETED', 'CANCELLED'].includes(r.status)} onClick={() => assignModal(P, r)}><Icon name="users" size="sm" /> {d ? 'Trocar motorista' : 'Atribuir'}</button>
          <button className="btn ghost" aria-label="Exportar CSV" data-tip="Exportar paradas em CSV" onClick={csv}><Icon name="download" size="sm" /></button>
          {canCancel && <button className="btn ghost danger-t" onClick={cancel}><Icon name="xcircle" size="sm" /> Cancelar rota</button>}
          {canDelete && <button className="btn ghost danger-t" aria-label="Excluir rota" data-tip="Excluir rota" onClick={del}><Icon name="trash" size="sm" /></button>}
        </div>
      </div>
      {r.priority && r.status !== 'COMPLETED' && (
        <div className={`callout ${r.priority.level === 'URGENT' ? 'red' : 'amber'}`}><Icon name="zap" size="sm" /><span><b>{PRIORITY[r.priority.level][0]}</b> · “{r.priority.message}” · enviado {rel(r.priority.at)} · {r.priority.requireAck ? (r.priority.ackAt ? `motorista ciente às ${hhmm(r.priority.ackAt)}` : 'aguardando “Ciente”') : 'sem confirmação'}</span></div>
      )}
      <div className="grid g-2-1">
        <section className="card pad0">{P.API ? <GeoMap P={P} routes={[r]} className="map-host tall" /> : <RouteSvg P={P} route={r} highlightNext={r.status === 'IN_PROGRESS'} className="map-host tall" />}</section>
        <div className="stack">
          <section className={`card health ${h.worst}`}>
            <div className="card-head"><h3><span className={`hdot ${h.worst}`} /> Situação da rota</h3><span className={`badge ${h.worst === 'ok' ? 'green' : h.worst === 'warn' ? 'amber' : 'red'}`}>{({ ok: 'Tudo certo', warn: 'Atenção', bad: 'Ação necessária' } as any)[h.worst]}</span></div>
            {h.checks.map((c: any, i: number) => <div key={i} className={`hc-row ${c[0]}`}><Icon name={c[0] === 'ok' ? 'check' : 'alert'} size="sm" /><span><b>{c[1]}</b><small>{c[2]}</small></span></div>)}
            {h.inc ? <button className="btn danger block sm" style={{ marginTop: 10 }} onClick={() => incidentModal(P, h.inc)}><Icon name="shield" size="sm" /> Ver alerta de segurança</button>
              : r.status === 'DELAYED' && !r.priority ? <button className="btn primary block sm" style={{ marginTop: 10 }} onClick={() => priorityModal(P, r)}><Icon name="zap" size="sm" /> Enviar alerta de prioridade</button>
                : !d && r.status !== 'CANCELLED' ? <button className="btn primary block sm" style={{ marginTop: 10 }} onClick={() => assignModal(P, r)}>Atribuir motorista</button> : null}
          </section>
          <section className="card"><div className="kv compact">
            <div><span>Motorista</span><b>{d ? <Link href={'/drivers/' + d.id}>{d.name}</Link> : '—'}</b></div>
            {P.API ? <div><span>Telefone</span><b>{d && d.phone ? d.phone : '—'}</b></div>
              : <div><span>Veículo</span><b>{d ? `${d.vehicle} · ${OWNERSHIP[P.vehicleOf(d).ownership][0].toLowerCase()}` : '—'}</b></div>}
            <div><span>{P.API ? 'Criação' : 'Janela'}</span><b>{r.window}</b></div>
            <div><span>Paradas</span><b>{inf.handled}/{inf.total} · {inf.done} entregues</b></div>
            <div><span>Distância</span><b>{num(inf.km, 1)} km · ~{fmtMin(inf.minutes)}</b></div>
            <div><span>Custo estimado</span><b>{money(inf.cost)}</b></div>
            <div><span>Criada</span><b>{rel(r.createdAt)}{r.startedAt ? ' · iniciada às ' + hhmm(r.startedAt) : ''}</b></div>
          </div></section>
        </div>
      </div>
      <div className="grid g-2-1">
        <section className="card pad0"><div className="card-head pad"><h3>Paradas · ordem otimizada</h3><span className="muted small">Clique para ver o relato</span></div>
          <table className="tbl"><thead><tr><th>#</th><th>Endereço</th><th>Destinatário</th><th>Status</th><th>Registro</th><th /></tr></thead>
            <tbody>{r.stops.map((s: any, i: number) => (
              <tr key={s.id} tabIndex={0} onClick={() => stopModal(r, s)} onKeyDown={e => { if (e.key === 'Enter') stopModal(r, s); }}>
                <td data-l="#"><b>{pad2(i + 1)}</b></td>
                <td data-l="Endereço">{P.stopAddr(s)}{s.district && <small className="block muted">{s.district}</small>}</td>
                <td data-l="Destinatário">{s.recipient}</td>
                <td data-l="Status"><span className="row wrap" style={{ gap: 4 }}><StatusBadge map={STOP_STATUS} st={s.status} />{s.review && s.review.status === 'REQUESTED' && <span className="badge violet">Revisão</span>}{(s.comments || []).length > 0 && <span className="badge neutral"><Icon name="chat" size="xs" /> {s.comments.length}</span>}</span></td>
                <td data-l="Registro">{s.at ? hhmm(s.at) : '—'}{s.reason ? <small className={`block txt-${STOP_STATUS[s.status][1]}`}>{s.reason}</small> : s.proof ? <small className="block muted">por {s.proof.receiver}</small> : null}</td>
                <td className="chev"><Icon name="chev" size="sm" /></td>
              </tr>
            ))}</tbody></table></section>
        <section className="card"><div className="card-head"><h3>Linha do tempo</h3></div>
          <div className="timeline">{log.length ? log.map((l, i) => (
            <div key={i} className="tl"><span className="tl-ic"><Icon name={l[2]} size="xs" /></span><span><b>{l[1]}</b><small>{date(l[0])} às {hhmm(l[0])} · {rel(l[0])}</small></span></div>
          )) : <p className="muted small">Sem eventos.</p>}</div></section>
      </div>
    </PageFrame>
  );
}
