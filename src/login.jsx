import { useState } from 'react';
import { useAuth, login } from './auth';
import logo from './assets/logo_in_app.svg';

export default function Login() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email.trim(), pw);
    } catch (e) {
      setErr(e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '').trim());
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-medium text-emerald-500">Signed in as</p>
          <p className="mt-1 text-ink">{user.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-fg">
            <img src={logo} alt="Logo" className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">GradeCompanion</h1>
          <p className="text-xs text-ink-muted">Sign in to continue</p>
        </div>

        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mb-3 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
        />
        <input
          type="password" required autoComplete="current-password"
          value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="mb-3 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
        />

        {err && <p className="mb-3 text-sm text-rose-500">{err}</p>}

        <button
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}