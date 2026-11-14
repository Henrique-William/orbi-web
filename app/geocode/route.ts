import { NextResponse } from 'next/server';

function parseGoogleResult(r: any) {
  const comps = r.address_components || [];
  const getComp = (type: string, short = false) => {
    const c = comps.find((x: any) => x.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : '';
  };

  const streetNumber = getComp('street_number');
  const route = getComp('route') || getComp('premise') || getComp('point_of_interest');
  const district =
    getComp('sublocality_level_1') ||
    getComp('sublocality') ||
    getComp('neighborhood') ||
    getComp('political');
  const city =
    getComp('administrative_area_level_2') ||
    getComp('locality') ||
    getComp('administrative_area_level_3');
  const state = getComp('administrative_area_level_1', true);
  const rawCep = getComp('postal_code').replace(/\D/g, '');
  const cep = rawCep.length === 8 ? rawCep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : getComp('postal_code');

  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    locationType: r.geometry.location_type,
    street: route,
    number: streetNumber,
    district,
    city,
    state,
    cep,
    formattedAddress: r.formatted_address
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  const apiKey = (
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      message: 'Chave do Google Maps (GOOGLE_API_KEY ou GOOGLE_MAPS_API_KEY) não configurada no .env'
    });
  }

  try {
    // 1. Reverse Geocoding (clique no mapa: ?lat=...&lng=...)
    if (latParam && lngParam) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(latParam)},${encodeURIComponent(lngParam)}&region=br&language=pt-BR&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        return NextResponse.json({
          configured: true,
          success: false,
          status: data.status,
          errorMessage: data.error_message || 'Nenhum endereço encontrado neste ponto'
        });
      }

      const parsed = parseGoogleResult(data.results[0]);
      return NextResponse.json({
        configured: true,
        success: true,
        source: 'google',
        ...parsed
      });
    }

    // 2. Forward Geocoding (?q=...)
    if (!q) {
      return NextResponse.json({ error: 'Parâmetro de busca não informado' }, { status: 400 });
    }

    const digits = q.replace(/\D/g, '');
    const isCepOnly = digits.length === 8 && (q.trim().length <= 10 || /^\d{5}-?\d{3}$/.test(q.trim()));

    let viaCepData: any = null;
    let searchAddress = q.trim();

    // Se a busca for apenas um CEP (8 dígitos), consulta ViaCEP para obter o nome exato do logradouro
    // e passa o endereço completo ao Google Maps para cravar a coordenada da rua
    if (isCepOnly) {
      try {
        const vcRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const vcJson = await vcRes.json();
        if (vcJson && !vcJson.erro) {
          viaCepData = vcJson;
          searchAddress = [
            vcJson.logradouro,
            vcJson.bairro,
            `${vcJson.localidade} - ${vcJson.uf}`,
            digits.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
            'Brasil'
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // Segue com a busca direta no Google Maps se o ViaCEP oscilar
      }
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&region=br&language=pt-BR&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return NextResponse.json({
        configured: true,
        success: false,
        status: data.status,
        errorMessage: data.error_message || 'Endereço não encontrado no Google Maps'
      });
    }

    const first = parseGoogleResult(data.results[0]);
    const formattedCep = isCepOnly ? digits.replace(/^(\d{5})(\d{3})$/, '$1-$2') : first.cep;

    return NextResponse.json({
      configured: true,
      success: true,
      source: 'google',
      locationType: first.locationType,
      lat: first.lat,
      lng: first.lng,
      street: (viaCepData && viaCepData.logradouro) || first.street,
      number: isCepOnly ? '' : first.number,
      district: (viaCepData && viaCepData.bairro) || first.district,
      city: (viaCepData && viaCepData.localidade) || first.city,
      state: ((viaCepData && viaCepData.uf) || first.state || '').toUpperCase(),
      cep: formattedCep,
      formattedAddress: first.formattedAddress,
      allResults: data.results.slice(0, 5).map((r: any) => parseGoogleResult(r))
    });
  } catch (err: any) {
    return NextResponse.json({ configured: true, success: false, error: err.message }, { status: 500 });
  }
}
