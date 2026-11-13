'use client';
/*
 * Estrutura das páginas: menu lateral agrupado, barra superior com trilha, busca (Ctrl K),
 * notificações, menu do usuário, navegação inferior no celular e aviso de sessão.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, Logo } from './Icon';
import { openOccurrences, Empty } from './common';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { first, initials, rel, hhmm, esc, ROUTE_STATUS } from '@/lib/orbi/format';
import { openModal, closeModal, setTheme, toast } from '@/lib/orbi/ui';
import { CONFIG, leaveDemo } from '@/lib/orbi/config';
import { newDriverModal } from './modals';

export const NAV: [string, string, string, string][] = [
  ['overview', 'Visão geral', 'grid', 'Operação'], ['live', 'Ao vivo', 'radar', 'Operação'], ['routes', 'Rotas', 'route', 'Operação'], ['occurrences', 'Ocorrências', 'alert', 'Operação'],
  ['drivers', 'Motoristas', 'users', 'Equipe'], ['messages', 'Mensagens', 'chat', 'Equipe'], ['reports', 'Relatórios', 'bars', 'Análise'], ['settings', 'Configurações', 'settings', 'Conta']
];
const navItems = (P: any) => NAV.filter(n => !(P.API && n[0] === 'messages'));

/** Converte o link de uma notificação (formato do app) em rota do portal. */
export function portalLink(link?: string) {
  if (!link) return '/occurrences';
  if (link.startsWith('/')) return link;
  const m = /#\/a\/route\/(\w+)/.exec(link); if (m) return '/routes/' + m[1];
  const v = /#\/a\/vehicle\/(\w+)/.exec(link); if (v) return '/drivers/' + v[1];
  if (/dashboard/.test(link)) return '/overview';
  return '/occurrences';
}

export type Crumb = { href: string; label: string };
type FrameProps = { active: string; title: string; sub?: ReactNode; path?: Crumb[]; actions?: ReactNode; noHead?: boolean; children: ReactNode };

