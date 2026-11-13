/*
 * Orbi Portal — núcleo (estado, regras do domínio e ações).
 *
 * Modo demonstração: estado no localStorage (mesmo formato do protótipo do app), sem rede.
 * Modo API: os dados vêm da Orbi API (ver ./api.ts, que substitui partes deste objeto).
 *
 * As páginas leem tudo por useOrbi(); qualquer mudança chama P.emit() e a tela se redesenha.
 */
import { D } from './data';
import { M } from './map';
import { CONFIG, resolveMode } from './config';
import { toast } from './ui';
import { enableApi } from './api';
import { type Check, rel, hhmm, fmtMin, plural, pct, uid, pad2, TERMINAL } from './format';
export * from './format';

export const KEY = 'orbi-prototipo-v1';           // mesmo estado do app (protótipo)
const SKEY = 'orbi-portal-session';                // sessão própria do portal (modo demo)

// ---------------------------------------------------------------------------
// Criação do objeto do portal
// ---------------------------------------------------------------------------
function createPortal() {
  const P: any = {};
  P.D = D; P.M = M; P.CFG = CONFIG;
  P.mode = resolveMode();
  P.API = false;
  P.features = { all: true };
  P.toast = toast;
  P.sync = { state: 'ok', last: new Date().toISOString(), error: null, waking: false, flash: false };
  P.STOP_COLORS = { COMPLETED: '#0F9F6E', SKIPPED: '#E59A1A', CANCELLED: '#D64545', IN_TRANSIT: '#2557D6', PENDING: '#667085' };

  // reatividade: a interface assina e redesenha quando a versão muda
  let version = 0;
  const listeners = new Set<() => void>();
  P.version = () => version;
  P.subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  P.emit = () => { version++; listeners.forEach(l => l()); };

  // -------------------------------------------------------------------------
  // Estado (modo demonstração)
  // -------------------------------------------------------------------------
  function migrate(s: any) {
    s.chats = s.chats || {}; s.chatRead = s.chatRead || {}; s.incidents = s.incidents || [];
    const seed = D.seed();
    seed.users.forEach((su: any) => {
      const u = s.users.find((x: any) => x.id === su.id);
      if (!u) s.users.push(su);
      else { if (su.vehicleInfo && !u.vehicleInfo) u.vehicleInfo = su.vehicleInfo; if (su.title && !u.title) u.title = su.title; }
    });
    s.company = s.company || seed.company;
    return s;
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) return migrate(s); } } catch { /* sem storage */ }
    return migrate(D.seed());
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P.S)); } catch { /* ignora */ } }
  P.S = load();
  P.reload = () => { P.S = load(); P.emit(); };
  // lê o estado mais recente, altera e grava (evita sobrescrever mudanças feitas em outra aba)
  P.mutate = (fn: (S: any) => any) => { P.S = load(); const out = fn(P.S); save(); P.emit(); return out; };
  P.resetDemo = () => { P.S = migrate(D.seed()); save(); P.emit(); };

  P.session = () => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { return null; } };
  P.setSession = (v: any) => { try { if (v) localStorage.setItem(SKEY, JSON.stringify(v)); else localStorage.removeItem(SKEY); } catch { /* ignora */ } P.emit(); };
  P.me = () => { const s = P.session(); return s && P.S.users.find((u: any) => u.id === s.userId && u.role === 'ADMIN'); };
  P.sessionExpiresIn = () => 0;

  // -------------------------------------------------------------------------
  // Regras do domínio (mesmas do app)
  // -------------------------------------------------------------------------
  P.user = (id: any) => P.S.users.find((u: any) => u.id === id);
  P.route = (id: any) => P.S.routes.find((r: any) => r.id === id);
  P.drivers = () => P.S.users.filter((u: any) => u.role === 'DRIVER');
  P.admins = () => P.S.users.filter((u: any) => u.role === 'ADMIN');
  P.routeInfo = (r: any) => {
    const total = r.stops.length;
    const done = r.stops.filter((s: any) => s.status === 'COMPLETED').length;
    const skipped = r.stops.filter((s: any) => s.status === 'SKIPPED').length;
    const cancelled = r.stops.filter((s: any) => s.status === 'CANCELLED').length;
    const handled = done + skipped + cancelled;
    const units = M.pathLength(M.pathThrough([D.DEPOT].concat(r.stops)));
    const kmv = M.unitsToKm(units);
    return { total, done, skipped, cancelled, handled, left: total - handled, units, km: kmv, minutes: M.unitsToMin(units) + total * 4, pct: pct(handled, total), cost: kmv * 1.85 + total * 2.5 };
  };
  P.nextStop = (r: any) => r.stops.find((s: any) => s.status === 'IN_TRANSIT') || r.stops.find((s: any) => s.status === 'PENDING');
  P.isToday = (r: any) => !r.finishedAt || (Date.now() - Date.parse(r.finishedAt)) < 16 * 3600000;
  P.stopAddr = (s: any) => `${s.street}, ${s.number}`;
  P.windowStart = (r: any) => { const m = /(\d{2}):(\d{2})/.exec(r.window || ''); if (!m) return null; const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d; };
  P.prioRank = (r: any) => (r.priority && r.status !== 'COMPLETED' ? (r.priority.level === 'URGENT' ? 2 : 1) : 0);
  P.vehicleOf = (u: any) => {
    if (!u.vehicleInfo) { const [model, plate] = String(u.vehicle || '').split('·').map(x => x.trim()); u.vehicleInfo = { ownership: 'PERSONAL', model: model || '', plate: plate || '', company: { insurer: '', policy: '', phone: '' }, personal: { insurer: '', policy: '', phone: '' } }; }
    return u.vehicleInfo;
  };
  P.insuranceOf = (u: any) => { const v = P.vehicleOf(u); return v[v.ownership === 'COMPANY' ? 'company' : 'personal']; };
  P.driverState = (d: any): [string, string] => {
    if (P.S.incidents.some((i: any) => i.driverId === d.id && i.status === 'OPEN')) return ['SOS', 'red'];
    if (P.S.routes.some((r: any) => r.driverId === d.id && r.status === 'IN_PROGRESS')) return ['Em rota', 'blue'];
    if (P.S.routes.some((r: any) => r.driverId === d.id && ['ASSIGNED', 'DELAYED'].includes(r.status))) return ['Escalado', 'neutral'];
    return ['Disponível', 'green'];
  };
  P.chatOf = (rid: any) => P.S.chats[rid] || [];
  P.unreadChat = (rid: any, u: any) => {
    if (!u) return 0;
    const last = ((P.S.chatRead || {})[u.id] || {})[rid];
    return P.chatOf(rid).filter((m: any) => m.from !== u.id && (!last || Date.parse(m.at) > Date.parse(last))).length;
  };
  P.totalUnread = () => { const u = P.me(); return u ? P.S.routes.reduce((a: number, r: any) => a + P.unreadChat(r.id, u), 0) : 0; };
  P.notifs = () => { const u = P.me(); return u ? P.S.notifications.filter((n: any) => n.userId === u.id) : []; };
  P.openIncidents = () => P.S.incidents.filter((i: any) => i.status === 'OPEN');
  P.hasSos = (rid: any) => P.S.incidents.some((i: any) => i.routeId === rid && i.status === 'OPEN');

  // Situação da rota (mesmas verificações do app)
  P.health = (r: any) => {
    const checks: Check[] = []; const d = P.user(r.driverId);
    const inc = P.S.incidents.find((i: any) => i.routeId === r.id && i.status === 'OPEN');
    checks.push(d ? ['ok', 'Motorista atribuído', d.name] : ['bad', 'Sem motorista', 'Atribua alguém para a rota sair']);
    const ws = P.windowStart(r);
    if (r.status === 'COMPLETED') checks.push(['ok', 'Rota concluída', `Finalizada ${rel(r.finishedAt)}`]);
    else if (r.status === 'IN_PROGRESS') checks.push(['ok', 'Rota iniciada', `Às ${hhmm(r.startedAt)}`]);
    else if (ws && Date.now() > ws.getTime()) checks.push(['bad', 'Não iniciada no horário', `Janela começou às ${hhmm(ws)} · atraso de ${fmtMin((Date.now() - ws.getTime()) / 60000)}`]);
    else checks.push(['ok', 'Dentro do horário', ws ? `Início previsto às ${hhmm(ws)}` : r.window]);
    if (r.status === 'IN_PROGRESS') {
      const last = r.stops.filter((s: any) => s.at).map((s: any) => Date.parse(s.at)).concat([Date.parse(r.startedAt)]).sort((a: number, b: number) => b - a)[0];
      const mins = Math.round((Date.now() - last) / 60000);
      checks.push(mins > 30 ? ['warn', 'Sem atividade recente', `Última atualização há ${fmtMin(mins)}`] : ['ok', 'Atividade recente', `Última atualização ${rel(new Date(last).toISOString())}`]);
    }
    const iss = r.stops.filter((s: any) => s.status === 'SKIPPED' || s.status === 'CANCELLED').length;
    const rev = r.stops.filter((s: any) => s.review && s.review.status === 'REQUESTED').length;
    checks.push(iss ? ['warn', plural(iss, 'ocorrência', 'ocorrências'), rev ? `${rev} aguardando revisão` : 'Paradas puladas ou canceladas'] : ['ok', 'Sem ocorrências', 'Nenhuma parada pulada ou cancelada']);
    if (r.priority && r.status !== 'COMPLETED') checks.push(r.priority.requireAck && !r.priority.ackAt ? ['warn', 'Alerta de prioridade enviado', 'Aguardando o motorista confirmar'] : ['ok', 'Alerta de prioridade', 'Motorista ciente']);
    if (inc) checks.push(['bad', 'Alerta de segurança ativo', `${inc.label} · ${rel(inc.at)}`]);
    const worst = checks.some(c => c[0] === 'bad') ? 'bad' : checks.some(c => c[0] === 'warn') ? 'warn' : 'ok';
    return { checks, worst, inc, rev };
  };

  // Posição estimada do motorista (mapa ao vivo da demonstração)
  function pathFrom(pos: any, b: any) {
    const onV = Math.abs(pos.x / 100 - Math.round(pos.x / 100)) < 1e-3;
    if (onV) return M.pathBetween({ x: Math.round(pos.x / 100) * 100, y: pos.y }, b);
    const xi = (b.x >= pos.x ? Math.ceil(pos.x / 100) : Math.floor(pos.x / 100)) * 100;
    return [{ x: pos.x, y: pos.y }].concat(M.pathBetween({ x: xi, y: pos.y }, b));
  }
  P.livePos = (r: any) => {
    if (r.status !== 'IN_PROGRESS') return null;
    const n = P.nextStop(r);
    const handled = r.stops.filter((s: any) => TERMINAL.includes(s.status));
    const from = r.driverPos || (handled.length ? handled[handled.length - 1] : D.DEPOT);
    if (!n) return { x: from.x, y: from.y, heading: 0, eta: 0 };
    const path = pathFrom(from, n);
    const len = M.pathLength(path);
    const seed = r.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    const t = ((Date.now() / 1000 + seed * 7) % 150) / 150; // anda e "reinicia" a cada 2,5 min
    const p = M.pointAt(path, len * Math.min(0.92, t));
    return { x: p.x, y: p.y, heading: p.heading, eta: M.unitsToMin(len * (1 - Math.min(0.92, t))), path, next: n };
  };
  P.streetAt = (pos: any) => {
    if (!pos) return D.DEPOT.street;
    if (Math.abs(pos.x / 100 - Math.round(pos.x / 100)) < 1e-3) return D.VERTICAL_STREETS[Math.round(pos.x / 100)] || '—';
    return D.HORIZONTAL_STREETS[Math.round(pos.y / 100)] || '—';
  };

  // -------------------------------------------------------------------------
  // Histórico simulado (relatórios) + dia de hoje real
  // -------------------------------------------------------------------------
  function rng(seed: number) { let x = Math.abs(Math.floor(seed)) % 2147483647 || 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; }
  const hashStr = (s: any) => String(s).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const REASONS = D.SKIP_REASONS.concat(D.CANCEL_REASONS).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i && x !== 'Outro motivo').concat(['Outro motivo']);
  P.history = (days: number) => {
    const out: any[] = [];
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    for (let d = days; d >= 1; d--) {
      const dt = new Date(today0.getTime() - d * 86400000);
      const dayIdx = Math.floor(dt.getTime() / 86400000);
      const dow = dt.getDay();
      const day: any = { date: dt, label: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), wd: dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), dow, routes: 0, stops: 0, delivered: 0, skipped: 0, cancelled: 0, km: 0, minutes: 0, onTime: 0, reasons: {}, hours: new Array(24).fill(0), drivers: {} };
      P.drivers().forEach((dr: any) => {
        const r = rng(hashStr(dr.id) + dayIdx * 7919);
        if (dow === 0 && r() < 0.75) return; // domingo quase sem rota
        const routes = dow === 6 ? 1 : 1 + (r() > 0.55 ? 1 : 0);
        const stops = routes * (5 + Math.floor(r() * 6));
        const delivered = Math.round(stops * (0.84 + r() * 0.13));
        const cancelled = Math.round((stops - delivered) * (0.25 + r() * 0.3));
        const skipped = stops - delivered - cancelled;
        const km = stops * (1.1 + r() * 0.9);
        const minutes = stops * (8 + r() * 6);
        const onTime = r() > 0.2 ? routes : routes - 1;
        for (let k = 0; k < skipped + cancelled; k++) { const rs = REASONS[Math.floor(Math.pow(r(), 1.6) * REASONS.length)]; day.reasons[rs] = (day.reasons[rs] || 0) + 1; }
        for (let k = 0; k < delivered; k++) { const h = 8 + Math.floor(Math.pow(r(), 0.9) * 10); day.hours[h]++; }
        day.drivers[dr.id] = { routes, stops, delivered, skipped, cancelled, km, minutes, onTime, rating: 4.3 + r() * 0.7 };
        day.routes += routes; day.stops += stops; day.delivered += delivered; day.skipped += skipped; day.cancelled += cancelled; day.km += km; day.minutes += minutes; day.onTime += onTime;
      });
      out.push(day);
    }
    return out;
  };
  P.todayStats = () => {
    const rs = P.S.routes.filter(P.isToday);
    const st = rs.flatMap((r: any) => r.stops);
    const c = (k: string) => st.filter((s: any) => s.status === k).length;
    const reasons: any = {}; st.filter((s: any) => s.reason).forEach((s: any) => { reasons[s.reason] = (reasons[s.reason] || 0) + 1; });
    const hours = new Array(24).fill(0); st.filter((s: any) => s.status === 'COMPLETED' && s.at).forEach((s: any) => { hours[new Date(s.at).getHours()]++; });
    const kmv = rs.reduce((a: number, r: any) => a + P.routeInfo(r).km, 0);
    const started = rs.filter((r: any) => r.startedAt || r.status === 'COMPLETED');
    const onTime = started.filter((r: any) => { const ws = P.windowStart(r); return !ws || !r.startedAt || Date.parse(r.startedAt) <= ws.getTime() + 20 * 60000; }).length;
    return { routes: rs.length, stops: st.length, delivered: c('COMPLETED'), skipped: c('SKIPPED'), cancelled: c('CANCELLED'), pending: st.filter((s: any) => !TERMINAL.includes(s.status)).length, km: kmv, cost: rs.reduce((a: number, r: any) => a + P.routeInfo(r).cost, 0), reasons, hours, live: rs.filter((r: any) => r.status === 'IN_PROGRESS').length, delayed: rs.filter((r: any) => r.status === 'DELAYED').length, onTimePct: pct(onTime, started.length || 1) };
  };

  // -------------------------------------------------------------------------
  // Ações (gravam no estado compartilhado e notificam o app)
  // -------------------------------------------------------------------------
  function notify(S: any, userId: any, title: string, text: string, link: string) { S.notifications.unshift({ id: uid('n'), userId, title, text, at: new Date().toISOString(), read: false, link }); }
  function postMsg(S: any, rid: any, from: any, text: string, kind?: string, meta?: any) {
    S.chats[rid] = S.chats[rid] || [];
    const m = { id: uid('m'), from: from ? from.id : null, role: from ? from.role : 'SYSTEM', name: from ? from.name : 'Orbi', text, kind: kind || 'text', at: new Date().toISOString(), meta: meta || null };
    S.chats[rid].push(m); return m;
  }
  const meOf = (S: any) => S.users.find((u: any) => u.id === P.session().userId);
  P.act = {
    assign(rid: any, did: any) {
      P.mutate((S: any) => {
        const r = S.routes.find((x: any) => x.id === rid); const me = meOf(S);
        const prev = r.driverId; if (prev === did) return;
        r.driverId = did; r.assignedAt = new Date().toISOString();
        if (r.status === 'CREATED') r.status = 'ASSIGNED';
        if (r.status === 'IN_PROGRESS') { r.status = 'ASSIGNED'; delete r.driverPos; r.stops.forEach((x: any) => { if (x.status === 'IN_TRANSIT') x.status = 'PENDING'; }); }
        const d = S.users.find((u: any) => u.id === did);
        notify(S, did, 'Nova rota atribuída', `A rota ${r.code} foi atribuída a você (${r.window}).`, '#/d/route/' + r.id);
        if (prev) notify(S, prev, `Rota reatribuída · ${r.code}`, `${r.code} foi passada para ${d.name}.`, '#/d/home');
        postMsg(S, r.id, null, `Rota atribuída a ${d.name} por ${me.name}`, 'system');
      });
      return Promise.resolve(true);
    },
    priority(rid: any, level: string, message: string, ack: boolean) {
      P.mutate((S: any) => {
        const r = S.routes.find((x: any) => x.id === rid); const me = meOf(S);
        r.priority = { level, message, by: me.id, byName: me.name, at: new Date().toISOString(), requireAck: ack, ackAt: null };
        postMsg(S, rid, me, message, 'priority', { level });
        notify(S, r.driverId, `${level === 'URGENT' ? 'Urgente' : 'Alta prioridade'} · ${r.code}`, message, '#/d/route/' + r.id);
      });
    },
    clearPriority(rid: any) {
      P.mutate((S: any) => { const r = S.routes.find((x: any) => x.id === rid); r.priority = null; r.priorityClearedAt = new Date().toISOString(); postMsg(S, rid, null, 'Prioridade removida pelo gestor', 'system'); if (r.driverId) notify(S, r.driverId, `Prioridade removida · ${r.code}`, 'A rota voltou ao normal.', '#/d/route/' + r.id); });
    },
    message(rid: any, text: string) {
      P.mutate((S: any) => { const me = meOf(S); postMsg(S, rid, me, text, 'text'); S.chatRead[me.id] = S.chatRead[me.id] || {}; S.chatRead[me.id][rid] = new Date().toISOString(); });
    },
    readChat(rid: any) {
      const id = P.session().userId;
      const last = ((P.S.chatRead || {})[id] || {})[rid];
      const lm = P.chatOf(rid).slice(-1)[0];
      if (lm && last && Date.parse(last) >= Date.parse(lm.at)) return; // nada novo
      P.mutate((S: any) => { S.chatRead[id] = S.chatRead[id] || {}; S.chatRead[id][rid] = new Date().toISOString(); });
    },
    seeIncident(id: any) {
      P.mutate((S: any) => {
        const inc = S.incidents.find((i: any) => i.id === id); if (!inc || inc.seenAt) return;
        const me = meOf(S);
        inc.seenAt = new Date().toISOString();
        if (inc.routeId) postMsg(S, inc.routeId, null, `${me.name} visualizou o alerta de segurança`, 'system');
        notify(S, inc.driverId, 'Gestor visualizou seu alerta', `${me.name} já está acompanhando: ${inc.label}.`, '#/d/home');
      });
    },
    resolveIncident(id: any, note: string) {
      P.mutate((S: any) => {
        const inc = S.incidents.find((i: any) => i.id === id); const me = meOf(S);
        inc.status = 'RESOLVED'; inc.resolvedAt = new Date().toISOString(); inc.resolvedBy = me.id; inc.resolution = note || '';
        if (inc.routeId) postMsg(S, inc.routeId, null, `Alerta de segurança encerrado por ${me.name}${note ? ': ' + note : ''}`, 'system');
        notify(S, inc.driverId, 'Alerta encerrado', `${me.name} marcou seu alerta como resolvido.`, '#/d/home');
      });
    },
    comment(rid: any, sid: any, text: string, resolveReview: boolean) {
      P.mutate((S: any) => {
        const r = S.routes.find((x: any) => x.id === rid); const s = r.stops.find((x: any) => x.id === sid); const me = meOf(S);
        const idx = r.stops.indexOf(s) + 1;
        if (text) { s.comments = s.comments || []; s.comments.push({ by: me.name, role: 'ADMIN', text, at: new Date().toISOString() }); }
        if (resolveReview && s.review && s.review.status === 'REQUESTED') {
          s.review.status = 'RESOLVED'; s.review.resolvedAt = new Date().toISOString(); s.review.answer = text || '';
          notify(S, r.driverId, `Revisão concluída · ${r.code}`, `O gestor revisou a parada #${pad2(idx)}${text ? `: “${text}”` : '.'}`, '#/d/route/' + r.id);
        } else if (text && r.driverId) notify(S, r.driverId, `Resposta do gestor · ${r.code}`, `Parada #${pad2(idx)}: “${text}”`, '#/d/route/' + r.id);
      });
    },
    deleteRoute(rid: any) { P.mutate((S: any) => { S.routes = S.routes.filter((r: any) => r.id !== rid); (S.deletedRoutes = S.deletedRoutes || []).push(rid); }); return Promise.resolve(true); },
    createRoute(stops: any[], driverId: any, win: string) {
      return P.mutate((S: any) => {
        const id = 'r' + S.routeCounter; const code = 'RT-' + S.routeCounter; S.routeCounter++;
        const r = { id, code, driverId: driverId || null, status: driverId ? 'ASSIGNED' : 'CREATED', window: win, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, stops };
        S.routes.unshift(r);
        if (driverId) notify(S, driverId, 'Nova rota atribuída', `A rota ${code} foi atribuída a você (${win}).`, '#/d/route/' + id);
        return r;
      });
    },
    createDriver(data: any) {
      return P.mutate((S: any) => {
        const u = Object.assign({ id: uid('u'), role: 'DRIVER', rating: 5, ratingsCount: 0, since: new Date().toISOString() }, data);
        S.users.push(u); return u;
      });
    },
    updateVehicle(id: any, vi: any) {
      P.mutate((S: any) => {
        const u = S.users.find((x: any) => x.id === id); vi.updatedAt = new Date().toISOString(); u.vehicleInfo = vi; u.vehicle = `${vi.model} · ${vi.plate}`;
        notify(S, id, 'Veículo atualizado pela gestão', `${vi.ownership === 'COMPANY' ? 'Da empresa' : 'Particular'}: ${u.vehicle}.`, '#/d/vehicle');
      });
    },
    fleetInsurance(ins: any) {
      return P.mutate((S: any) => {
        S.company.fleetInsurance = ins; let n = 0;
        S.users.filter((u: any) => u.role === 'DRIVER').forEach((u: any) => { const v = u.vehicleInfo; if (v && v.ownership === 'COMPANY') { v.company = Object.assign({}, ins); v.updatedAt = new Date().toISOString(); n++; notify(S, u.id, 'Seguro da frota atualizado', `${ins.insurer} · assistência ${ins.phone}`, '#/d/vehicle'); } });
        return n;
      });
    },
    company(data: any) { P.mutate((S: any) => { Object.assign(S.company, data); }); },
    addManager(data: any) { return P.mutate((S: any) => { const u = Object.assign({ id: uid('u'), role: 'ADMIN', company: S.company.name }, data); S.users.push(u); return u; }); },
    readNotif(id: any) { P.mutate((S: any) => { const n = S.notifications.find((x: any) => x.id === id); if (n) n.read = true; }); },
    readAllNotifs() { P.mutate((S: any) => { const id = P.session().userId; S.notifications.forEach((n: any) => { if (n.userId === id) n.read = true; }); }); }
  };

  // cores das rotas (mapa e listas)
  const ROUTE_COLORS = ['#2557D6', '#C2417A', '#14857A', '#6E56CF', '#D9622B', '#3E8EDE', '#5E8C31', '#A86B12'];
  P.routeColor = (r: any) => ROUTE_COLORS[Math.max(0, P.S.routes.indexOf(r)) % ROUTE_COLORS.length];

  if (P.mode === 'api') enableApi(P);
  return P;
}

let portal: any = null;
/** Objeto único do portal (só existe no navegador). */
export function getPortal() {
  if (!portal) portal = createPortal();
  return portal;
}
