/*
 * Configuração do portal.
 * Modo padrão: exclusivo Orbi API (backend oficial).
 * apiBase: '/api' -> o Next.js repassa /api/* para a Orbi API (ver next.config.ts), evitando bloqueio de CORS.
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

const AUTO_KEY = 'orbi-atualizacao-auto';

/** Intervalo da atualização automática em segundos (0 = só manual). */
export function autoRefreshSeconds(): number {
  try { const v = localStorage.getItem(AUTO_KEY); if (v != null) return Math.max(0, Number(v) || 0); } catch { /* ignora */ }
  return CONFIG.pollSeconds;
}
export function saveAutoRefresh(seconds: number) {
  try { localStorage.setItem(AUTO_KEY, String(seconds)); } catch { /* ignora */ }
}

/** Modo oficial de operação: sempre 'api'. */
export function resolveMode(): 'api' {
  return 'api';
}

export function leaveDemo() {
  /* No-op para compatibilidade */
}