export default function PageFrame({ active, title, sub, path, actions, noHead, children }: FrameProps) {
  const P = useOrbi();
  const router = useRouter();
  const [sideOpen, setSideOpen] = useState(false);
  const [pop, setPop] = useState<null | { kind: 'notif' | 'user'; top: number; right: number }>(null);
  const u = P.me() || { name: '', email: '' };
  const occ = openOccurrences(P).length;
  const b: Record<string, number> = { live: P.S.routes.filter((r: any) => r.status === 'IN_PROGRESS').length, occurrences: occ, messages: P.totalUnread(), routes: P.S.routes.filter((r: any) => r.status === 'DELAYED' || r.status === 'CREATED').length };
  const unreadN = P.notifs().filter((n: any) => !n.read).length;
  const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
  const group = (NAV.find(n => n[0] === active) || [])[3];

  useEffect(() => { document.title = `${title} · Orbi Portal`; }, [title]);

  // atalhos de teclado
  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || ({} as any)).tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(P, router); return; }
      if (typing || document.querySelector('.layer')) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { router.push('/routes/new'); return; }
      if (k === 'g') { g = Date.now(); return; }
      if (Date.now() - g < 1200) { const map: any = { v: 'overview', a: 'live', r: 'routes', m: 'drivers', o: 'occurrences' }; if (map[k]) router.push('/' + map[k]); g = 0; }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [P, router]);

  const openPop = (kind: 'notif' | 'user', el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPop(p => (p && p.kind === kind ? null : { kind, top: r.bottom + 8, right: Math.max(8, innerWidth - r.right) }));
  };
  const close = () => setSideOpen(false);

  return (
    <div className="app">
      <aside className={`side ${sideOpen ? 'open' : ''}`}>
        <Link className="brand" href="/overview" onClick={close}><span className="brand-logo"><Logo /></span><span><b>Orbi</b><small>Portal da empresa</small></span></Link>
        <nav className="side-nav">
          {navItems(P).map((n, i, all) => (
            <span key={n[0]} style={{ display: 'contents' }}>
              {(!i || all[i - 1][3] !== n[3]) && <div className="side-group">{n[3]}</div>}
              <Link href={'/' + n[0]} className={active === n[0] ? 'on' : ''} onClick={close}>
                <Icon name={n[2]} /><span>{n[1]}</span>{b[n[0]] ? <em className={n[0] === 'occurrences' ? 'red' : ''}>{b[n[0]]}</em> : null}
              </Link>
            </span>
          ))}
        </nav>
        <div className="side-foot">
          {P.API
            ? <a className="side-app" href="/login?demo" target="_blank" rel="noopener"><Icon name="eye" size="sm" /><span>Ver modo demonstração</span></a>
            : <a className="side-app" href="/login?api" onClick={() => leaveDemo()}><Icon name="link" size="sm" /><span>Sair da demonstração</span></a>}
          <div className="side-co"><Icon name="building" size="sm" /><span><b>{P.S.company.name}</b><small>{P.drivers().length} motoristas · {P.admins().length} gestores</small></span></div>
        </div>
      </aside>
      <div className={`side-scrim ${sideOpen ? 'on' : ''}`} onClick={close} />
      <div className="main">
        <header className="top">
          <button className="icon-btn only-m" aria-label="Menu" onClick={() => setSideOpen(true)}><Icon name="menu" /></button>
          <div className="top-title">
            <span className="crumb-path">
              {(path || (group ? [{ href: '', label: group }] : [])).map((c, i) => (
                <span key={i} style={{ display: 'contents' }}>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}<span className="sep">/</span></span>
              ))}
              <span className="cur">{title}</span>
            </span>
          </div>
          <button className="search-btn" aria-label="Buscar" onClick={() => palette(P, router)}><Icon name="search" size="sm" /><span>Buscar rotas, motoristas…</span><kbd>Ctrl K</kbd></button>
          <SyncPill P={P} />
          <span className="top-sep only-d" />
          <button className="icon-btn" aria-label="Alternar tema" onClick={() => { setTheme(dark ? 'light' : 'dark'); P.emit(); }}><Icon name={dark ? 'sun' : 'moon'} /></button>
          <button className="icon-btn" aria-label="Notificações" onClick={e => openPop('notif', e.currentTarget)}><Icon name="bell" />{unreadN ? <span className="dot">{unreadN}</span> : null}</button>
          <button className="user-btn" onClick={e => openPop('user', e.currentTarget)}><span className="avatar sm">{initials(u.name)}</span><span className="only-d"><b>{first(u.name)}</b><small>{u.title || 'Gestor'}</small></span><span className="only-d" style={{ display: 'contents' }}><Icon name="chevd" size="sm" /></span></button>
        </header>
        <SessionBanner P={P} />
        <main className="page" id="page">
          {!noHead && (
            <div className="page-header">
              <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
              {actions && <div className="page-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
      <nav className="bnav">
        {[NAV[0], NAV[1], NAV[2], NAV[3]].map(n => (
          <Link key={n[0]} href={'/' + n[0]} className={active === n[0] ? 'on' : ''}><Icon name={n[2]} /><span>{n[1]}</span>{b[n[0]] ? <em>{b[n[0]]}</em> : null}</Link>
        ))}
        <button className={['drivers', 'reports', 'messages', 'settings'].includes(active) ? 'on' : ''} onClick={() => setSideOpen(true)}><Icon name="menu" /><span>Mais</span>{b.messages ? <em>{b.messages}</em> : null}</button>
      </nav>
      {pop && <Popover pop={pop} onClose={() => setPop(null)}>{pop.kind === 'notif' ? <NotifPanel P={P} onClose={() => setPop(null)} /> : <UserMenu P={P} onClose={() => setPop(null)} />}</Popover>}
    </div>
  );
}

function Popover({ pop, onClose, children }: { pop: { top: number; right: number }; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener('click', off), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', off); };
  }, [onClose]);
  return <div ref={ref} className="pop" style={{ top: pop.top, right: pop.right }}>{children}</div>;
}

