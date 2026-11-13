/*
 * Configuração do portal.
 *   Modo padrão: 'api'  -> usa a Orbi API real (os mesmos dados do app Android).
 *   Modo 'demo'          -> dados de demonstração no navegador, sem internet. Abra qualquer página com ?demo.
 *   apiBase: '/api'      -> o Next.js repassa /api/* para a Orbi API (ver next.config.ts), evitando bloqueio de CORS.
 */
export const CONFIG = {
  apiBase: '/api',
  apiPublicUrl: process.env.NEXT_PUBLIC_ORBI_API_PUBLIC_URL || 'https://orbi-api-em6s.onrender.com',
  pollSeconds: Number(process.env.NEXT_PUBLIC_ORBI_POLL_SECONDS || 10),
  companyName: 'Orbi Logística',
  // a API devolve datas sem fuso (LocalDateTime); o servidor do Render roda em UTC
  apiTimesUtc: true
};

const MODE_KEY = 'orbi-modo';

/** Decide o modo uma vez por aba: ?demo liga a demonstração; ?api volta para a API. */
export function resolveMode(): 'api' | 'demo' {
  if (typeof window === 'undefined') return 'api';
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has('demo')) sessionStorage.setItem(MODE_KEY, 'demo');
    if (q.has('api')) sessionStorage.removeItem(MODE_KEY);
    return sessionStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'api';
  } catch {
    return 'api';
  }
}

export function leaveDemo() {
  try { sessionStorage.removeItem(MODE_KEY); } catch { /* ignora */ }
}
