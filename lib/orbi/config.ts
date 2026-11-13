/*
 * Configuração do portal.
 *   Modo padrão: 'api'  -> usa a Orbi API real (os mesmos dados do app Android).
 *   Modo 'demo'          -> dados de demonstração no navegador, sem internet. Abra qualquer página com ?demo.
 *   apiBase: '/api'      -> o Next.js repassa /api/* para a Orbi API (ver next.config.ts), evitando bloqueio de CORS.
 */
export const CONFIG = {
  apiBase: '/api',
  apiPublicUrl: process.env.NEXT_PUBLIC_ORBI_API_PUBLIC_URL || 'https://orbi-api-em6s.onrender.com',
  // atualização automática: 0 = desligada (padrão; o gestor usa o botão "Atualizar").
  // Cada gestor pode ligar em Configurações → Conexão; a escolha fica salva no navegador.
  pollSeconds: Number(process.env.NEXT_PUBLIC_ORBI_POLL_SECONDS || 0),
  companyName: 'Orbi Logística',
  // a API devolve datas sem fuso (LocalDateTime); o servidor do Render roda em UTC
  apiTimesUtc: true
};

const MODE_KEY = 'orbi-modo';
const AUTO_KEY = 'orbi-atualizacao-auto';

/** Intervalo da atualização automática em segundos (0 = só manual). */
export function autoRefreshSeconds(): number {
  try { const v = localStorage.getItem(AUTO_KEY); if (v != null) return Math.max(0, Number(v) || 0); } catch { /* ignora */ }
  return CONFIG.pollSeconds;
}
export function saveAutoRefresh(seconds: number) {
  try { localStorage.setItem(AUTO_KEY, String(seconds)); } catch { /* ignora */ }
}

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