function NotifPanel({ P, onClose }: { P: any; onClose: () => void }) {
  const list = P.notifs().slice(0, 30);
  const iconOf = (t: string) => (/seguran|sos/i.test(t) ? 'shield' : /priorid|urgente|ciente/i.test(t) ? 'zap' : /coment|revis|resposta/i.test(t) ? 'chat' : /cancel|atras/i.test(t) ? 'alert' : 'route');
  return (
    <>
      <div className="pop-head"><b>Notificações</b>{list.some((n: any) => !n.read) && <button className="link" onClick={() => { P.act.readAllNotifs(); onClose(); }}>Marcar todas como lidas</button>}</div>
      <div className="pop-list">{list.length ? list.map((n: any) => (
        <Link key={n.id} href={portalLink(n.link)} className={`nt ${n.read ? '' : 'unread'}`} onClick={() => { P.act.readNotif(n.id); onClose(); }}>
          <span className="nt-ic"><Icon name={iconOf(n.title)} size="sm" /></span><span><b>{n.title}</b><small>{n.text}</small><em>{rel(n.at)}</em></span>
        </Link>
      )) : <p className="muted small" style={{ padding: 16 }}>Nenhuma notificação.</p>}</div>
    </>
  );
}

function UserMenu({ P, onClose }: { P: any; onClose: () => void }) {
  const router = useRouter();
  const u = P.me() || {};
  return (
    <>
      <div className="pop-user"><span className="avatar">{initials(u.name)}</span><span><b>{u.name}</b><small>{u.email}</small><small>{u.title || 'Gestor'} · {P.S.company.name}</small></span></div>
      <Link className="pop-item" href="/settings" onClick={onClose}><Icon name="settings" size="sm" /> Configurações</Link>
      <button className="pop-item" onClick={() => { onClose(); shortcuts(); }}><Icon name="keyboard" size="sm" /> Atalhos do teclado</button>
      <button className="pop-item danger" onClick={() => { P.setSession(null); onClose(); toast('Sessão encerrada', 'logout'); router.replace('/login'); }}><Icon name="logout" size="sm" /> Sair</button>
    </>
  );
}

function shortcuts() {
  openModal('Atalhos do teclado', () => (
    <ul className="kbd-list">
      <li><kbd>Ctrl</kbd> + <kbd>K</kbd><span>Buscar e executar ações</span></li>
      <li><kbd>N</kbd><span>Nova rota</span></li>
      <li><kbd>G</kbd> depois <kbd>V</kbd>/<kbd>A</kbd>/<kbd>R</kbd>/<kbd>M</kbd>/<kbd>O</kbd><span>Ir para Visão geral, Ao vivo, Rotas, Motoristas, Ocorrências</span></li>
      <li><kbd>Esc</kbd><span>Fechar janelas</span></li>
    </ul>
  ));
}

function SyncPill({ P }: { P: any }) {
  const flashing = P.sync.flash;
  if (!P.API) return <span className="sync-pill" data-tip="<b>Modo demonstração</b><div>Dados locais deste navegador</div>"><i /><span>Demonstração</span></span>;
  const st = P.sync.state;
  const label = flashing ? 'Atualizado agora' : st === 'waking' ? 'Acordando servidor…' : st === 'error' ? 'Sem conexão' : st === 'loading' ? 'Conectando…' : 'Sincronizado';
  const cls = flashing ? 'flash' : st === 'error' ? 'err' : st === 'waking' || st === 'loading' ? 'warn' : '';
  const tip = `<b>Conectado à Orbi API</b><div>Mesmos dados do app do motorista</div><div>Atualiza a cada ${CONFIG.pollSeconds} s · última: ${P.sync.last ? hhmm(P.sync.last) : '—'}</div>${P.sync.error ? `<div>${esc(P.sync.error)}</div>` : ''}`;
  return <span className={`sync-pill ${cls}`} data-tip={tip}><i /><span>{label}</span></span>;
}

