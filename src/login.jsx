import { useState } from 'react';
import { useAuth, login } from './auth';

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
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-xl bg-white p-8 shadow text-center">
          <p className="text-emerald-600 font-medium">Signed in as</p>
          <p className="mt-1 text-slate-900">{user.email}</p>
          <p className="mt-4 text-sm text-slate-500">Next step: hook up the app shell.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow">
        <h1 className="mb-5 text-xl font-semibold text-slate-900">Sign in</h1>

        <input
          type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
        />
        <input
          type="password" required autoComplete="current-password"
          value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
        />

        {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

        <button
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}