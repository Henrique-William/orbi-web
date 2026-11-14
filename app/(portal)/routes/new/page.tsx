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
type ApiDraft = {
  stops: { address: string; lat: number; lng: number; email: string }[];
  driverId: any;
  chosen: { lat: number; lng: number } | null;
  cep: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  email: string;
};

type FormErrors = {
  search?: string;
  cep?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  chosen?: string;
  email?: string;
};

const newApiDraft = (): ApiDraft => ({
  stops: [],
  driverId: null,
  chosen: null,
  cep: '',
  street: '',
  number: '',
  district: '',
  city: '',
  state: '',
  email: '',
});

// rascunhos sobrevivem à troca de página (como no portal original)
const drafts: { api: ApiDraft; demo: DemoDraft | null } = { api: newApiDraft(), demo: null };

// Extrai com precisão o número predial do endereço digitado pelo usuário
function extractHouseNumber(query: string): string {
  if (!query) return '';
  // Remove CEPs para não confundir com número do imóvel
  let text = query.replace(/\b\d{5}-?\d{3}\b/g, '');
  // 1. Procura termos explícitos: 'nº 123', 'n. 123', 'num 123', 'número 123'
  const explicit = text.match(/\b(?:n[ºo°.]?|num(?:ero)?)\s*(\d+[a-zA-Z]?)\b/i);
  if (explicit) return explicit[1];
  // 2. Número logo após vírgula: ex: 'Rua 25 de Março, 500' -> 500
  const afterComma = text.match(/,\s*(\d+[a-zA-Z]?)\b/);
  if (afterComma) return afterComma[1];
  // 3. Remove nomes comuns de ruas que contêm números de datas ('25 de março', '7 de setembro', '15 de novembro', etc.)
  text = text.replace(/\b\d+\s+de\s+[a-zA-ZçÇãÃõÕáÁéÉíÍóÓúÚ]+/gi, '');
  // 4. Captura o primeiro número isolado restante (1 a 5 dígitos)
  const isolated = text.match(/\b(\d{1,5}[a-zA-Z]?)\b/);
  return isolated ? isolated[1] : '';
}