function SessionBanner({ P }: { P: any }) {
  const router = useRouter();
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 20000); return () => clearInterval(t); }, []);
  if (!P.API) return null;
  const left = P.sessionExpiresIn() * 1000;
  if (left > 3 * 60000 || left <= 0) return null;
  return (
    <div className="sess-banner"><Icon name="clock" size="sm" /><span>Sua sessão expira em {Math.max(1, Math.round(left / 60000))} min. Salve o que estiver fazendo e entre de novo para continuar.</span>
      <button className="btn sm ghost" onClick={() => { P.setSession(null); router.replace('/login'); }}>Entrar de novo</button></div>
  );
}

/** Busca rápida (Ctrl K): páginas, ações, rotas e motoristas. */
export function palette(P: any, router: any) {
  const items: any[] = [];
  navItems(P).forEach(n => items.push({ t: n[1], s: 'Página', icon: n[2], go: '/' + n[0] }));
  items.push({ t: 'Nova rota', s: 'Ação', icon: 'plus', go: '/routes/new' });
  if (!P.API) items.push({ t: 'Novo motorista', s: 'Ação', icon: 'users', run: () => newDriverModal(P, router) });
  items.push({ t: 'Alternar tema claro/escuro', s: 'Ação', icon: 'moon', run: () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); P.emit(); } },
    { t: 'Imprimir relatório', s: 'Ação', icon: 'printer', go: '/reports', after: () => setTimeout(() => window.print(), 600) });
  P.S.routes.forEach((r: any) => { const d = P.user(r.driverId); items.push({ t: `${r.code} · ${d ? d.name : 'sem motorista'}`, s: ROUTE_STATUS[r.status][0] + ' · ' + r.window, icon: 'route', go: '/routes/' + r.id, k: r.stops.map(P.stopAddr).join(' ') }); });
  P.drivers().forEach((d: any) => items.push({ t: d.name, s: 'Motorista · ' + (d.vehicle || ''), icon: 'truck', go: '/drivers/' + d.id, k: d.email }));
  openModal('Buscar', close => <Palette items={items} onRun={i => { close(); if (i.go) router.push(i.go); if (i.run) i.run(); if (i.after) i.after(); }} />);
}

function Palette({ items, onRun }: { items: any[]; onRun: (i: any) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const t = q.trim().toLowerCase();
  const res = items.filter(i => !t || (i.t + ' ' + i.s + ' ' + (i.k || '')).toLowerCase().includes(t)).slice(0, 12);
  const cur = Math.min(sel, Math.max(0, res.length - 1));
  return (
    <div className="pal">
      <div className="input"><Icon name="search" size="sm" /><input autoFocus value={q} placeholder="Digite uma rota, motorista, endereço ou ação…" autoComplete="off"
        onChange={e => { setQ(e.target.value); setSel(0); }}
        onKeyDown={e => { if (e.key === 'ArrowDown') { setSel(Math.min(res.length - 1, cur + 1)); e.preventDefault(); } else if (e.key === 'ArrowUp') { setSel(Math.max(0, cur - 1)); e.preventDefault(); } else if (e.key === 'Enter' && res[cur]) onRun(res[cur]); }} /></div>
      <div className="pal-list">{res.length ? res.map((i, k) => (
        <button key={k} className={`pal-item ${k === cur ? 'on' : ''}`} onClick={() => onRun(i)}><Icon name={i.icon} size="sm" /><span><b>{i.t}</b><small>{i.s}</small></span><Icon name="chev" size="sm" /></button>
      )) : <p className="muted small">Nada encontrado.</p>}</div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>↑ ↓ para navegar · Enter para abrir · Esc para fechar</p>
    </div>
  );
}

export function NotFound() {
  return (
    <PageFrame active="" title="Não encontrado">
      <Empty icon="alert" title="Página não encontrada" text="O item pode ter sido removido." />
      <p className="center"><Link className="btn primary" href="/overview">Voltar à visão geral</Link></p>
    </PageFrame>
  );
}

export { closeModal };
