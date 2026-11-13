'use client';
/*
 * Configurações: conexão com a API, empresa, frota e seguro, equipe, metas, integrações e aparência.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { usePageState } from '@/components/common';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { CONFIG } from '@/lib/orbi/config';
import { confirmDialog, currentThemePref, setTheme, toast } from '@/lib/orbi/ui';
import { hhmm, rel, fmtMin, plural, initials, OWNERSHIP } from '@/lib/orbi/format';

export default function SettingsPage() {
  const P = useOrbi();
  const [st, set] = usePageState('config', { tab: 'company' });
  const TABS: [string, string, string][] = P.API
    ? [['connection', 'Conexão com a API', 'link'], ['team', 'Equipe de gestão', 'users'], ['goals', 'Metas', 'trend'], ['data', 'Aparência', 'settings']]
    : [['company', 'Empresa', 'building'], ['fleet', 'Frota e seguro', 'truck'], ['team', 'Equipe de gestão', 'users'], ['goals', 'Metas', 'trend'], ['integrations', 'Integrações', 'link'], ['data', 'Aparência e dados', 'settings']];
  const tab = TABS.some(t => t[0] === st.tab) ? st.tab : TABS[0][0];
  const Body = ({ connection: Connection, company: Company, fleet: Fleet, team: Team, goals: Goals, integrations: Integrations, data: Appearance } as any)[tab];
  return (
    <PageFrame active="settings" title="Configurações" sub={P.S.company.name}>
      <div className="settings">
        <nav className="set-nav card pad0">{TABS.map(t => <button key={t[0]} className={tab === t[0] ? 'on' : ''} onClick={() => set({ tab: t[0] })}><Icon name={t[2]} size="sm" /><span>{t[1]}</span></button>)}</nav>
        <section className="card set-body"><h3 className="h3" style={{ marginTop: 0 }}>{(TABS.find(t => t[0] === tab) as any)[1]}</h3><Body P={P} /></section>
      </div>
    </PageFrame>
  );
}

function Connection({ P }: { P: any }) {
  const state = ({ ok: <span className="txt-green">Conectado</span>, syncing: 'Atualizando…', loading: 'Conectando…', waking: <span className="txt-amber">Acordando o servidor</span>, error: <span className="txt-red">Sem conexão</span>, idle: '—' } as any)[P.sync.state] || '—';
  return (
    <>
      <div className="kv">
        <div><span>Servidor</span><b>{CONFIG.apiPublicUrl}</b></div>
        <div><span>Situação</span><b>{state}</b></div>
        <div><span>Última atualização</span><b>{P.sync.last ? `${hhmm(P.sync.last)} (${rel(P.sync.last)})` : '—'}</b></div>
        <div><span>Sessão expira em</span><b>{fmtMin(Math.max(0, P.sessionExpiresIn() / 60))}</b></div>
        <div><span>Dados</span><b>{P.S.routes.length} rotas · {P.S.routes.reduce((a: number, r: any) => a + r.stops.length, 0)} entregas · {P.drivers().length} motoristas</b></div>
      </div>
      <div className="row end" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => P.refresh()}><Icon name="refresh" size="sm" /> Atualizar agora</button></div>
      <label className="lbl">Atualização automática</label>
      <div className="seg">{[[0, 'Desligada'], [30, '30 s'], [60, '1 min'], [300, '5 min']].map(([s, l]) => (
        <button key={s} className={P.autoRefresh() === s ? 'on' : ''} onClick={() => P.setAutoRefresh(s)}>{l}</button>
      ))}</div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>Desligada: os dados só são buscados quando você clica em <b>Atualizar</b> (economiza chamadas à API). Cada atualização consulta as rotas e as entregas de cada rota ativa. Nenhuma delas usa a cota do OpenRouteService.</p>
      <div className="callout neutral"><Icon name="info" size="sm" /><span>O portal lê e grava na mesma Orbi API que o app do motorista usa. O plano gratuito do Render “dorme” sem uso; a primeira conexão pode levar até 1 minuto.</span></div>
    </>
  );
}

function Company({ P }: { P: any }) {
  const co = P.S.company;
  const [f, setF] = useState({ name: co.name || '', cnpj: co.cnpj || '', phone: co.phone || '', email: co.email || '', depot: co.depot || '' });
  const FIELDS: [keyof typeof f, string][] = [['name', 'Razão social'], ['cnpj', 'CNPJ'], ['phone', 'Telefone'], ['email', 'E-mail']];
  return (
    <>
      <div className="form-2">{FIELDS.map(([k, l]) => <div key={k}><label className="lbl">{l}</label><div className="input"><input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div></div>)}</div>
      <label className="lbl">Centro de distribuição</label><div className="input"><Icon name="pin" size="sm" /><input value={f.depot} onChange={e => setF({ ...f, depot: e.target.value })} /></div>
      <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" onClick={() => { P.act.company(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]))); toast('Dados da empresa salvos', 'check'); }}>Salvar</button></div>
    </>
  );
}

function Fleet({ P }: { P: any }) {
  const router = useRouter();
  const fi = P.S.company.fleetInsurance || {};
  const [f, setF] = useState({ insurer: fi.insurer || '', policy: fi.policy || '', phone: fi.phone || '' });
  const company = P.drivers().filter((d: any) => P.vehicleOf(d).ownership === 'COMPANY');
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Seguro padrão usado nos <b>veículos da empresa</b>. O número da assistência aparece no botão de segurança do motorista.</p>
      <div className="form-2">
        <div><label className="lbl">Seguradora</label><div className="input"><input value={f.insurer} onChange={e => setF({ ...f, insurer: e.target.value })} /></div></div>
        <div><label className="lbl">Apólice</label><div className="input"><input value={f.policy} onChange={e => setF({ ...f, policy: e.target.value })} /></div></div>
      </div>
      <label className="lbl">Assistência 24h</label><div className="input"><Icon name="phone" size="sm" /><input value={f.phone} inputMode="tel" onChange={e => setF({ ...f, phone: e.target.value })} /></div>
      <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" onClick={() => { const n = P.act.fleetInsurance({ insurer: f.insurer.trim(), policy: f.policy.trim(), phone: f.phone.trim() }); toast(`Seguro aplicado a ${plural(n, 'veículo', 'veículos')} · motoristas notificados`, 'check'); }}>Salvar e aplicar a {plural(company.length, 'veículo', 'veículos')} da empresa</button></div>
      <h3 className="h3">Veículos</h3>
      <table className="tbl"><thead><tr><th>Motorista</th><th>Veículo</th><th>Propriedade</th><th>Assistência</th></tr></thead>
        <tbody>{P.drivers().map((d: any) => { const v = P.vehicleOf(d); const ins = P.insuranceOf(d); return (
          <tr key={d.id} onClick={() => router.push('/drivers/' + d.id)}><td data-l="Motorista">{d.name}</td><td data-l="Veículo">{d.vehicle}</td><td data-l="Propriedade"><span className={`badge ${OWNERSHIP[v.ownership][1]}`}>{OWNERSHIP[v.ownership][0]}</span></td><td data-l="Assistência">{ins.phone ? ins.phone : <span className="txt-amber">Não cadastrada</span>}</td></tr>
        ); })}</tbody></table>
    </>
  );
}

function Team({ P }: { P: any }) {
  const [f, setF] = useState({ name: '', email: '', title: '' });
  const [err, setErr] = useState('');
  const me = P.me();
  const add = () => {
    const n = f.name.trim(), e = f.email.trim();
    if (n.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setErr('Informe nome e e-mail válidos.'); return; }
    if (P.S.users.some((u: any) => (u.email || '').toLowerCase() === e.toLowerCase())) { setErr('E-mail já cadastrado.'); return; }
    P.act.addManager({ name: n, email: e, password: 'orbi123', phone: '', title: f.title.trim() || 'Gestor' });
    toast(`${n} adicionado · senha inicial orbi123`, 'check'); setF({ name: '', email: '', title: '' }); setErr('');
  };
  return (
    <>
      {P.API && <p className="muted" style={{ marginTop: 0 }}>Contas com perfil ADMIN na Orbi API. Só elas entram no portal.</p>}
      <table className="tbl"><thead><tr><th>Nome</th><th>Cargo</th><th>E-mail</th></tr></thead>
        <tbody>{P.admins().map((a: any) => (
          <tr key={a.id}><td data-l="Nome"><span className="who"><span className="avatar xs">{initials(a.name)}</span>{a.name}{a.id === me.id && <> <span className="badge blue">você</span></>}</span></td><td data-l="Cargo">{a.title || 'Gestor'}</td><td data-l="E-mail">{a.email}</td></tr>
        ))}</tbody></table>
      {P.API ? <p className="muted small">Novos gestores são criados direto na Orbi API (perfil ADMIN).</p> : <>
        <h3 className="h3">Convidar gestor</h3>
        <div className="form-2">
          <div><label className="lbl">Nome</label><div className="input"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div></div>
          <div><label className="lbl">E-mail</label><div className="input"><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div></div>
        </div>
        <label className="lbl">Cargo</label><div className="input"><input placeholder="Ex.: Supervisor de rotas" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
        <div className="form-err">{err}</div>
        <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" onClick={add}>Adicionar gestor</button></div>
      </>}
      <div className="callout neutral"><Icon name="lock" size="sm" /><span>Somente contas de <b>gestor/empresa</b> acessam este portal. Motoristas usam apenas o app.</span></div>
    </>
  );
}

function Goals({ P }: { P: any }) {
  const g = P.S.company.goals || { successRate: 92, onTime: 90 };
  const [s, setS] = useState(g.successRate);
  const [o, setO] = useState(g.onTime);
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>As metas aparecem nos indicadores e nos relatórios.</p>
      <label className="lbl">Taxa de sucesso: <b>{s}%</b></label><input type="range" min={70} max={100} value={s} className="range" onChange={e => setS(+e.target.value)} />
      <label className="lbl">Pontualidade: <b>{o}%</b></label><input type="range" min={60} max={100} value={o} className="range" onChange={e => setO(+e.target.value)} />
      <div className="row end" style={{ marginTop: 14 }}><button className="btn primary" onClick={() => { P.act.company({ goals: { successRate: s, onTime: o } }); toast('Metas atualizadas', 'check'); }}>Salvar metas</button></div>
    </>
  );
}

function Integrations() {
  const ROWS: [string, string, string, string][] = [
    ['Orbi API (Spring Boot)', 'Modo demonstração: dados locais, sem chamadas de rede.', 'amber', 'Demonstração'],
    ['App do motorista', 'Conectado em tempo real pelo navegador (mesmo armazenamento local).', 'green', 'Conectado'],
    ['OpenRouteService', 'Otimização de rotas. Desativado na demonstração para não consumir a cota gratuita.', 'neutral', 'Desativado'],
    ['Notificações push (Firebase)', 'Planejado para o app Android real.', 'neutral', 'Planejado']
  ];
  return <div className="integ">{ROWS.map(x => <div key={x[0]} className="integ-row card"><span className="integ-ic"><Icon name="link" size="sm" /></span><span className="grow"><b>{x[0]}</b><small className="block muted">{x[1]}</small></span><span className={`badge ${x[2]}`}>{x[3]}</span></div>)}</div>;
}

function Appearance({ P }: { P: any }) {
  const [pref, setPref] = useState(currentThemePref());
  return (
    <>
      <label className="lbl">Tema</label>
      <div className="seg">{[['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Automático']].map(t => <button key={t[0]} className={pref === t[0] ? 'on' : ''} onClick={() => { setTheme(t[0]); setPref(t[0]); P.emit(); }}>{t[1]}</button>)}</div>
      {!P.API && <>
        <h3 className="h3">Dados de demonstração</h3>
        <p className="muted">Volta rotas, motoristas, conversas e alertas ao estado inicial.</p>
        <button className="btn danger" onClick={() => confirmDialog('Restaurar dados?', 'Tudo volta ao estado inicial da demonstração.', 'Restaurar', true, () => { P.resetDemo(); toast('Dados restaurados', 'refresh'); })}><Icon name="refresh" size="sm" /> Restaurar dados de demonstração</button>
      </>}
    </>
  );
}
