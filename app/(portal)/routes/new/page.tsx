'use client';
/*
 * Nova rota.
 *   Modo API: endereços reais (busca no OpenStreetMap ou clique no mapa) -> POST /api/route/optimize.
 *   Modo demonstração: catálogo de endereços da cidade fictícia e otimização simulada no navegador.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageFrame from '@/components/Shell';
import { Icon } from '@/components/Icon';
import { Empty } from '@/components/common';
import GeoMap from '@/components/maps/GeoMap';
import { RouteSvg } from '@/components/maps/LiveMap';
import { useOrbi } from '@/lib/orbi/useOrbi';
import { confirmDialog, toast } from '@/lib/orbi/ui';
import { num, plural, fmtMin, uid, initials } from '@/lib/orbi/format';

const PATH = [{ href: '/routes', label: 'Rotas' }];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function NewRoutePage() {
  const P = useOrbi();
  return P.API ? <NewRouteApi P={P} /> : <NewRouteDemo P={P} />;
}

function DriverPicker({ P, value, onPick, sub }: { P: any; value: any; onPick: (id: any) => void; sub: (d: any) => string }) {
  return (
    <div className="pick-list">
      {P.drivers().map((d: any) => { const st = P.driverState(d); return (
        <button key={d.id} className={`pick ${value === d.id ? 'on' : ''}`} onClick={() => onPick(d.id)}><span className="avatar">{initials(d.name)}</span><span><b>{d.name}</b><small>{sub(d)}</small></span><span className={`badge ${st[1]}`}>{st[0]}</span></button>
      ); })}
      <button className={`pick ${!value ? 'on' : ''}`} onClick={() => onPick(null)}><span className="avatar">?</span><span><b>Atribuir depois</b><small>A rota fica “Sem motorista”</small></span></button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modo API
// ---------------------------------------------------------------------------
type ApiDraft = { stops: { address: string; lat: number; lng: number; email: string }[]; driverId: any; chosen: { lat: number; lng: number } | null; label: string; email: string };
const newApiDraft = (): ApiDraft => ({ stops: [], driverId: null, chosen: null, label: '', email: '' });
// rascunhos sobrevivem à troca de página (como no portal original)
const drafts: { api: ApiDraft; demo: DemoDraft | null } = { api: newApiDraft(), demo: null };

function NewRouteApi({ P }: { P: any }) {
  const router = useRouter();
  const [draft, setDraftState] = useState<ApiDraft>(() => drafts.api);
  const setDraft = (patch: Partial<ApiDraft>) => setDraftState(d => ({ ...d, ...patch }));
  useEffect(() => { drafts.api = draft; }, [draft]);
  const [err, setErr] = useState('');
  const [sug, setSug] = useState<any[] | 'loading' | 'none' | 'fail' | null>(null);
  const [creating, setCreating] = useState(false);
  const mapRef = useRef<{ map: any; L: any; temp: any } | null>(null);
  const n = draft.stops.length;
  const est = n ? 1 + n * 3 : 0;
  const pseudo = { id: 'novo', code: 'Nova rota', status: 'CREATED', stops: draft.stops.map((s, i) => ({ id: 'n' + i, order: i + 1, lat: s.lat, lng: s.lng, street: s.address, status: 'PENDING' })) };

  const drawTemp = (c: { lat: number; lng: number } | null) => {
    const m = mapRef.current; if (!m) return;
    if (m.temp) { m.temp.remove(); m.temp = null; }
    if (c) m.temp = m.L.circleMarker([c.lat, c.lng], { radius: 9, color: '#2557D6', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(m.map);
  };
  const mark = (lat: number, lng: number, label?: string) => {
    const c = { lat, lng };
    setDraft({ chosen: c, label: label != null ? label : drafts.api.label || `Ponto ${lat.toFixed(5)}, ${lng.toFixed(5)}` }); setErr(''); drawTemp(c);
  };
  // busca de endereço no OpenStreetMap (Nominatim): gratuita, uma consulta por clique
  const find = async () => {
    const q = draft.label.trim(); if (q.length < 4) { setErr('Digite um endereço mais completo.'); return; }
    setSug('loading');
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&q=' + encodeURIComponent(q));
      const data = await res.json();
      setSug(data.length ? data : 'none');
    } catch { setSug('fail'); }
  };
  const add = () => {
    if (!draft.chosen) { setErr('Marque o ponto: busque o endereço ou clique no mapa.'); return; }
    if (!draft.label.trim()) { setErr('Informe o endereço.'); return; }
    const email = draft.email.trim();
    if (email && !EMAIL.test(email)) { setErr('E-mail inválido.'); return; }
    setDraft({ stops: draft.stops.concat([{ address: draft.label.trim(), lat: draft.chosen.lat, lng: draft.chosen.lng, email }]), chosen: null, label: '', email: '' });
    drawTemp(null); setErr('');
  };
  const move = (i: number) => { const s = draft.stops.slice(); [s[i - 1], s[i]] = [s[i], s[i - 1]]; setDraft({ stops: s }); };
  const create = () => confirmDialog('Criar rota na Orbi API?', `A API vai otimizar ${n} paradas usando o OpenRouteService (consome a cota gratuita, estimativa de até ~${est} chamadas). A rota aparece no app do motorista na próxima atualização.`, 'Criar rota', false, async () => {
    setCreating(true);
    const before = new Set(P.S.routes.map((r: any) => r.id));
    try {
      await P.act.createRouteApi(draft.stops, draft.driverId);
      const created = P.S.routes.find((r: any) => !before.has(r.id));
      setDraftState(newApiDraft());
      toast(`Rota ${created ? created.code : ''} criada na Orbi API`, 'check');
      router.push(created ? '/routes/' + created.id : '/routes');
    } catch (e: any) { toast(e.message || 'Não foi possível criar a rota', 'alert'); setCreating(false); }
  });

  return (
    <PageFrame active="routes" title="Nova rota" path={PATH}>
      <div className="grid g-1-1 new-route">
        <section className="card"><div className="card-head"><h3>1. Paradas</h3><span className="muted small">{plural(n, 'parada', 'paradas')}</span></div>
          <p className="muted small" style={{ marginTop: 0 }}>Busque o endereço <b>ou clique no mapa</b> para marcar o ponto. A primeira parada é o ponto de saída.</p>
          <label className="lbl" htmlFor="addr">Endereço</label>
          <div className="row" style={{ gap: 8 }}>
            <div className="input grow"><Icon name="search" size="sm" /><input id="addr" value={draft.label} placeholder="Ex.: Av. Francisco Glicério, 900, Campinas" onChange={e => setDraft({ label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find(); } }} /></div>
            <button className="btn ghost" type="button" onClick={find}>Buscar</button>
          </div>
          <div className="sug">{sug === 'loading' ? <p className="muted small" style={{ padding: 10 }}><Icon name="refresh" size="xs spin" /> Buscando…</p>
            : sug === 'none' ? <p className="muted small" style={{ padding: 10 }}>Nada encontrado. Tente outro texto ou clique no mapa.</p>
              : sug === 'fail' ? <p className="muted small" style={{ padding: 10 }}>Busca indisponível agora. Clique no mapa para marcar o ponto.</p>
                : sug ? <>{sug.map((x: any, i: number) => (
                  <button key={i} onClick={() => { const label = x.display_name.split(',').slice(0, 4).join(','); mark(+x.lat, +x.lon, label); if (mapRef.current) mapRef.current.map.setView([+x.lat, +x.lon], 16); setSug(null); }}>
                    <Icon name="pin" size="sm" /><span>{x.display_name.split(',').slice(0, 3).join(',')}<small>{x.display_name.split(',').slice(3, 6).join(',')}</small></span></button>
                ))}<p className="muted small" style={{ padding: '6px 12px', margin: 0 }}>Busca: © OpenStreetMap / Nominatim</p></> : null}</div>
          <div className="form-2">
            <div><label className="lbl" htmlFor="em">E-mail do destinatário (opcional)</label><div className="input"><input id="em" type="email" placeholder="cliente@exemplo.com" value={draft.email} onChange={e => setDraft({ email: e.target.value })} /></div></div>
            <div><label className="lbl">Ponto no mapa</label><div className="input"><input readOnly value={draft.chosen ? `${draft.chosen.lat.toFixed(5)}, ${draft.chosen.lng.toFixed(5)}` : ''} placeholder="Busque ou clique no mapa" /></div></div>
          </div>
          <div className="form-err">{err}</div>
          <button className="btn ghost" type="button" onClick={add}><Icon name="plus" size="sm" /> Adicionar parada</button>
          <div className="stop-list">{n ? draft.stops.map((s, i) => (
            <div key={i} className="sl"><span className="sl-n">{i + 1}</span><span className="sl-main"><b>{s.address}</b><small>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}{s.email ? ' · ' + s.email : ''}</small></span>
              <button className="icon-btn sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i)}>▲</button>
              <button className="icon-btn sm" aria-label="Remover" onClick={() => setDraft({ stops: draft.stops.filter((_, k) => k !== i) })}><Icon name="trash" size="sm" /></button></div>
          )) : <p className="muted small">Adicione pelo menos 2 paradas.</p>}</div>
        </section>
        <div className="stack">
          <section className="card pad0"><div className="card-head pad"><h3>Mapa</h3><span className="muted small">{n > 1 ? '≈ ' + num(P.geoKm(pseudo.stops), 1) + ' km' : 'clique para marcar um ponto'}</span></div>
            <GeoMap P={P} routes={[pseudo]} scrollZoom onReady={(map, L) => {
              mapRef.current = { map, L, temp: null };
              if (drafts.api.chosen) drawTemp(drafts.api.chosen);
              map.on('click', (e: any) => mark(e.latlng.lat, e.latlng.lng, drafts.api.label.trim() ? drafts.api.label : undefined));
            }} /></section>
          <section className="card"><div className="card-head"><h3>2. Motorista</h3></div>
            <DriverPicker P={P} value={draft.driverId} onPick={id => setDraft({ driverId: id })} sub={d => d.phone || d.email || ''} />
            <div className="callout amber"><Icon name="info" size="sm" /><span>Ao criar, a Orbi API <b>otimiza a ordem</b> das paradas usando o <b>OpenRouteService</b>, que tem cota gratuita{n ? ` (estimativa: até ~${est} chamadas para ${n} paradas)` : ''}.</span></div>
            <button className="btn success block lg" disabled={n < 2 || creating} onClick={create}>{creating ? <><Icon name="refresh" size="sm spin" /> Criando e otimizando…</> : <><Icon name="check" size="sm" /> Criar rota na Orbi API</>}</button>
          </section>
        </div>
      </div>
    </PageFrame>
  );
}

// ---------------------------------------------------------------------------
// Modo demonstração
// ---------------------------------------------------------------------------
type DemoDraft = { stops: any[]; optimized: any[] | null; before: number; after: number; driverId: any; window: string };
const newDemoDraft = (): DemoDraft => ({ stops: [], optimized: null, before: 0, after: 0, driverId: null, window: '08:00 – 12:00' });
const WINDOWS = ['08:00 – 12:00', '13:00 – 17:00', '14:00 – 18:00', '18:00 – 21:00'];

function NewRouteDemo({ P }: { P: any }) {
  const router = useRouter();
  const { D, M } = P;
  const [draft, setDraftState] = useState<DemoDraft>(() => drafts.demo || newDemoDraft());
  const setDraft = (patch: Partial<DemoDraft>) => setDraftState(d => ({ ...d, ...patch }));
  useEffect(() => { drafts.demo = draft; }, [draft]);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<any>(null);
  const [form, setForm] = useState({ rn: '', rp: '', pk: '', pw: '' });
  const [err, setErr] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const list = draft.optimized || draft.stops;
  const used = new Set(draft.stops.map(s => s.x + ',' + s.y));
  const t = q.trim().toLowerCase();
  const sug = chosen || !t ? [] : D.ADDRESS_BOOK.filter((a: any) => !used.has(a.x + ',' + a.y) && (a.street + ' ' + a.number + ' ' + a.district).toLowerCase().includes(t)).slice(0, 6);
  const mk = (a: any, name: string, phone: string, pk: string, w: number) => ({ id: uid('s'), recipient: name, phone: phone || '(11) 90000-0000', street: a.street, number: a.number, district: a.district, city: a.city, x: a.x, y: a.y, status: 'PENDING', reason: null, at: null, proof: null, packages: [{ desc: pk || 'Pacote', weight: w || 1 }] });

  const add = () => {
    if (!chosen) { setErr('Escolha um endereço da lista de sugestões.'); return; }
    if (!form.rn.trim()) { setErr('Informe o destinatário.'); return; }
    setDraft({ stops: draft.stops.concat([mk(chosen, form.rn.trim(), form.rp.trim(), form.pk.trim(), parseFloat((form.pw || '1').replace(',', '.')) || 1)]), optimized: null });
    setChosen(null); setQ(''); setForm({ rn: '', rp: '', pk: '', pw: '' }); setErr('');
  };
  const examples = () => {
    const extra = D.ADDRESS_BOOK.filter((a: any) => !used.has(a.x + ',' + a.y)).sort(() => Math.random() - 0.5).slice(0, 5)
      .map((a: any, i: number) => { const rc = D.RECIPIENTS[(i * 5 + draft.stops.length) % D.RECIPIENTS.length]; const pk = D.PACKAGES[(i + draft.stops.length) % D.PACKAGES.length]; return mk(a, rc[0], rc[1], pk[0], pk[1]); });
    setDraft({ stops: draft.stops.concat(extra), optimized: null });
  };
  const optimize = () => {
    setOptimizing(true);
    setTimeout(() => {
      const before = M.totalDistance(D.DEPOT, draft.stops); const optimized = M.optimize(D.DEPOT, draft.stops);
      setDraft({ before, optimized, after: M.totalDistance(D.DEPOT, optimized) }); setOptimizing(false); toast('Ordem otimizada', 'sparkle');
    }, 800);
  };
  const create = () => {
    const r = P.act.createRoute(draft.optimized || draft.stops, draft.driverId, draft.window);
    setDraftState(newDemoDraft());
    toast(`Rota ${r.code} criada${r.driverId ? ' · já aparece no app do motorista' : ''}`, 'check');
    router.push('/routes/' + r.id);
  };
  const km = (u: number) => num(M.unitsToKm(u), 1) + ' km';

  return (
    <PageFrame active="routes" title="Nova rota" path={PATH}>
      <div className="grid g-1-1 new-route">
        <section className="card"><div className="card-head"><h3>1. Paradas</h3><button className="link" onClick={examples}><Icon name="sparkle" size="xs" /> Usar exemplos</button></div>
          <label className="lbl">Endereço</label>
          <div className="input"><Icon name="search" size="sm" /><input value={q} placeholder="Buscar rua ou bairro do catálogo" autoComplete="off" onChange={e => { setQ(e.target.value); setChosen(null); }} /></div>
          <div className="sug">{t && !chosen && (sug.length ? sug.map((a: any) => (
            <button key={a.id} onClick={() => { setChosen(a); setQ(`${a.street}, ${a.number} · ${a.district}`); }}><Icon name="pin" size="sm" /><span>{a.street}, {a.number}<small>{a.district}</small></span></button>
          )) : <p className="muted small" style={{ padding: 10 }}>Nenhum endereço no catálogo.</p>)}</div>
          <div className="form-2">
            <div><label className="lbl">Destinatário</label><div className="input"><input placeholder="Nome ou empresa" value={form.rn} onChange={e => setForm({ ...form, rn: e.target.value })} /></div></div>
            <div><label className="lbl">Telefone</label><div className="input"><input placeholder="(11) 9...." inputMode="tel" value={form.rp} onChange={e => setForm({ ...form, rp: e.target.value })} /></div></div>
          </div>
          <div className="form-2">
            <div><label className="lbl">Pacote</label><div className="input"><input placeholder="Ex.: caixa média" value={form.pk} onChange={e => setForm({ ...form, pk: e.target.value })} /></div></div>
            <div><label className="lbl">Peso (kg)</label><div className="input"><input placeholder="1,5" inputMode="decimal" value={form.pw} onChange={e => setForm({ ...form, pw: e.target.value })} /></div></div>
          </div>
          <div className="form-err">{err}</div>
          <button className="btn ghost" onClick={add}><Icon name="plus" size="sm" /> Adicionar parada</button>
          <div className="stop-list">{list.length ? list.map((s, i) => (
            <div key={s.id} className="sl"><span className="sl-n">{i + 1}</span><span className="sl-main"><b>{P.stopAddr(s)}</b><small>{s.district} · {s.recipient} · {s.packages[0].desc}</small></span>
              {!draft.optimized && <button className="icon-btn sm" aria-label="Subir" disabled={i === 0} onClick={() => { const st = draft.stops.slice(); [st[i - 1], st[i]] = [st[i], st[i - 1]]; setDraft({ stops: st }); }}>▲</button>}
              <button className="icon-btn sm" aria-label="Remover" onClick={() => setDraft({ stops: draft.stops.filter(x => x !== s), optimized: null })}><Icon name="trash" size="sm" /></button></div>
          )) : <p className="muted small">Adicione pelo menos 2 paradas.</p>}</div>
        </section>
        <div className="stack">
          <section className="card pad0"><div className="card-head pad"><h3>2. Otimização</h3>{list.length > 0 && <span className="muted small">{list.length} paradas · {km(M.totalDistance(D.DEPOT, list))}</span>}</div>
            {list.length ? <RouteSvg P={P} route={{ stops: list }} /> : <div className="map-host"><Empty icon="pin" title="Mapa da rota" text="As paradas aparecem aqui." /></div>}
            <div className="pad">
              {draft.optimized && <div className="compare"><div><span>Ordem original</span><b>{km(draft.before)}</b></div><div className="better"><span>Otimizada</span><b>{km(draft.after)}</b><small>−{Math.max(0, Math.round((1 - draft.after / draft.before) * 100))}% · ~{fmtMin(M.unitsToMin(draft.after))}</small></div></div>}
              <button className="btn primary block" disabled={draft.stops.length < 2 || optimizing} onClick={optimize}>{optimizing ? <><Icon name="refresh" size="sm spin" /> Otimizando…</> : <><Icon name="sparkle" size="sm" /> {draft.optimized ? 'Otimizar de novo' : 'Otimizar ordem das paradas'}</>}</button>
              <p className="muted small" style={{ margin: '8px 0 0' }}>Simulação local. No sistema real: <code>POST /api/route/optimize</code> (OpenRouteService). Nenhuma requisição é feita aqui.</p>
            </div></section>
          <section className="card"><div className="card-head"><h3>3. Motorista e janela</h3></div>
            <div className="chips wrap">{WINDOWS.map(w => <button key={w} className={`chip ${draft.window === w ? 'on' : ''}`} onClick={() => setDraft({ window: w })}>{w}</button>)}</div>
            <DriverPicker P={P} value={draft.driverId} onPick={id => setDraft({ driverId: id })} sub={d => d.vehicle} />
            <button className="btn success block lg" style={{ marginTop: 14 }} disabled={draft.stops.length < 2} onClick={create}><Icon name="check" size="sm" /> Criar rota</button>
          </section>
        </div>
      </div>
    </PageFrame>
  );
}