function NewRouteApi({ P }: { P: any }) {
  const router = useRouter();
  const [draft, setDraftState] = useState<ApiDraft>(() => ({ ...newApiDraft(), ...(drafts.api || {}) }));
  const setDraft = (patch: Partial<ApiDraft> | ((prev: ApiDraft) => ApiDraft)) =>
    setDraftState(d => {
      const updated = typeof patch === 'function' ? patch(d) : { ...d, ...patch };
      drafts.api = updated;
      return updated;
    });

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const mapRef = useRef<{ map: any; L: any; temp?: any } | null>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const n = draft.stops.length;
  const est = n ? 1 + n * 3 : 0;
  const pseudo = {
    id: 'novo',
    code: 'Nova rota',
    status: 'CREATED',
    stops: draft.stops.map((s, i) => ({
      id: 'n' + i,
      order: i + 1,
      lat: s.lat,
      lng: s.lng,
      street: s.address,
      status: 'PENDING'
    }))
  };

  const centerMap = (lat: number, lng: number, zoom = 16) => {
    const m = mapRef.current?.map;
    if (!m) return;
    if (typeof m.setCenter === 'function') {
      m.setCenter({ lat, lng });
      if (typeof m.setZoom === 'function') m.setZoom(zoom);
    } else if (typeof m.setView === 'function') {
      m.setView([lat, lng], zoom);
    }
  };

  const drawTemp = (c: { lat: number; lng: number } | null) => {
    if (c) centerMap(c.lat, c.lng);
  };

  // Limpa apenas pelo botão Clear principal
  const clearAll = () => {
    setSearchQuery('');
    setDraft({
      cep: '',
      street: '',
      number: '',
      district: '',
      city: '',
      state: '',
      email: '',
      chosen: null
    });
    setErrors({});
    setSuggestions(null);
    drawTemp(null);
  };

  const applyGoogleSuggestion = (item: any, originalQuery?: string) => {
    const extractedNum = extractHouseNumber(originalQuery || '');
    const houseNumber = item.number || extractedNum || '';
    const c = { lat: Number(item.lat), lng: Number(item.lng) };

    setDraft(prev => ({
      ...prev,
      street: item.street || prev.street,
      number: houseNumber || prev.number,
      district: item.district || prev.district,
      city: item.city || prev.city,
      state: (item.state || prev.state || '').toUpperCase(),
      cep: item.cep || prev.cep,
      chosen: c
    }));

    setErrors(prev => ({
      ...prev,
      search: undefined,
      street: item.street ? undefined : prev.street,
      number: houseNumber ? undefined : prev.number,
      district: item.district ? undefined : prev.district,
      city: item.city ? undefined : prev.city,
      state: item.state ? undefined : prev.state,
      chosen: undefined
    }));

    drawTemp(c);
    centerMap(c.lat, c.lng, 18);
    setSuggestions(null);
    if (!houseNumber) {
      setTimeout(() => numberInputRef.current?.focus(), 100);
    }
  };

  // Handle inteligente: busca por CEP ou por Endereço Completo via Google Maps Geocoding API
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setErrors(prev => ({ ...prev, search: 'Digite um CEP ou endereço completo para buscar.' }));
      return;
    }

    setSearching(true);
    setErrors(prev => ({ ...prev, search: undefined }));
    setSuggestions(null);

    try {
      const gRes = await fetch(`/geocode?q=${encodeURIComponent(q)}`);
      const gData = await gRes.json();

      if (!gData || !gData.configured) {
        setErrors(prev => ({
          ...prev,
          search: 'Chave GOOGLE_API_KEY não configurada no .env. Reinicie o servidor após configurar.'
        }));
        setSearching(false);
        return;
      }

      if (!gData.success) {
        setErrors(prev => ({
          ...prev,
          search: gData.errorMessage || 'Endereço ou CEP não encontrado no Google Maps.'
        }));
        setSearching(false);
        return;
      }

      const digits = q.replace(/\D/g, '');
      const isCepOnly = digits.length === 8 && (q.length <= 10 || /^\d{5}-?\d{3}$/.test(q));
      const extractedNum = isCepOnly ? '' : extractHouseNumber(q);
      const num = gData.number || extractedNum || '';
      const c = { lat: Number(gData.lat), lng: Number(gData.lng) };

      setDraft(prev => ({
        ...prev,
        street: gData.street || prev.street,
        number: num,
        district: gData.district || prev.district,
        city: gData.city || prev.city,
        state: (gData.state || prev.state || '').toUpperCase(),
        cep: gData.cep || prev.cep,
        chosen: c
      }));

      setErrors(prev => ({
        ...prev,
        search: undefined,
        street: gData.street ? undefined : prev.street,
        number: num ? undefined : prev.number,
        district: gData.district ? undefined : prev.district,
        city: gData.city ? undefined : prev.city,
        state: gData.state ? undefined : prev.state,
        chosen: undefined
      }));

      drawTemp(c);
      centerMap(c.lat, c.lng, 18);

      if (gData.allResults && gData.allResults.length > 1) {
        setSuggestions(gData.allResults);
      }

      if (!num) {
        setTimeout(() => numberInputRef.current?.focus(), 100);
      }
    } catch {
      setErrors(prev => ({ ...prev, search: 'Erro ao consultar o Google Maps. Verifique sua conexão.' }));
    } finally {
      setSearching(false);
    }
  };

  // Clique no mapa: define o ponto e faz Reverse Geocoding no Google Maps
  const mark = async (lat: number, lng: number) => {
    const c = { lat, lng };
    setDraft(prev => ({ ...prev, chosen: c }));
    setErrors(prev => ({ ...prev, chosen: undefined }));
    drawTemp(c);

    try {
      const res = await fetch(`/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data && data.success) {
        setDraft(prev => ({
          ...prev,
          chosen: c,
          street: data.street || prev.street,
          number: data.number || prev.number,
          district: data.district || prev.district,
          city: data.city || prev.city,
          state: (data.state || prev.state || '').toUpperCase(),
          cep: data.cep || prev.cep
        }));
      }
    } catch {
      // ignora
    }
  };

  // Localiza no Google Maps usando os campos preenchidos atualmente (inclusive após digitar o número)
  const locateAddress = async (overrideNumber?: string) => {
    const street = draft.street.trim();
    const numVal = (overrideNumber !== undefined ? overrideNumber : draft.number).trim();
    const district = draft.district.trim();
    const city = draft.city.trim();
    const state = draft.state.trim();
    const cep = draft.cep.trim();

    if (!street || !city) {
      setErrors(prev => ({ ...prev, chosen: 'Preencha ao menos Rua e Cidade para localizar.' }));
      return null;
    }

    setLocating(true);
    setErrors(prev => ({ ...prev, chosen: undefined }));

    const query = [
      street + (numVal ? `, ${numVal}` : ''),
      district,
      `${city}${state ? ' - ' + state : ''}`,
      cep,
      'Brasil'
    ]
      .filter(Boolean)
      .join(', ');

    try {
      const gRes = await fetch(`/geocode?q=${encodeURIComponent(query)}`);
      const gData = await gRes.json();
      if (gData && gData.configured && gData.success) {
        const c = { lat: Number(gData.lat), lng: Number(gData.lng) };
        setDraft(prev => ({
          ...prev,
          chosen: c,
          cep: prev.cep || gData.cep || ''
        }));
        drawTemp(c);
        centerMap(c.lat, c.lng, 18);
        return c;
      } else {
        setErrors(prev => ({ ...prev, chosen: 'Não localizado automaticamente. Clique no mapa.' }));
      }
    } catch {
      setErrors(prev => ({ ...prev, chosen: 'Falha ao localizar no Google Maps. Clique no mapa.' }));
    } finally {
      setLocating(false);
    }
    return null;
  };

  const add = async () => {
    const street = draft.street.trim();
    const number = draft.number.trim();
    const district = draft.district.trim();
    const city = draft.city.trim();
    const state = draft.state.trim().toUpperCase();
    const cep = draft.cep.trim();
    const email = draft.email.trim();

    const newErrors: FormErrors = {};
    if (!street) newErrors.street = 'Informe a rua / logradouro.';
    if (!number) newErrors.number = 'Informe o número (ou S/N).';
    if (!district) newErrors.district = 'Informe o bairro.';
    if (!city) newErrors.city = 'Informe a cidade.';
    if (!state) newErrors.state = 'Informe a UF.';
    if (email && !EMAIL.test(email)) newErrors.email = 'E-mail do destinatário inválido.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Garante que as coordenadas reflitam o endereço completo com o número predial no Google Maps
    let chosen = draft.chosen;
    const fullQuery = [
      `${street}, ${number}`,
      district,
      `${city} - ${state}`,
      cep,
      'Brasil'
    ]
      .filter(Boolean)
      .join(', ');

    try {
      const gRes = await fetch(`/geocode?q=${encodeURIComponent(fullQuery)}`);
      const gData = await gRes.json();
      if (gData && gData.configured && gData.success) {
        chosen = { lat: Number(gData.lat), lng: Number(gData.lng) };
      }
    } catch {
      // mantém chosen caso já definido pelo clique no mapa
    }

    if (!chosen) {
      setErrors({ chosen: 'Ponto no mapa não definido. Clique no mapa.' });
      return;
    }

    // Endereço completo formatado com precisão: Rua, Número, Bairro, Cidade - UF (e CEP se preenchido)
    const fullAddress = [
      `${street}, ${number}`,
      district,
      `${city} - ${state}`,
      cep ? `CEP ${cep}` : ''
    ].filter(Boolean).join(', ');

    setDraft(prev => ({
      ...prev,
      stops: prev.stops.concat([{
        address: fullAddress,
        lat: chosen!.lat,
        lng: chosen!.lng,
        email
      }]),
      chosen: null,
      cep: '',
      street: '',
      number: '',
      district: '',
      city: '',
      state: '',
      email: ''
    }));
    setSearchQuery('');
    setErrors({});
    setSuggestions(null);
    drawTemp(null);
  };

  const move = (i: number) => {
    const s = draft.stops.slice();
    [s[i - 1], s[i]] = [s[i], s[i - 1]];
    setDraft({ stops: s });
  };

  const create = () => confirmDialog('Criar rota na Orbi API?', `A API vai otimizar ${n} paradas usando o OpenRouteService (consome a cota gratuita, estimativa de até ~${est} chamadas). A rota aparece no app do motorista na próxima atualização.`, 'Criar rota', false, async () => {
    setCreating(true);
    const before = new Set(P.S.routes.map((r: any) => r.id));
    try {
      await P.act.createRouteApi(draft.stops, draft.driverId);
      const created = P.S.routes.find((r: any) => !before.has(r.id));
      const clean = newApiDraft();
      drafts.api = clean;
      setDraftState(clean);
      setSearchQuery('');
      setErrors({});
      setSuggestions(null);
      drawTemp(null);
      toast(`Rota ${created ? created.code : ''} criada na Orbi API`, 'check');
      router.push(created ? '/routes/' + created.id : '/routes');
    } catch (e: any) {
      toast(e.message || 'Não foi possível criar a rota', 'alert');
      setCreating(false);
    }
  });

  return (
    <PageFrame active="routes" title="Nova rota" path={PATH}>
      <div className="grid g-1-1 new-route">
        <section className="card">
          <div className="card-head">
            <h3>1. Paradas</h3>
            <span className="muted small">{plural(n, 'parada', 'paradas')}</span>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            Busque por <b>CEP</b> ou <b>endereço completo</b> para preencher todos os campos automaticamente. A primeira parada é o ponto de saída.
          </p>

          {/* Campo principal de busca (CEP ou Endereço Completo) com Buscar e Limpar */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label className="lbl" htmlFor="mainSearch" style={{ marginTop: 0 }}>
              Buscar por CEP ou Endereço Completo
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8, alignItems: 'center' }}>
              <div className={`input ${errors.search ? 'err' : ''}`}>
                <Icon name="search" size="sm" />
                <input
                  id="mainSearch"
                  placeholder="Ex.: 13010-001 ou Av. Paulista, 1000, São Paulo"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (errors.search) setErrors(prev => ({ ...prev, search: undefined }));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>
              <button className="btn primary" type="button" onClick={handleSearch} disabled={searching}>
                {searching ? <><Icon name="refresh" size="xs spin" /> Buscando…</> : <><Icon name="search" size="sm" /> Buscar</>}
              </button>
              <button className="btn ghost" type="button" onClick={clearAll} title="Limpar busca e todos os campos">
                <Icon name="close" size="sm" /> Limpar
              </button>
            </div>
            {/* Espaço reservado para erro da busca */}
            <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px' }}>
              {errors.search || ''}
            </div>

            {/* Sugestões do Google Maps quando múltiplos endereços retornarem */}
            {suggestions && suggestions.length > 0 && (
              <div className="sug" style={{ marginTop: 2, marginBottom: 8 }}>
                {suggestions.map((item: any, i: number) => (
                  <button key={i} type="button" onClick={() => applyGoogleSuggestion(item, searchQuery)}>
                    <Icon name="pin" size="sm" />
                    <span>
                      {item.formattedAddress || `${item.street || ''}, ${item.number || ''}`}
                      <small>{[item.district, item.city, item.state].filter(Boolean).join(' · ')}</small>
                    </span>
                  </button>
                ))}
                <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted small">Clique para selecionar uma sugestão</span>
                  <button type="button" className="link small" style={{ fontSize: 11, border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setSuggestions(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>

          {/* Rua e Número */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="street" style={{ marginTop: 6 }}>Rua / Logradouro *</label>
              <div className={`input ${errors.street ? 'err' : ''}`}>
                <input
                  id="street"
                  placeholder="Ex.: Av. Francisco Glicério"
                  value={draft.street}
                  onChange={e => {
                    setDraft({ street: e.target.value });
                    if (errors.street) setErrors(prev => ({ ...prev, street: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.street || ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="number" style={{ marginTop: 6 }}>Número *</label>
              <div className={`input ${errors.number ? 'err' : ''}`}>
                <input
                  ref={numberInputRef}
                  id="number"
                  placeholder="Ex.: 900"
                  value={draft.number}
                  onChange={e => {
                    setDraft({ number: e.target.value });
                    if (errors.number) setErrors(prev => ({ ...prev, number: undefined }));
                  }}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val && draft.street.trim() && draft.city.trim()) {
                      locateAddress(val);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && draft.street.trim() && draft.city.trim()) {
                        locateAddress(val);
                      }
                    }
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.number || ''}
              </div>
            </div>
          </div>

          {/* Bairro, Cidade e UF */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 85px', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="district" style={{ marginTop: 2 }}>Bairro *</label>
              <div className={`input ${errors.district ? 'err' : ''}`}>
                <input
                  id="district"
                  placeholder="Ex.: Centro"
                  value={draft.district}
                  onChange={e => {
                    setDraft({ district: e.target.value });
                    if (errors.district) setErrors(prev => ({ ...prev, district: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.district || ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="city" style={{ marginTop: 2 }}>Cidade *</label>
              <div className={`input ${errors.city ? 'err' : ''}`}>
                <input
                  id="city"
                  placeholder="Ex.: Campinas"
                  value={draft.city}
                  onChange={e => {
                    setDraft({ city: e.target.value });
                    if (errors.city) setErrors(prev => ({ ...prev, city: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.city || ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="state" style={{ marginTop: 2 }}>UF *</label>
              <div className={`input ${errors.state ? 'err' : ''}`}>
                <input
                  id="state"
                  placeholder="SP"
                  maxLength={2}
                  style={{ textTransform: 'uppercase' }}
                  value={draft.state}
                  onChange={e => {
                    setDraft({ state: e.target.value.toUpperCase() });
                    if (errors.state) setErrors(prev => ({ ...prev, state: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.state || ''}
              </div>
            </div>
          </div>

          {/* CEP e E-mail */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="detailCep" style={{ marginTop: 2 }}>CEP</label>
              <div className={`input ${errors.cep ? 'err' : ''}`}>
                <input
                  id="detailCep"
                  placeholder="00000-000"
                  maxLength={9}
                  value={draft.cep}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length > 8) v = v.slice(0, 8);
                    if (v.length > 5) v = v.replace(/^(\d{5})(\d{1,3})$/, '$1-$2');
                    setDraft({ cep: v });
                    if (errors.cep) setErrors(prev => ({ ...prev, cep: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px' }}>
                {errors.cep || ''}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="lbl" htmlFor="em" style={{ marginTop: 2 }}>E-mail do destinatário (opcional)</label>
              <div className={`input ${errors.email ? 'err' : ''}`}>
                <input
                  id="em"
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={draft.email}
                  onChange={e => {
                    setDraft({ email: e.target.value });
                    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                  }}
                />
              </div>
              <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {errors.email || ''}
              </div>
            </div>
          </div>

          {/* Ponto no mapa com botão Localizar */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="row between" style={{ margin: '2px 0 6px' }}>
              <label className="lbl" style={{ margin: 0 }}>Ponto no mapa *</label>
              <button
                type="button"
                className="link"
                style={{ fontSize: 12, border: 0, background: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => locateAddress()}
                disabled={locating}
              >
                {locating ? 'Localizando…' : 'Localizar no mapa'}
              </button>
            </div>
            <div className={`input ${errors.chosen ? 'err' : ''}`}>
              <Icon name="pin" size="sm" />
              <input
                readOnly
                value={draft.chosen ? `${draft.chosen.lat.toFixed(5)}, ${draft.chosen.lng.toFixed(5)}` : ''}
                placeholder="Clique no mapa ou em Localizar"
              />
            </div>
            <div style={{ minHeight: 18, marginTop: 4, fontSize: 11.5, color: 'var(--red)', lineHeight: '16px' }}>
              {errors.chosen || ''}
            </div>
          </div>

          {/* Botão de Adicionar parada (sem botão de Limpar aqui embaixo) */}
          <div style={{ marginTop: 8 }}>
            <button className="btn primary block lg" type="button" onClick={add}>
              <Icon name="plus" size="sm" /> Adicionar parada
            </button>
          </div>

          <div className="stop-list" style={{ marginTop: 18 }}>
            {n ? draft.stops.map((s, i) => (
              <div key={i} className="sl">
                <span className="sl-n">{i + 1}</span>
                <span className="sl-main">
                  <b>{s.address}</b>
                  <small>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}{s.email ? ' · ' + s.email : ''}</small>
                </span>
                <button className="icon-btn sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i)}>▲</button>
                <button className="icon-btn sm" aria-label="Remover" onClick={() => setDraft(prev => ({ ...prev, stops: prev.stops.filter((_, k) => k !== i) }))}>
                  <Icon name="trash" size="sm" />
                </button>
              </div>
            )) : <p className="muted small">Adicione pelo menos 2 paradas.</p>}
          </div>
        </section>

        <div className="stack">
          <section className="card pad0">
            <div className="card-head pad">
              <h3>Mapa</h3>
              <span className="muted small">{n > 1 ? '≈ ' + num(P.geoKm(pseudo.stops), 1) + ' km' : 'clique para marcar um ponto'}</span>
            </div>
            <GeoMap
              P={P}
              routes={[pseudo]}
              scrollZoom
              tempMarker={draft.chosen}
              onMapClick={(lat, lng) => mark(lat, lng)}
              onReady={(map, LOrGoogle) => {
                mapRef.current = { map, L: LOrGoogle };
              }}
            />
          </section>
          <section className="card">
            <div className="card-head"><h3>2. Motorista</h3></div>
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
    const clean = newDemoDraft();
    drafts.demo = clean;
    setDraftState(clean);
    setChosen(null);
    setQ('');
    setForm({ rn: '', rp: '', pk: '', pw: '' });
    setErr('');
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
            <GeoMap P={P} routes={[{ id: 'demo-novo', code: 'Nova rota', status: 'CREATED', stops: list }]} scrollZoom />
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
