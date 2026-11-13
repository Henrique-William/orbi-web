'use client';
/*
 * Janelas de ação: parada/ocorrência, alerta de segurança, prioridade, atribuição de motorista,
 * novo motorista e veículo.
 */
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from './Icon';
import { StatusBadge } from './common';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { openModal, toast } from '@/lib/orbi/ui';
import { num, date, hhmm, rel, first, initials, pad2, STOP_STATUS, PRIORITY, OWNERSHIP, TERMINAL } from '@/lib/orbi/format';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PLATE = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;

// ---------------------------------------------------------------------------
// Parada (relato do motorista, comprovante e comentários)
// ---------------------------------------------------------------------------
export function stopModal(r: any, s: any) {
  openModal(`${r.code} · Parada #${pad2(r.stops.indexOf(s) + 1)}`, close => <StopBody rid={r.id} sid={s.id} close={close} />, { wide: true });
}
function StopBody({ rid, sid, close }: { rid: string; sid: string; close: () => void }) {
  const P = useOrbi();
  const [text, setText] = useState('');
  const r = P.route(rid); const s = r && r.stops.find((x: any) => x.id === sid);
  if (!s) return <p className="muted">Parada não encontrada.</p>;
  const d = P.user(r.driverId); const st = STOP_STATUS[s.status]; const p = s.proof || {};
  const send = (resolve: boolean) => {
    const t = text.trim(); if (!t && !resolve) return;
    P.act.comment(r.id, s.id, t, resolve); close();
    toast(resolve ? 'Revisão concluída · motorista avisado' : 'Comentário enviado ao motorista', 'check');
  };
  return (
    <>
      <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
        <StatusBadge map={STOP_STATUS} st={s.status} />
        {s.review && <span className={`badge ${s.review.status === 'REQUESTED' ? 'violet' : 'green'}`}>{s.review.status === 'REQUESTED' ? 'Revisão pedida' : 'Revisada'}</span>}
      </div>
      <div className="kv">
        <div><span>Endereço</span><b>{P.stopAddr(s)}{s.district ? ' · ' + s.district : ''}</b></div>
        <div><span>Destinatário</span><b>{s.recipient}{s.phone ? ' · ' + s.phone : ''}</b></div>
        <div><span>Pacote</span><b>{s.packages.map((x: any) => `${x.desc}${x.weight ? ` (${num(x.weight, 1)} kg)` : ''}`).join(', ')}</b></div>
        <div><span>Motorista</span><b>{d ? d.name : '—'}</b></div>
        {s.at && <div><span>Registrado</span><b>{date(s.at)} às {hhmm(s.at)} ({rel(s.at)})</b></div>}
        {s.reportDist != null && <div><span>Distância do endereço</span><b>{s.reportDist} m{s.reportDist > 150 && <> <span className="badge amber">longe do endereço</span></>}</b></div>}
        {s.status === 'COMPLETED' && !P.API && <>
          <div><span>Recebido por</span><b>{p.receiver || '—'}{p.doc ? ' · ' + p.doc : ''}</b></div>
          <div><span>Comprovante</span><b>{p.photo ? <span className="photo-thumb">Foto anexada</span> : 'Sem foto'}{p.note ? ` · “${p.note}”` : ''}</b></div>
        </>}
        {s.reason && <div><span>Motivo informado</span><b className={`txt-${st[1]}`}>{s.reason}</b></div>}
      </div>
      {s.review && s.review.status === 'REQUESTED' && <div className="callout violet"><Icon name="chat" size="sm" /><span><b>O motorista pediu revisão</b> {rel(s.review.at)}{s.review.text ? ` · “${s.review.text}”` : ''}</span></div>}
      {P.API && s.details && <div className="callout neutral"><Icon name="edit" size="sm" /><span><b>Observação registrada no app:</b> {s.details}</span></div>}
      {P.API ? <p className="muted small">Comentários e revisões ainda não existem na Orbi API.</p> : <>
        <h3 className="h3">Comentários</h3>
        <div className="thread">{(s.comments || []).length ? s.comments.map((c: any, i: number) => (
          <div key={i} className={`cmt ${c.role === 'ADMIN' ? 'me' : ''}`}><b>{c.by}</b><span className={`badge ${c.role === 'ADMIN' ? 'blue' : 'neutral'}`}>{c.role === 'ADMIN' ? 'Gestor' : 'Motorista'}</span><em>{rel(c.at)}</em><p>{c.text}</p></div>
        )) : <p className="muted small">Nenhum comentário ainda.</p>}</div>
        {TERMINAL.includes(s.status) && <>
          <textarea className="ta" value={text} onChange={e => setText(e.target.value)} placeholder="Responder ao motorista (aparece no app dele)" />
          <div className="row end wrap" style={{ marginTop: 10 }}>
            {s.review && s.review.status === 'REQUESTED' && <button className="btn success" onClick={() => send(true)}><Icon name="check" size="sm" /> Responder e marcar como revisada</button>}
            <button className="btn primary" onClick={() => send(false)}><Icon name="send" size="sm" /> Enviar comentário</button>
          </div>
        </>}
      </>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Alerta de segurança (SOS)
// ---------------------------------------------------------------------------
export function incidentModal(P: any, inc: any) {
  if (!inc.seenAt && inc.status === 'OPEN') P.act.seeIncident(inc.id);
  openModal(`Alerta de segurança · ${inc.label}`, close => <IncidentBody id={inc.id} close={close} />, { wide: true });
}
function IncidentBody({ id, close }: { id: string; close: () => void }) {
  const P = useOrbi();
  const [note, setNote] = useState('');
  const inc = P.S.incidents.find((i: any) => i.id === id); if (!inc) return null;
  const d = P.user(inc.driverId); const r = inc.routeId && P.route(inc.routeId); const ins = P.insuranceOf(d); const v = P.vehicleOf(d);
  const urgent = ['ACCIDENT', 'HEALTH', 'ROBBERY'].includes(inc.type);
  const call = (who: string) => toast(`Ligando para ${who}… (simulado)`, 'phone');
  return (
    <>
      <div className={`callout ${inc.status === 'OPEN' ? 'red' : 'green'}`}><Icon name={inc.status === 'OPEN' ? 'shield' : 'check'} size="sm" /><span><b>{inc.status === 'OPEN' ? 'Alerta ativo' : 'Resolvido ' + rel(inc.resolvedAt)}</b> · enviado {rel(inc.at)} às {hhmm(inc.at)}{inc.seenAt ? ` · visualizado às ${hhmm(inc.seenAt)}` : ''}</span></div>
      <div className="kv">
        <div><span>Motorista</span><b>{d.name} · {d.phone}</b></div>
        <div><span>Localização enviada</span><b>Perto de {inc.street}</b></div>
        {r && <div><span>Rota</span><b><Link href={'/routes/' + r.id} onClick={close}>{r.code}</Link>{inc.paused ? ' · pausada' : ''}</b></div>}
        <div><span>Veículo</span><b>{d.vehicle} · {OWNERSHIP[v.ownership][0].toLowerCase()}</b></div>
        <div><span>Assistência 24h</span><b>{ins.phone ? `${ins.insurer || ''} · ${ins.phone}` : <span className="txt-amber">Não cadastrada</span>}</b></div>
        {inc.note && <div><span>Detalhes do motorista</span><b>“{inc.note}”</b></div>}
        {inc.resolution && <div><span>Resolução</span><b>{inc.resolution}</b></div>}
      </div>
      <div className="calls">
        {ins.phone && ['BREAKDOWN', 'TIRE', 'ACCIDENT'].includes(inc.type) && <button className="call" onClick={() => call(`${ins.insurer || 'Assistência'} ${ins.phone}`)}><Icon name="phone" size="sm" /><span><b>{ins.phone}</b><small>{ins.insurer || 'Assistência 24h'}</small></span></button>}
        <button className="call" onClick={() => call(`${d.name} ${d.phone}`)}><Icon name="phone" size="sm" /><span><b>{d.phone}</b><small>Ligar para o motorista</small></span></button>
        {urgent && <button className="call red" onClick={() => call(inc.type === 'ROBBERY' ? 'Polícia 190' : 'SAMU 192')}><Icon name="phone" size="sm" /><span><b>{inc.type === 'ROBBERY' ? '190' : '192'}</b><small>{inc.type === 'ROBBERY' ? 'Polícia' : 'SAMU'}</small></span></button>}
      </div>
      {inc.status === 'OPEN' && <>
        <textarea className="ta" value={note} onChange={e => setNote(e.target.value)} placeholder="Como foi resolvido? (ex.: guincho a caminho)" />
        <div className="row end wrap" style={{ marginTop: 10 }}>
          {r && <><Link className="btn ghost" href={'/messages/' + r.id} onClick={close}><Icon name="chat" size="sm" /> Conversa</Link><button className="btn ghost" onClick={() => assignModal(P, r)}><Icon name="users" size="sm" /> Reatribuir rota</button></>}
          <button className="btn success" onClick={() => { P.act.resolveIncident(inc.id, note.trim()); close(); toast('Alerta encerrado · motorista avisado', 'check'); }}><Icon name="check" size="sm" /> Marcar como resolvido</button>
        </div>
      </>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Alerta de prioridade
// ---------------------------------------------------------------------------
const TPL = ['Rota atrasada: priorize estas entregas.', 'Cliente aguardando, entregue o quanto antes.', 'Carga sensível: siga direto para as paradas.', 'Comece por esta rota antes das outras.'];
export function priorityModal(P: any, r: any) {
  if (!P.user(r.driverId)) { assignModal(P, r); toast('Atribua um motorista antes do alerta', 'info'); return; }
  openModal(`Alerta de prioridade · ${r.code}`, close => <PriorityBody rid={r.id} close={close} />);
}
function PriorityBody({ rid, close }: { rid: string; close: () => void }) {
  const P = useOrbi();
  const r = P.route(rid); const d = r && P.user(r.driverId);
  const [level, setLevel] = useState(r && r.status === 'DELAYED' ? 'URGENT' : 'HIGH');
  const [msg, setMsg] = useState(r && r.status === 'DELAYED' ? TPL[0] : '');
  const [ack, setAck] = useState(true);
  if (!r || !d) return null;
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Para <b>{d.name}</b>. Aparece em destaque no app do motorista.</p>
      <div className="seg2">{Object.keys(PRIORITY).map(k => (
        <button key={k} className={`opt ${level === k ? 'on' : ''}`} onClick={() => setLevel(k)}><b>{PRIORITY[k][0]}</b><small>{k === 'URGENT' ? 'Aviso em tela cheia no app' : 'Destaque na lista de rotas'}</small></button>
      ))}</div>
      <label className="lbl">Mensagem</label>
      <div className="chips wrap">{TPL.map((t, i) => <button key={i} className="chip" onClick={() => setMsg(t)}>{t}</button>)}</div>
      <textarea className="ta" value={msg} onChange={e => setMsg(e.target.value)} />
      <label className="check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> Exigir confirmação “Ciente” do motorista</label>
      <div className="row end" style={{ marginTop: 14 }}>
        {r.priority && <button className="btn ghost" onClick={() => { P.act.clearPriority(r.id); close(); toast('Prioridade removida', 'check'); }}>Remover prioridade</button>}
        <button className="btn danger" onClick={() => { P.act.priority(r.id, level, msg.trim() || TPL[0], ack); close(); toast(`Alerta enviado para ${first(d.name)} · aparece no app agora`, 'zap'); }}><Icon name="zap" size="sm" /> Enviar alerta</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Atribuir / trocar motorista
// ---------------------------------------------------------------------------
export function assignModal(P: any, r: any) {
  openModal(`Atribuir motorista · ${r.code}`, close => <AssignBody rid={r.id} close={close} />);
}
function AssignBody({ rid, close }: { rid: string; close: () => void }) {
  const P = useOrbi();
  const r = P.route(rid);
  const [pick, setPick] = useState(r ? r.driverId : null);
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const save = async () => {
    if (!pick || pick === r.driverId) { close(); return; }
    setBusy(true);
    const ok = await P.act.assign(r.id, pick);
    if (!P.API && ok) toast(`${P.user(pick).name} atribuído · notificado no app`, 'check');
    close();
  };
  return (
    <>
      <div className="pick-list">{P.drivers().map((d: any) => { const st = P.driverState(d); return (
        <button key={d.id} className={`pick ${pick === d.id ? 'on' : ''}`} onClick={() => setPick(d.id)}><span className="avatar">{initials(d.name)}</span><span><b>{d.name}</b><small>{P.API ? (d.phone || d.email || '') : `${d.vehicle} · nota ${num(d.rating || 0, 1)}`}</small></span><span className={`badge ${st[1]}`}>{st[0]}</span></button>
      ); })}</div>
      {r.status === 'IN_PROGRESS' && <div className="callout amber"><Icon name="info" size="sm" /><span>A rota está em andamento. Ao trocar, ela volta para “A iniciar” com o novo motorista.</span></div>}
      <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" disabled={busy} onClick={save}>{busy ? <><Icon name="refresh" size="sm spin" /> Salvando…</> : 'Salvar'}</button></div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Novo motorista (demonstração)
// ---------------------------------------------------------------------------
export function newDriverModal(P: any, router: any) {
  openModal('Novo motorista', close => <NewDriverBody close={close} router={router} />);
}
function NewDriverBody({ close, router }: { close: () => void; router: any }) {
  const P = useOrbi();
  const fi = P.S.company.fleetInsurance || {};
  const [own, setOwn] = useState('COMPANY');
  const [f, setF] = useState<Record<string, string>>({ name: '', email: '', phone: '', cnh: '', model: '', plate: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const FIELDS: [string, string, string][] = [['name', 'Nome completo', 'text'], ['email', 'E-mail de acesso ao app', 'email'], ['phone', 'Telefone', 'tel'], ['cnh', 'CNH', 'text'], ['model', 'Modelo do veículo', 'text'], ['plate', 'Placa', 'text']];
  const save = () => {
    const v = (k: string) => (f[k] || '').trim(); const e: Record<string, string> = {};
    if (v('name').length < 3) e.name = 'Informe o nome';
    if (!EMAIL.test(v('email'))) e.email = 'E-mail inválido'; else if (P.S.users.some((u: any) => u.email.toLowerCase() === v('email').toLowerCase())) e.email = 'E-mail já cadastrado';
    if (v('phone').replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido';
    if (v('cnh').replace(/\D/g, '').length < 9) e.cnh = 'CNH inválida';
    if (!v('model')) e.model = 'Informe o modelo';
    if (!PLATE.test(v('plate'))) e.plate = 'Placa inválida';
    setErr(e); if (Object.keys(e).length) return;
    const plate = v('plate').toUpperCase();
    const u = P.act.createDriver({ name: v('name'), email: v('email'), password: 'orbi123', phone: v('phone'), cnh: v('cnh'), vehicle: `${v('model')} · ${plate}`, vehicleInfo: { ownership: own, model: v('model'), plate, company: own === 'COMPANY' ? { ...fi } : { insurer: '', policy: '', phone: '' }, personal: { insurer: '', policy: '', phone: '' } } });
    close(); toast(`${u.name} cadastrado · senha inicial orbi123`, 'check'); router.push('/drivers/' + u.id);
  };
  return (
    <>
      <div className="form-2">{FIELDS.map(([k, l, t]) => (
        <div key={k}><label className="lbl" htmlFor={k}>{l}</label><div className={`input ${err[k] ? 'err' : ''}`}><input id={k} type={t} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div><div className="ferr">{err[k] || ''}</div></div>
      ))}</div>
      <label className="lbl">Propriedade do veículo</label>
      <div className="seg2">
        <button className={`opt ${own === 'COMPANY' ? 'on' : ''}`} onClick={() => setOwn('COMPANY')}><b>Da empresa</b><small>Usa o seguro da frota</small></button>
        <button className={`opt ${own === 'PERSONAL' ? 'on' : ''}`} onClick={() => setOwn('PERSONAL')}><b>Particular</b><small>O motorista cadastra o seguro no app</small></button>
      </div>
      {own === 'COMPANY' && <p className="muted small">Seguro da frota: {fi.insurer || 'não configurado'} · {fi.phone || ''}. Altere em Configurações → Frota.</p>}
      <div className="row end" style={{ marginTop: 12 }}><button className="btn primary" onClick={save}>Cadastrar motorista</button></div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Veículo do motorista (demonstração)
// ---------------------------------------------------------------------------
export function vehicleModal(P: any, d: any) {
  openModal(`Veículo · ${d.name}`, close => <VehicleBody id={d.id} close={close} />);
}
function VehicleBody({ id, close }: { id: string; close: () => void }) {
  const P = useOrbi();
  const d = P.user(id);
  const [vi, setVi] = useState<any>(() => JSON.parse(JSON.stringify(P.vehicleOf(d))));
  const [plateErr, setPlateErr] = useState('');
  const ins = vi[vi.ownership === 'COMPANY' ? 'company' : 'personal'];
  const setIns = (k: string, v: string) => setVi({ ...vi, company: { ...vi.company, [k]: v } });
  const save = () => {
    const out = { ...vi, model: vi.model.trim(), plate: vi.plate.trim().toUpperCase() };
    if (!PLATE.test(out.plate)) { setPlateErr('Placa inválida'); return; }
    P.act.updateVehicle(d.id, out); close(); toast('Veículo atualizado · motorista notificado', 'check');
  };
  return (
    <>
      <div className="seg2">{Object.keys(OWNERSHIP).map(k => (
        <button key={k} className={`opt ${vi.ownership === k ? 'on' : ''}`} onClick={() => setVi({ ...vi, ownership: k })}><b>{OWNERSHIP[k][0]}</b><small>{k === 'COMPANY' ? 'A gestão cadastra o seguro' : 'O motorista cadastra no app'}</small></button>
      ))}</div>
      <div className="form-2">
        <div><label className="lbl">Modelo</label><div className="input"><input value={vi.model} onChange={e => setVi({ ...vi, model: e.target.value })} /></div></div>
        <div><label className="lbl">Placa</label><div className={`input ${plateErr ? 'err' : ''}`}><input value={vi.plate} onChange={e => setVi({ ...vi, plate: e.target.value })} /></div><div className="ferr">{plateErr}</div></div>
      </div>
      {vi.ownership === 'COMPANY' ? <>
        <div className="form-2">
          <div><label className="lbl">Seguradora</label><div className="input"><input value={ins.insurer} onChange={e => setIns('insurer', e.target.value)} /></div></div>
          <div><label className="lbl">Apólice</label><div className="input"><input value={ins.policy} onChange={e => setIns('policy', e.target.value)} /></div></div>
        </div>
        <label className="lbl">Telefone da assistência 24h</label><div className="input"><input value={ins.phone} inputMode="tel" onChange={e => setIns('phone', e.target.value)} /></div>
        <button className="link" style={{ marginTop: 8 }} onClick={() => { const fi = P.S.company.fleetInsurance || {}; setVi({ ...vi, company: { insurer: fi.insurer || '', policy: fi.policy || '', phone: fi.phone || '' } }); }}>Usar o seguro padrão da frota</button>
      </> : <div className="callout neutral"><Icon name="info" size="sm" /><span>Veículo particular: o seguro é informado pelo motorista no app (Perfil → Meu veículo).<br />Atual: <b>{ins.insurer || 'não informado'}</b>{ins.phone ? ' · ' + ins.phone : ''}</span></div>}
      <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" onClick={save}>Salvar veículo</button></div>
    </>
  );
}

/** Abre a ação certa para cada tipo de ocorrência. */
export function openOccurrence(P: any, o: any, router: any) {
  if (o.kind === 'SOS') incidentModal(P, o.ref);
  else if (o.s) stopModal(o.r, o.s);
  else if (o.kind === 'DELAY') priorityModal(P, o.r);
  else if (o.kind === 'NODRIVER') assignModal(P, o.r);
  else if (o.kind === 'ACK') router.push('/messages/' + o.r.id);
}
