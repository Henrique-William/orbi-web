'use client';
/*
 * Mensagens com os motoristas, uma conversa por rota (modo demonstração).
 * A Orbi API ainda não tem conversas; no modo API a tela explica isso.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import PageFrame from './Shell';
import { Icon } from './Icon';
import { Empty } from './common';
import { priorityModal } from './modals';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { toast } from '@/lib/orbi/ui';
import { date, hhmm, rel, first, initials, ROUTE_STATUS, PRIORITY } from '@/lib/orbi/format';

const QUICK = ['Qual sua previsão de chegada?', 'Priorize a próxima parada', 'O cliente ligou e está aguardando', 'Tudo certo por aí?', 'Pode me ligar quando puder?'];

export default function MessagesView({ id }: { id?: string }) {
  const P = useOrbi();
  if (P.API) {
    return (
      <PageFrame active="messages" title="Mensagens">
        <section className="card"><Empty icon="chat" title="Mensagens ainda não disponíveis" text="A Orbi API ainda não tem conversas entre gestor e motorista. Quando esse recurso existir na API, ele aparece aqui." /></section>
      </PageFrame>
    );
  }
  return <Chat P={P} id={id} />;
}

function Chat({ P, id }: { P: any; id?: string }) {
  const me = P.me();
  const [text, setText] = useState('');
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const r = id ? P.route(id) : null;
  const d = r && P.user(r.driverId);
  const msgs = r ? P.chatOf(r.id) : [];
  const conv = P.S.routes.filter((x: any) => x.driverId && (P.chatOf(x.id).length || ['IN_PROGRESS', 'DELAYED', 'ASSIGNED'].includes(x.status)))
    .sort((a: any, b: any) => { const la = P.chatOf(a.id).slice(-1)[0], lb = P.chatOf(b.id).slice(-1)[0]; return (lb ? Date.parse(lb.at) : 0) - (la ? Date.parse(la.at) : 0); });

  // ao abrir a conversa (ou chegar mensagem nova): marca como lida e rola para o fim
  useEffect(() => {
    if (!r) return;
    P.act.readChat(r.id);
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [P, r, msgs.length]);

  const send = (t: string) => { t = t.trim(); if (!t || !r) return; P.act.message(r.id, t); setText(''); inputRef.current?.focus(); };
  let last = '';

  return (
    <PageFrame active="messages" title="Mensagens" sub="Conversas com os motoristas, por rota">
      <div className={`chat ${r ? 'has-thread' : ''}`}>
        <aside className="conv card pad0">{conv.length ? conv.map((c: any) => {
          const o = P.user(c.driverId); const lm = P.chatOf(c.id).slice(-1)[0]; const n = P.unreadChat(c.id, me);
          return (
            <Link key={c.id} className={`cv ${r && r.id === c.id ? 'on' : ''}`} href={'/messages/' + c.id}>
              <span className="avatar">{initials(o.name)}</span>
              <span className="cv-main"><b>{o.name} <span className="badge neutral">{c.code}</span></b><small className={n ? 'unread' : ''}>{lm ? (lm.from === me.id ? 'Você: ' : '') + lm.text : 'Iniciar conversa'}</small></span>
              <span className="cv-end"><small>{lm ? rel(lm.at) : ''}</small>{n ? <em>{n}</em> : null}{P.prioRank(c) > 0 && <Icon name="zap" size="xs" />}</span>
            </Link>
          );
        }) : <Empty icon="chat" title="Sem conversas" text="As conversas ficam ligadas às rotas." />}</aside>
        <section className="thread-pane card pad0">{r && d ? <>
          <header className="th-head">
            <Link className="icon-btn only-m" href="/messages" aria-label="Voltar"><Icon name="back" /></Link>
            <span className="avatar">{initials(d.name)}</span>
            <span className="grow"><b>{d.name}</b><small className="block muted">{r.code} · {ROUTE_STATUS[r.status][0]} · {r.window}</small></span>
            <button className="icon-btn" aria-label="Ligar" onClick={() => toast(`Ligando para ${d.name}… (simulado)`, 'phone')}><Icon name="phone" /></button>
            <button className="icon-btn" aria-label="Prioridade" onClick={() => priorityModal(P, r)}><Icon name="zap" /></button>
            <Link className="icon-btn" href={'/routes/' + r.id} aria-label="Abrir rota"><Icon name="route" /></Link>
          </header>
          <div className="msgs" ref={msgsRef}>{msgs.length ? msgs.map((m: any) => {
            const day = date(m.at); const sep = day !== last ? <div className="m-day">{day}</div> : null; last = day;
            if (m.kind === 'system') return <div key={m.id} style={{ display: 'contents' }}>{sep}<div className="m-sys">{m.text} · {hhmm(m.at)}</div></div>;
            const mine = m.role === 'ADMIN';
            return (
              <div key={m.id} style={{ display: 'contents' }}>{sep}
                <div className={`m ${mine ? 'mine' : ''} ${m.kind}`}>
                  {(!mine || m.from !== me.id) && <span className="m-name">{m.name}</span>}
                  {m.kind === 'priority' ? <span className="m-tag"><Icon name="zap" size="xs" /> {PRIORITY[(m.meta || {}).level || 'HIGH'][0]}</span>
                    : m.kind === 'sos' ? <span className="m-tag"><Icon name="shield" size="xs" /> Alerta de segurança</span>
                      : m.kind === 'ack' ? <span className="m-tag"><Icon name="check" size="xs" /> Ciente</span> : null}
                  {m.text}<small>{hhmm(m.at)}</small>
                </div>
              </div>
            );
          }) : <Empty icon="chat" title="Nenhuma mensagem" text="Envie a primeira mensagem para o motorista." />}</div>
          <footer className="th-foot">
            <div className="chips">{QUICK.map(q => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
            <form className="composer" onSubmit={e => { e.preventDefault(); send(text); }}>
              <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={`Mensagem para ${first(d.name)}`} autoComplete="off" />
              <button className="btn primary icon" aria-label="Enviar"><Icon name="send" size="sm" /></button>
            </form>
            <p className="muted small hint"><Icon name="info" size="xs" /> A mensagem aparece no app do motorista na hora.</p>
          </footer>
        </> : <div className="th-empty"><Empty icon="chat" title="Selecione uma conversa" text="Escolha uma rota ao lado para conversar com o motorista." /></div>}</section>
      </div>
    </PageFrame>
  );
}
