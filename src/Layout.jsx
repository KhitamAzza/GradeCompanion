import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from './auth';
import SyncBadge from './SyncBadge';

const tabs = [
  { to: '/',           label: 'Home',     end: true },
  { to: '/students',   label: 'Students' },
  { to: '/scores',     label: 'Scores' },
  { to: '/exams',      label: 'Exams' },
  { to: '/settings',   label: 'Settings' },
];

export default function Layout({ children }) {
  const nav = useNavigate();

  async function handleSignOut() {
    await logout();
    nav('/');
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <span className="font-semibold text-slate-900">GradeCompanion</span>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-4">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <SyncBadge />
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white sm:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 text-[11px] ${
                  isActive ? 'text-indigo-600 font-medium' : 'text-slate-500'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}