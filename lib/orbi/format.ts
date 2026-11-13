/*
 * Formatação e constantes do domínio (compartilhadas por todo o portal).
 */
// ---------------------------------------------------------------------------
// Utilitários de formatação
// ---------------------------------------------------------------------------
export const esc = (s: any) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
export const initials = (n: any) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
export const first = (n: any) => String(n || '').split(' ')[0];
export const hhmm = (d?: any) => new Date(d || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const date = (d: any) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
export const rel = (iso: any) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60); if (h < 20) return `há ${h} h`; if (h < 44) return 'ontem';
  return `há ${Math.round(h / 24)} dias`;
};
export const num = (v: any, d?: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
export const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)} min`);
export const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
export const pad2 = (n: number) => String(n).padStart(2, '0');

export type Check = ['ok' | 'warn' | 'bad', string, string];

export const TERMINAL = ['COMPLETED', 'SKIPPED', 'CANCELLED'];
export const ROUTE_STATUS: Record<string, [string, string]> = { CREATED: ['Sem motorista', 'neutral'], ASSIGNED: ['A iniciar', 'neutral'], DELAYED: ['Atrasada', 'red'], IN_PROGRESS: ['Em andamento', 'blue'], COMPLETED: ['Concluída', 'green'], CANCELLED: ['Cancelada', 'red'] };
export const STOP_STATUS: Record<string, [string, string]> = { PENDING: ['Pendente', 'neutral'], IN_TRANSIT: ['Em trânsito', 'blue'], COMPLETED: ['Entregue', 'green'], SKIPPED: ['Pulada', 'amber'], CANCELLED: ['Cancelada', 'red'] };
export const PRIORITY: Record<string, [string, string]> = { HIGH: ['Alta prioridade', 'amber'], URGENT: ['Urgente', 'red'] };
export const OWNERSHIP: Record<string, [string, string]> = { COMPANY: ['Da empresa', 'blue'], PERSONAL: ['Particular', 'amber'] };

