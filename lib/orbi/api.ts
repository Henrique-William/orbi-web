/*
 * Orbi Portal — conexão com a Orbi API real (mesmos dados do app Android).
 *
 * O que a API oferece hoje (sem nenhuma alteração nela):
 *   POST /api/auth/login · GET /api/route · GET /api/deliveries/route/{id} · GET /api/user (ADMIN)
 *   PATCH /api/route/{id}/assign-driver · PATCH /api/route/{id}/cancel · DELETE /api/route/{id}
 *   POST /api/route/optimize (usa a cota do OpenRouteService)
 */
import { CONFIG, autoRefreshSeconds, saveAutoRefresh } from './config';
import { esc, hhmm, rel, fmtMin, plural, pct, uid, TERMINAL, STOP_STATUS, type Check } from './format';

const TOKEN_KEY = 'orbi-api-sessao';
const NOTIF_KEY = 'orbi-api-notificacoes';
const GOALS_KEY = 'orbi-api-metas';
const SNAP_KEY = 'orbi-api-ultimo-estado';

type ApiError = Error & { status?: number; data?: any; network?: boolean; restricted?: boolean };

export function enableApi(P: any) {
  P.API = true;
  // recursos que a API atual ainda não tem ficam escondidos no portal
  P.features = { chat: false, priority: false, sos: false, vehicle: false, reviews: false, comments: false, liveGps: false, createDriver: false, companyEdit: false, punctuality: false };

  // -------------------------------------------------------------------------
  // Sessão (token JWT da API; nunca guardamos a senha)
  // -------------------------------------------------------------------------
  function readSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
      if (s && s.exp * 1000 <= Date.now()) { sessionStorage.removeItem(TOKEN_KEY); stopPolling(); P.sessionExpired = true; return null; } // token vencido
      return s;
    } catch { return null; }
  }
  function writeSession(s: any) { try { if (s) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(s)); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignora */ } }
  function decodeJwt(t: string) {
    try { let p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); p += '='.repeat((4 - (p.length % 4)) % 4); return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch { return null; }
  }
  P.session = () => { const s = readSession(); return s ? { userId: s.userId } : null; };
  P.setSession = (v: any) => { if (!v) { writeSession(null); stopPolling(); P.sync.last = null; P.emit(); } };
  P.me = () => { const s = readSession(); return s ? { id: s.userId, name: s.name, email: s.email, role: 'ADMIN', title: 'Gestor', company: CONFIG.companyName } : null; };
  P.sessionExpiresIn = () => { const s = readSession(); return s ? Math.round((s.exp * 1000 - Date.now()) / 1000) : 0; };

  // -------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------
  P.sync = { state: 'idle', last: null, error: null, waking: false, flash: false };
  function setSyncState(state: string, error?: string) { P.sync.state = state; P.sync.error = error || null; P.emit(); }

  async function request(method: string, path: string, body?: any, opts: any = {}): Promise<any> {
    const s = readSession();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (s && !opts.noAuth) headers.Authorization = 'Bearer ' + s.token;
    const attempts = opts.retries == null ? 3 : opts.retries;
    let lastErr: ApiError | null = null;
    for (let i = 0; i < attempts; i++) {
      let res: Response;
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeout || 60000);
        res = await fetch(CONFIG.apiBase + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);
      } catch {
        lastErr = new Error('Sem conexão com o servidor'); lastErr.network = true;
        P.sync.waking = true; setSyncState('waking');
        await new Promise(r => setTimeout(r, 2500 * (i + 1)));
        continue;
      }
      // o Render gratuito "dorme": as primeiras chamadas podem falhar com 502/503/504 enquanto ele acorda
      if ([502, 503, 504].includes(res.status) && i < attempts - 1) { P.sync.waking = true; setSyncState('waking'); await new Promise(r => setTimeout(r, 4000 * (i + 1))); continue; }
      P.sync.waking = false;
      if (res.status === 401 && !opts.noAuth) { writeSession(null); stopPolling(); P.sessionExpired = true; P.emit(); const e: ApiError = new Error('Sua sessão expirou. Entre novamente.'); e.status = 401; throw e; }
      const text = await res.text();
      let data: any = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (!res.ok) { const e: ApiError = new Error(apiMessage(res.status, data)); e.status = res.status; e.data = data; throw e; }
      return data;
    }
    throw lastErr || new Error('Falha na comunicação com a API');
  }
  function apiMessage(status: number, data: any) {
    if (status === 401) return 'E-mail/usuário ou senha incorretos.';
    const m = data && typeof data === 'object' ? (data.message || data.error || data.detail) : null;
    if (m && m !== 'Bad Request' && m !== 'Forbidden') return m;
    return ({ 400: 'A API recusou a operação.', 403: 'Sua conta não tem permissão para isso.', 404: 'Item não encontrado na API.', 422: 'Dados inválidos.', 500: 'Erro interno na API.' } as any)[status] || `A API respondeu com erro ${status}.`;
  }
  P.apiRequest = request;

  // -------------------------------------------------------------------------
  // Login: só contas com papel ADMIN entram
  // -------------------------------------------------------------------------
  P.apiLogin = async (email: string, password: string) => {
    const res = await request('POST', '/auth/login', { email, password }, { noAuth: true, retries: 3 });
    const token = res && res.accessToken;
    const payload = token && decodeJwt(token);
    if (!payload) throw new Error('Resposta de login inesperada da API.');
    const scopes = String(payload.scope || '').split(/\s+/);
    if (!scopes.includes('ADMIN')) { const e: ApiError = new Error('restrito'); e.restricted = true; throw e; }
    const exp = payload.exp || Math.floor(Date.now() / 1000) + (res.expiresIn || 1440);
    writeSession({ token, userId: payload.sub, exp, name: email.split('@')[0], email });
    try {
      const u = await request('GET', '/user/' + encodeURIComponent(payload.sub), undefined, { retries: 1 });
      if (u && u.name) { const s = readSession(); s.name = u.name; s.email = u.email || email; writeSession(s); }
    } catch { /* nome é opcional */ }
    P.sessionExpired = false;
    await P.syncNow(true);
    startPolling();
  };

  // -------------------------------------------------------------------------
  // Conversão: formato da API -> formato usado pelas páginas do portal
  // -------------------------------------------------------------------------
  const RS: Record<string, string> = { CREATED: 'CREATED', ASSIGNED: 'ASSIGNED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' };
  const DS: Record<string, string> = { TO_BE_DELIVERED: 'PENDING', IN_TRANSIT: 'IN_TRANSIT', OUT_FOR_DELIVERY: 'IN_TRANSIT', DELIVERED: 'COMPLETED', SKIPPED: 'SKIPPED', CANCELLED: 'CANCELLED' };
  const iso = (v: any) => (v ? (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + (CONFIG.apiTimesUtc === false ? '' : 'Z')) : null);
  const code = (id: any) => 'RT-' + String(id).padStart(3, '0');
  function stopFrom(d: any, route: any) {
    const st = DS[d.status] || 'PENDING';
    const at = d.deliveredAt || (['SKIPPED', 'CANCELLED'].includes(st) ? (d.pickedUpAt || route.finalizedAt || null) : null);
    return {
      id: 'd' + d.id, apiId: d.id, order: d.order, rawStatus: d.status, status: st,
      recipient: d.recipientEmail || 'Destinatário', phone: '', street: d.address || 'Endereço não informado', number: '', district: '', city: '',
      lat: Number(d.latitude), lng: Number(d.longitude), x: 0, y: 0,
      reason: ['SKIPPED', 'CANCELLED'].includes(st) ? (d.details || null) : null,
      details: d.details || null, at: iso(at), pickedUpAt: iso(d.pickedUpAt), deliveredAt: iso(d.deliveredAt),
      proof: null, packages: [{ desc: d.details && st === 'COMPLETED' ? d.details : 'Entrega', weight: 0 }]
    };
  }
  function routeFrom(r: any, deliveries: any[]) {
    const drv = r.driverId && typeof r.driverId === 'object' ? r.driverId : null;
    const stops = (deliveries || []).slice().sort((a, b) => a.order - b.order).map(d => stopFrom(d, r));
    const firstPick = stops.map(s => s.pickedUpAt).filter(Boolean).sort()[0] || null;
    const created = iso(r.createdAt);
    return {
      id: String(r.id), apiId: r.id, code: code(r.id), driverId: drv ? drv.userId : null, driverName: r.driverName || (drv && drv.driverName) || null,
      status: RS[r.status] || r.status, window: created ? `Criada em ${new Date(created).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—',
      createdAt: created, assignedAt: iso(r.assignedAt), startedAt: r.status === 'IN_PROGRESS' || r.status === 'COMPLETED' ? (firstPick || iso(r.assignedAt)) : null, finishedAt: iso(r.finalizedAt),
      apiDistance: r.totalDistance || 0, apiCost: r.totalCost || 0, stops, priority: null
    };
  }
  function usersFrom(list: any[], routes: any[]) {
    const users: any[] = [];
    const seen = new Set();
    (list || []).forEach(u => {
      const roles = (u.role || u.roles || []).map((x: any) => x && (x.name || x)).filter(Boolean);
      const role = roles.includes('ADMIN') ? 'ADMIN' : roles.includes('DRIVER') ? 'DRIVER' : 'BASIC';
      users.push({ id: u.id, name: u.name, email: u.email, role, roles, phone: '', since: iso(u.createdAt), rating: 0, ratingsCount: 0, vehicle: '—', title: role === 'ADMIN' ? 'Gestor' : '' });
      seen.add(u.id);
    });
    // motoristas que aparecem nas rotas (traz telefone; inclui quem não veio na listagem)
    (routes || []).forEach(r => {
      const d = r.driverId && typeof r.driverId === 'object' ? r.driverId : null;
      if (!d) return;
      const ex = users.find(u => u.id === d.userId);
      if (ex) { ex.role = 'DRIVER'; ex.phone = d.phone || ex.phone; ex.cnh = d.cnh; if (!ex.name) ex.name = d.driverName; }
      else if (!seen.has(d.userId)) { users.push({ id: d.userId, name: d.driverName || 'Motorista', email: '', role: 'DRIVER', phone: d.phone || '', cnh: d.cnh, since: iso(d.profileCreatedAt), rating: 0, ratingsCount: 0, vehicle: '—' }); seen.add(d.userId); }
    });
    const me = P.me();
    if (me && !users.some(u => u.id === me.id)) users.push({ id: me.id, name: me.name, email: me.email, role: 'ADMIN', title: 'Gestor' });
    return users;
  }
  function loadGoals() { try { return JSON.parse(localStorage.getItem(GOALS_KEY) || 'null') || { successRate: 92, onTime: 90 }; } catch { return { successRate: 92, onTime: 90 }; } }
  function loadNotifs() { try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; } }
  function saveNotifs(n: any[]) { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(n.slice(0, 80))); } catch { /* ignora */ } }

  P.S = { version: 1, users: [], routes: [], chats: {}, chatRead: {}, incidents: [], notifications: loadNotifs(), reviews: [], company: { name: CONFIG.companyName, goals: loadGoals(), fleetInsurance: {} }, routeCounter: 0 };
  P.reload = () => { };
  P.mutate = (fn: any) => { const out = fn(P.S); P.emit(); return out; };
  P.resetDemo = () => { };

  // -------------------------------------------------------------------------
  // Sincronização periódica (o app grava na API; o portal lê a cada N segundos)
  // -------------------------------------------------------------------------
  let timer: any = null, running: Promise<void> | null = null, lastSig = '', polls = 0, muteToasts = false;
  const finishedCache: Record<string, any> = {};
  // uma sincronização por vez; se uma ação pedir dados novos durante outra, espera e roda de novo
  P.syncNow = async (force?: boolean): Promise<void> => {
    if (running) { const cur = running; await cur.catch(() => { }); if (!force) return; if (running && running !== cur) return running; }
    if (!readSession()) return;
    running = doSync(force);
    try { await running; } finally { running = null; }
  };
  async function doSync(force?: boolean) {
    setSyncState(P.sync.last ? 'syncing' : 'loading');
    try {
      const routes = await request('GET', '/route');
      let users = null;
      if (force || polls % 6 === 0 || !P.S.users.length) {
        try { const u = await request('GET', '/user?page=0&pageSize=200', undefined, { retries: 1 }); users = u && u.users; } catch { users = null; }
      }
      // entregas: rotas ativas a cada ciclo; finalizadas só uma vez
      const list = Array.isArray(routes) ? routes : [];
      const out: any[] = [];
      const queue = list.slice();
      const worker = async () => {
        while (queue.length) {
          const r = queue.shift();
          const done = ['COMPLETED', 'CANCELLED'].includes(r.status);
          const key = r.id + ':' + r.status + ':' + (r.finalizedAt || '');
          let ds;
          if (done && finishedCache[r.id] && finishedCache[r.id].key === key && !force) ds = finishedCache[r.id].ds;
          else { ds = await request('GET', '/deliveries/route/' + r.id, undefined, { retries: 2 }); if (done) finishedCache[r.id] = { key, ds }; }
          out.push(routeFrom(r, ds));
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      out.sort((a, b) => b.apiId - a.apiId);
      const prev = P.S.routes;
      P.S.routes = out;
      if (users) P.S.users = usersFrom(users, list);
      else P.S.users = usersFrom(P.S.users.map((u: any) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.since, role: (u.roles || [u.role]).map((n: any) => ({ name: n })) })), list);
      P.S.routeCounter = out.length ? Math.max(...out.map(r => r.apiId)) + 1 : 1;
      if (prev.length || P.sync.last) diffAndNotify(prev, out);
      else rememberSnapshot(out);
      const hadData = !!P.sync.last;
      P.sync.last = new Date().toISOString(); polls++;
      const sig = JSON.stringify(out.map(r => [r.id, r.status, r.driverId, r.stops.map((s: any) => s.rawStatus + (s.details || ''))])) + '|' + P.S.users.length;
      if (sig !== lastSig) { if (lastSig && hadData) { P.sync.flash = true; setTimeout(() => { P.sync.flash = false; P.emit(); }, 2500); } lastSig = sig; }
      setSyncState('ok');
    } catch (e: any) {
      setSyncState(e.status === 401 ? 'idle' : 'error', e.message);
    }
  }
  // Atualização automática só se o gestor ligar (Configurações → Conexão). Por padrão é manual:
  // cada consulta ao /api/route também busca as entregas de cada rota ativa, então evitamos chamadas à toa.
  function startPolling() {
    stopPolling();
    const every = autoRefreshSeconds();
    if (!every) return;
    const tick = () => { P.syncNow(); timer = setTimeout(tick, Math.max(every, document.hidden ? 120 : every) * 1000); };
    timer = setTimeout(tick, every * 1000);
  }
  function stopPolling() { if (timer) clearTimeout(timer); timer = null; }
  P.startPolling = startPolling;
  P.isPolling = () => !!timer || !autoRefreshSeconds();
  P.autoRefresh = () => autoRefreshSeconds();
  P.setAutoRefresh = (seconds: number) => { saveAutoRefresh(seconds); if (readSession()) startPolling(); P.emit(); };
  /** Botão "Atualizar": busca rotas e entregas agora (entregas de rotas já finalizadas vêm do cache). */
  P.refresh = async () => { await P.syncNow(); if (P.sync.state === 'ok') P.toast('Dados atualizados', 'refresh'); };
  P.stopPolling = stopPolling;
  // ao voltar para a aba, atualiza na hora (só no modo automático)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && autoRefreshSeconds() && readSession() && P.sync.last) { P.syncNow(); startPolling(); } });

  // notificações locais geradas a partir do que mudou na API (ex.: motorista entregou pelo app)
  function rememberSnapshot(routes: any[]) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(routes.map(r => ({ id: r.id, s: r.status, d: r.driverId, st: r.stops.map((x: any) => [x.id, x.rawStatus]) })))); } catch { /* ignora */ }
  }
  function diffAndNotify(prevRoutes: any[], routes: any[]) {
    let prev = prevRoutes;
    if (!prev.length) { try { prev = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]').map((r: any) => ({ id: r.id, status: r.s, driverId: r.d, stops: r.st.map((x: any) => ({ id: x[0], rawStatus: x[1] })) })); } catch { prev = []; } }
    const me = P.me(); if (!me) return;
    const pm = new Map(prev.map(r => [r.id, r]));
    const news: any[] = [];
    const add = (title: string, text: string, rid: any, toastIt: boolean) => news.push({ id: uid('n'), userId: me.id, title, text, at: new Date().toISOString(), read: false, link: '/routes/' + rid, toast: toastIt });
    routes.forEach(r => {
      const o: any = pm.get(r.id);
      const dn = (P.S.users.find((u: any) => u.id === r.driverId) || {}).name || r.driverName || 'O motorista';
      if (!o) { if (prev.length) add('Nova rota na API', `${r.code} com ${r.stops.length} paradas.`, r.id, true); return; }
      if (o.status !== r.status) {
        const msg = ({ IN_PROGRESS: `${dn} iniciou a rota ${r.code}.`, COMPLETED: `${dn} concluiu a rota ${r.code}.`, CANCELLED: `A rota ${r.code} foi cancelada.`, ASSIGNED: `${r.code} foi atribuída a ${dn}.` } as any)[r.status];
        if (msg) add(r.status === 'COMPLETED' ? 'Rota concluída' : r.status === 'CANCELLED' ? 'Rota cancelada' : 'Rota atualizada', msg, r.id, true);
      }
      const os = new Map((o.stops || []).map((s: any) => [s.id, s.rawStatus]));
      r.stops.forEach((s: any, i: number) => {
        const before = os.get(s.id);
        if (before && before !== s.rawStatus) {
          const n = `#${String(i + 1).padStart(2, '0')}`;
          if (s.status === 'COMPLETED') add('Entrega concluída', `${dn} entregou a parada ${n} da ${r.code}.`, r.id, true);
          else if (s.status === 'SKIPPED') add('Parada pulada', `${dn} pulou a parada ${n} da ${r.code}${s.reason ? ': ' + s.reason : ''}.`, r.id, true);
          else if (s.status === 'CANCELLED' && r.status !== 'CANCELLED') add('Entrega cancelada', `${dn} cancelou a parada ${n} da ${r.code}${s.reason ? ': ' + s.reason : ''}.`, r.id, true);
          else if (s.status === 'IN_TRANSIT' && before === 'TO_BE_DELIVERED') add('A caminho', `${dn} saiu para a parada ${n} da ${r.code}.`, r.id, false);
        }
      });
    });
    if (news.length) {
      P.S.notifications = news.concat(P.S.notifications).slice(0, 80);
      saveNotifs(P.S.notifications);
      if (!muteToasts) news.filter(n => n.toast).slice(0, 3).forEach(n => P.toast(n.text, 'refresh'));
    }
    rememberSnapshot(routes);
  }

  // -------------------------------------------------------------------------
  // Regras adaptadas aos dados reais
  // -------------------------------------------------------------------------
  const R = 6371;
  function hav(a: any, b: any) { const dLa = ((b.lat - a.lat) * Math.PI) / 180, dLo = ((b.lng - a.lng) * Math.PI) / 180; const x = Math.sin(dLa / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
  P.geoKm = (stops: any[]) => { let k = 0; for (let i = 1; i < stops.length; i++) if (isFinite(stops[i].lat) && isFinite(stops[i - 1].lat)) k += hav(stops[i - 1], stops[i]); return k * 1.3; }; // 1,3 = fator de ruas sobre a linha reta
  P.routeInfo = (r: any) => {
    const total = r.stops.length;
    const c = (k: string) => r.stops.filter((s: any) => s.status === k).length;
    const done = c('COMPLETED'), skipped = c('SKIPPED'), cancelled = c('CANCELLED');
    const handled = done + skipped + cancelled;
    const km = r.apiDistance > 0 ? r.apiDistance : P.geoKm(r.stops);
    return { total, done, skipped, cancelled, handled, left: total - handled, units: 0, km, minutes: Math.round((km / 28) * 60 + total * 4), pct: pct(handled, total), cost: r.apiCost > 0 ? r.apiCost : km * 1.85 + total * 2.5 };
  };
  P.stopAddr = (s: any) => s.street;
  P.livePos = () => null;
  P.windowStart = () => null;
  P.driverState = (d: any): [string, string] => {
    if (P.S.routes.some((r: any) => r.driverId === d.id && r.status === 'IN_PROGRESS')) return ['Em rota', 'blue'];
    if (P.S.routes.some((r: any) => r.driverId === d.id && r.status === 'ASSIGNED')) return ['Escalado', 'neutral'];
    return ['Disponível', 'green'];
  };
  P.health = (r: any) => {
    const checks: Check[] = []; const d = P.user(r.driverId);
    checks.push(d ? ['ok', 'Motorista atribuído', d.name] : (r.status === 'CANCELLED' ? ['ok', 'Rota cancelada', ''] : ['bad', 'Sem motorista', 'Atribua alguém para a rota sair']));
    if (r.status === 'COMPLETED') checks.push(['ok', 'Rota concluída', `Finalizada ${rel(r.finishedAt)}`]);
    else if (r.status === 'IN_PROGRESS') {
      const last = r.stops.map((s: any) => s.deliveredAt || s.pickedUpAt).filter(Boolean).sort().pop();
      const mins = last ? Math.round((Date.now() - Date.parse(last)) / 60000) : null;
      checks.push(mins != null && mins > 60 ? ['warn', 'Sem atividade recente', `Última atualização há ${fmtMin(mins)}`] : ['ok', 'Em andamento', last ? `Última atualização ${rel(last)}` : 'Aguardando a primeira entrega']);
    } else if (r.status === 'ASSIGNED') {
      const hrs = r.assignedAt ? (Date.now() - Date.parse(r.assignedAt)) / 3600000 : 0;
      checks.push(hrs > 12 ? ['warn', 'Ainda não iniciada', `Atribuída ${rel(r.assignedAt)}`] : ['ok', 'Aguardando início', r.assignedAt ? `Atribuída ${rel(r.assignedAt)}` : '']);
    }
    const iss = r.stops.filter((s: any) => s.status === 'SKIPPED' || (s.status === 'CANCELLED' && r.status !== 'CANCELLED')).length;
    checks.push(iss ? ['warn', plural(iss, 'ocorrência', 'ocorrências'), 'Paradas puladas ou canceladas'] : ['ok', 'Sem ocorrências', 'Nenhuma parada pulada ou cancelada']);
    const worst = checks.some(c => c[0] === 'bad') ? 'bad' : checks.some(c => c[0] === 'warn') ? 'warn' : 'ok';
    return { checks, worst, inc: null, rev: 0 };
  };

  // histórico real a partir dos horários das entregas
  function dayKey(d: any) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function buildDays(days: number, includeToday: boolean) {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const out: any[] = [];
    const from = includeToday ? days - 1 : days;
    for (let i = from; i >= (includeToday ? 0 : 1); i--) {
      const dt = new Date(today0.getTime() - i * 86400000);
      out.push({ date: dt, key: dt.getTime(), label: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), wd: dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), dow: dt.getDay(), routes: 0, stops: 0, delivered: 0, skipped: 0, cancelled: 0, km: 0, minutes: 0, onTime: 0, reasons: {}, hours: new Array(24).fill(0), drivers: {} });
    }
    const byKey = new Map(out.map(d => [d.key, d]));
    const drv = (day: any, id: any) => (day.drivers[id] = day.drivers[id] || { routes: 0, stops: 0, delivered: 0, skipped: 0, cancelled: 0, km: 0, minutes: 0, onTime: 0, rating: 0 });
    P.S.routes.forEach((r: any) => {
      const rd = r.createdAt && byKey.get(dayKey(r.createdAt));
      const inf = P.routeInfo(r);
      if (rd) { rd.routes++; rd.onTime++; rd.km += inf.km; rd.minutes += inf.minutes; if (r.driverId) { const x = drv(rd, r.driverId); x.routes++; x.onTime++; x.km += inf.km; x.minutes += inf.minutes; } }
      if (r.status === 'CANCELLED') return;
      r.stops.forEach((s: any) => {
        if (!TERMINAL.includes(s.status)) return;
        const when = s.at || r.finishedAt || r.createdAt; const day = when && byKey.get(dayKey(when)); if (!day) return;
        day.stops++;
        const k = s.status === 'COMPLETED' ? 'delivered' : s.status === 'SKIPPED' ? 'skipped' : 'cancelled';
        day[k]++;
        if (s.status === 'COMPLETED' && s.at) day.hours[new Date(s.at).getHours()]++;
        if (s.status !== 'COMPLETED') { const rs = s.reason || 'Motivo não informado'; day.reasons[rs] = (day.reasons[rs] || 0) + 1; }
        if (r.driverId) { const x = drv(day, r.driverId); x.stops++; x[k]++; }
      });
    });
    return out;
  }
  P.history = (days: number) => buildDays(days, false);
  P.todayStats = () => {
    const rs = P.S.routes.filter(P.isToday).filter((r: any) => r.status !== 'CANCELLED');
    const st = rs.flatMap((r: any) => r.stops);
    const c = (k: string) => st.filter((s: any) => s.status === k).length;
    const reasons: any = {}; st.filter((s: any) => s.status === 'SKIPPED' || s.status === 'CANCELLED').forEach((s: any) => { const k = s.reason || 'Motivo não informado'; reasons[k] = (reasons[k] || 0) + 1; });
    const hours = new Array(24).fill(0); st.filter((s: any) => s.status === 'COMPLETED' && s.at).forEach((s: any) => { hours[new Date(s.at).getHours()]++; });
    return { routes: rs.length, stops: st.length, delivered: c('COMPLETED'), skipped: c('SKIPPED'), cancelled: c('CANCELLED'), pending: st.filter((s: any) => !TERMINAL.includes(s.status)).length,
      km: rs.reduce((a: number, r: any) => a + P.routeInfo(r).km, 0), cost: rs.reduce((a: number, r: any) => a + P.routeInfo(r).cost, 0), reasons, hours, live: rs.filter((r: any) => r.status === 'IN_PROGRESS').length, delayed: 0, onTimePct: 100 };
  };
  // "hoje" = rotas ativas ou finalizadas nas últimas 16 h
  P.isToday = (r: any) => !r.finishedAt || (Date.now() - Date.parse(r.finishedAt)) < 16 * 3600000;

  // -------------------------------------------------------------------------
  // Ações (gravam na API; o app do motorista vê na próxima atualização dele)
  // -------------------------------------------------------------------------
  const routeApiId = (rid: any) => { const r = P.route(rid); return r ? r.apiId : rid; };
  const unavailable = () => { P.toast('Recurso ainda não disponível na Orbi API', 'info'); };
  async function run(fn: () => Promise<any>, okMsg?: string) {
    try { await fn(); if (okMsg) P.toast(okMsg, 'check'); muteToasts = true; await P.syncNow(true); muteToasts = false; return true; }
    catch (e: any) { P.toast(e.message || 'Falha ao falar com a API', 'alert'); return false; }
  }
  P.act = Object.assign({}, P.act, {
    assign: (rid: any, did: any) => run(() => request('PATCH', `/route/${routeApiId(rid)}/assign-driver`, { driverId: did }), 'Motorista atribuído · o app recebe na próxima atualização'),
    cancelRoute: (rid: any) => run(() => request('PATCH', `/route/${routeApiId(rid)}/cancel`, {}), 'Rota cancelada'),
    deleteRoute: (rid: any) => run(() => request('DELETE', `/route/${routeApiId(rid)}`), 'Rota excluída'),
    createRouteApi: async (stops: any[], driverId: any) => {
      const body = { driverId: driverId || null, locations: stops.map(s => ({ address: s.address, latitude: s.lat, longitude: s.lng, recipientEmail: s.email || null })) };
      const res = await request('POST', '/route/optimize', body, { retries: 1, timeout: 120000 });
      await P.syncNow(true);
      return res;
    },
    priority: unavailable, clearPriority: unavailable, message: unavailable, comment: unavailable, seeIncident: () => { }, resolveIncident: unavailable,
    createDriver: unavailable, updateVehicle: unavailable, fleetInsurance: () => 0, addManager: unavailable,
    company: (data: any) => { if (data && data.goals) { P.S.company.goals = data.goals; try { localStorage.setItem(GOALS_KEY, JSON.stringify(data.goals)); } catch { /* ignora */ } P.emit(); } },
    readChat: () => { },
    readNotif: (id: any) => { const n = P.S.notifications.find((x: any) => x.id === id); if (n) { n.read = true; saveNotifs(P.S.notifications); P.emit(); } },
    readAllNotifs: () => { P.S.notifications.forEach((n: any) => { n.read = true; }); saveNotifs(P.S.notifications); P.emit(); }
  });
  P.notifs = () => P.S.notifications;

  // cores das paradas no mapa real
  P.STOP_COLORS = { COMPLETED: '#0F9F6E', SKIPPED: '#E59A1A', CANCELLED: '#D64545', IN_TRANSIT: '#2557D6', PENDING: '#667085' };
  P.stopTooltip = (r: any, s: any) => `<b>${esc(r.code)} · #${String(s.order).padStart(2, '0')}</b><br>${esc(s.street)}<br>${STOP_STATUS[s.status][0]}${s.reason ? ' · ' + esc(s.reason) : ''}${s.at ? ' · ' + hhmm(s.at) : ''}`;
}
