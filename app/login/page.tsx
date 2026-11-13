'use client';
/*
 * Login — somente empresa / gestor (perfil ADMIN na Orbi API).
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
    P.API && P.sessionExpired ? { msg: 'Sua sessão expirou (a Orbi API encerra o login após alguns minutos). Entre novamente.', field: null } : null
  );

  useEffect(() => { if (P.me()) router.replace('/overview'); }, [P, router]);

  const restricted = <><Icon name="lock" size="sm" /> <span><b>Acesso restrito.</b> O portal é exclusivo para empresas e gestores{P.API ? ' (perfil ADMIN)' : ''}. Motoristas usam o app Orbi.</span></>;

  async function login(em: string, pw: string) {
    if (P.API ? !em : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setErr({ msg: P.API ? 'Informe seu e-mail ou usuário.' : 'Informe um e-mail válido.', field: 'em' });
    if (!pw) return setErr({ msg: 'Informe sua senha.', field: 'pw' });
    setErr(null); setBusy('login');
    if (P.API) {
      // na Orbi API o administrador padrão usa o usuário "admin" (sem @), então aceitamos qualquer login
      const slow = setTimeout(() => setBusy('waking'), 6000);
      try {
        await P.apiLogin(em, pw);
        clearTimeout(slow);
        toast(`Sessão iniciada como ${first(P.me().name)}`, 'check');
        router.replace('/overview');
      } catch (e: any) {
        clearTimeout(slow); setBusy(false);
        if (e.restricted) setErr({ msg: restricted, field: 'em' });
        else setErr({ msg: e.message || 'Não foi possível entrar.', field: e.status === 401 ? 'pw' : null });
      }
      return;
    }
    await new Promise(r => setTimeout(r, 600));
    setBusy(false);
    P.reload(); // estado mais recente da demonstração
    const u = P.S.users.find((x: any) => x.email.toLowerCase() === em.toLowerCase());
    if (!u || u.password !== pw) return setErr({ msg: 'E-mail ou senha incorretos.', field: 'pw' });
    if (u.role !== 'ADMIN') return setErr({ msg: restricted, field: 'em' });
    P.setSession({ userId: u.id, at: new Date().toISOString() });
    toast(`Sessão iniciada como ${first(u.name)}`, 'check');
    router.replace('/overview');
  }
  const submit = (e: FormEvent) => { e.preventDefault(); login(email.trim(), pass); };
  const demo = (em: string) => { setEmail(em); setPass('orbi123'); login(em, 'orbi123'); };

  return (
    <div className="login">
      <section className="login-form">
        <div className="lf-top"><span className="brand-logo"><Logo /></span>Orbi</div>
        <form onSubmit={submit} noValidate>
          <h2>Entrar</h2><p className="muted">Portal de operações para empresas e gestores.</p>
          <label className="lbl" htmlFor="em">{P.API ? 'E-mail ou usuário' : 'E-mail corporativo'}</label>
          <div className={`input ${err && err.field === 'em' ? 'err' : ''}`}><Icon name="mail" size="sm" /><input id="em" type={P.API ? 'text' : 'email'} autoComplete="username" placeholder="nome@empresa.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <label className="lbl" htmlFor="pw">Senha</label>
          <div className={`input ${err && err.field === 'pw' ? 'err' : ''}`}><Icon name="lock" size="sm" /><input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={pass} onChange={e => setPass(e.target.value)} />
            <button type="button" className="icon-btn sm" aria-label="Mostrar senha" onClick={() => setShow(!show)}><Icon name="eye" size="sm" /></button></div>
          <div className="form-err" role="alert">{err ? err.msg : null}</div>
          <button className="btn primary block lg" disabled={!!busy}>{busy ? <><Icon name="refresh" size="sm spin" /> {busy === 'waking' ? 'Acordando o servidor… (até 1 min)' : 'Entrando…'}</> : 'Entrar'}</button>
          <div className="row between" style={{ marginTop: 14 }}>
            <button type="button" className="link" onClick={() => toast(P.API ? 'A Orbi API ainda não tem recuperação de senha. Peça a redefinição ao administrador do sistema.' : 'Enviamos um link de redefinição para o e-mail (simulado)', 'mail')}>Esqueci minha senha</button>
            {P.API ? <a className="link" href="/login?demo">Ver demonstração</a> : <a className="link" href="/login?api">Usar a Orbi API</a>}
          </div>
          {P.API ? <p className="muted small" style={{ margin: '18px 0 0' }}>Use sua conta de gestor (perfil ADMIN) da Orbi API.</p> : <>
            <div className="or">contas de demonstração · senha orbi123</div>
            <div className="demo-row">
              <button type="button" className="demo" onClick={() => demo('gestor@orbi.demo')}><Icon name="users" size="sm" /><span><b>Gestor</b><small>Ana Souza</small></span></button>
              <button type="button" className="demo" onClick={() => demo('empresa@orbi.demo')}><Icon name="building" size="sm" /><span><b>Empresa</b><small>Roberto Almeida</small></span></button>
            </div>
          </>}
          <p className="muted small" style={{ margin: '20px 0 0' }}>É motorista? O acesso é pelo app Orbi no celular.</p>
        </form>
        <div className="lf-foot"><span>© {new Date().getFullYear()} Orbi Logística</span><span>{P.API ? 'Conectado à Orbi API' : 'Modo demonstração'}</span></div>
      </section>
      <section className="login-art">
        <span className="eyebrow">Orbi para empresas</span>
        <div className="login-copy"><h1>A operação de entregas inteira, em uma tela.</h1>
          <p>Acompanhe as rotas enquanto acontecem, resolva ocorrências antes que virem reclamação e meça o resultado de cada motorista.</p></div>
        <div className="login-feats">
          <div><b>Ao vivo</b><span>Posição e progresso de cada rota, sincronizados com o app do motorista.</span></div>
          <div><b>Ocorrências</b><span>Atrasos, paradas puladas e rotas sem motorista em uma só fila.</span></div>
          <div><b>Relatórios</b><span>Taxa de sucesso, custo por entrega e exportação em CSV ou PDF.</span></div>
        </div>
      </section>
    </div>
  );
}
