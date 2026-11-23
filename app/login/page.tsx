'use client';
/*
 * Login — exclusivo empresa / gestor operacional (perfil ADMIN na Orbi API).
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Logo } from '@/components/Icon';
import { useOrbi, useIsClient } from '@/lib/orbi/useOrbi';
import { first } from '@/lib/orbi/format';
import { toast } from '@/lib/orbi/ui';

export default function LoginPage() {
  const mounted = useIsClient();
  useEffect(() => { document.title = 'Entrar · Orbi Portal'; }, []);
  return mounted ? <Login /> : <div className="boot"><span className="loader-ring" /></div>;
}

function Login() {
  const P = useOrbi();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<false | 'login' | 'waking'>(false);
  const [err, setErr] = useState<{ msg: ReactNode; field: 'em' | 'pw' | null } | null>(
    P.sessionExpired ? { msg: 'Sua sessão expirou. Entre novamente com suas credenciais.', field: null } : null
  );

  useEffect(() => { if (P.me()) router.replace('/overview'); }, [P, router]);

  const restricted = <><Icon name="lock" size="sm" /> <span><b>Acesso restrito.</b> O portal é exclusivo para empresas e gestores (perfil ADMIN). Motoristas acessam pelo app Orbi.</span></>;

  async function login(em: string, pw: string) {
    if (!em) return setErr({ msg: 'Informe seu e-mail corporativo ou usuário.', field: 'em' });
    if (!pw) return setErr({ msg: 'Informe sua senha de acesso.', field: 'pw' });
    setErr(null); setBusy('login');
    const slow = setTimeout(() => setBusy('waking'), 6000);
    try {
      await P.apiLogin(em, pw);
      clearTimeout(slow);
      toast(`Sessão iniciada como ${first(P.me()?.name || 'Gestor')}`, 'check');
      router.replace('/overview');
    } catch (e: any) {
      clearTimeout(slow); setBusy(false);
      if (e.restricted) setErr({ msg: restricted, field: 'em' });
      else setErr({ msg: e.message || 'Não foi possível entrar no sistema.', field: e.status === 401 ? 'pw' : null });
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); login(email.trim(), pass); };

  return (
    <div className="login">
      <section className="login-form">
        <div className="lf-top">
          <span className="brand-logo"><Logo /></span>
          <b>ORBI <span className="brand-sub">PORTAL</span></b>
        </div>
        <form onSubmit={submit} noValidate>
          <h2>Entrar no sistema</h2>
          <p className="muted">Portal de operações e monitoramento logístico.</p>
          <label className="lbl" htmlFor="em">E-mail corporativo ou usuário</label>
          <div className={`input ${err && err.field === 'em' ? 'err' : ''}`}>
            <Icon name="mail" size="sm" />
            <input id="em" type="text" autoComplete="username" placeholder="usuario ou nome@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <label className="lbl" htmlFor="pw">Senha</label>
          <div className={`input ${err && err.field === 'pw' ? 'err' : ''}`}>
            <Icon name="lock" size="sm" />
            <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={pass} onChange={e => setPass(e.target.value)} />
            <button type="button" className="icon-btn sm" aria-label="Mostrar senha" onClick={() => setShow(!show)}><Icon name="eye" size="sm" /></button>
          </div>
          <div className="form-err" role="alert">{err ? err.msg : null}</div>
          <button className="btn primary block lg" disabled={!!busy}>
            {busy ? <><Icon name="refresh" size="sm spin" /> {busy === 'waking' ? 'Conectando ao servidor…' : 'Autenticando…'}</> : 'Entrar'}
          </button>
          <div className="row between" style={{ marginTop: 14 }}>
            <button type="button" className="link" onClick={() => toast('Para redefinir sua senha, solicite ao administrador da organização.', 'info')}>Esqueci minha senha</button>
          </div>
          <p className="muted small" style={{ margin: '24px 0 0' }}>É motorista? O acesso às rotas é realizado pelo app móvel Orbi.</p>
        </form>
        <div className="lf-foot">
          <span>© {new Date().getFullYear()} Orbi Logística</span>
          <span>Orbi API Conectada</span>
        </div>
      </section>
      <section className="login-art">
        <span className="eyebrow">Orbi Gestor</span>
        <div className="login-copy">
          <h1>A operação de entregas em tempo real.</h1>
          <p>Acompanhe rotas em andamento, trate ocorrências instantaneamente e compare a performance de roteirização da sua frota.</p>
        </div>
        <div className="login-feats">
          <div><b>Ao vivo</b><span>Posição e progresso georreferenciados no mapa operacional.</span></div>
          <div><b>Ocorrências</b><span>Fila única de alertas e desvios para tomada rápida de ação.</span></div>
          <div><b>Benchmark</b><span>Análise comparativa de algoritmos de roteirização (C1–C6).</span></div>
        </div>
      </section>
    </div>
  );
}
