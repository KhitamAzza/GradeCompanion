import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Users, ClipboardList, FileSpreadsheet, Settings,
  LogOut, GraduationCap, BookOpen,
} from 'lucide-react';
import { logout } from './auth';
import SyncBadge from './SyncBadge';
import ThemeToggle from './ThemeToggle';

const tabs = [
  { to: '/',          label: 'Home',     icon: Home,            end: true },
  { to: '/students',  label: 'Students', icon: Users },
  { to: '/lessons',   label: 'Lessons',  icon: BookOpen },
  { to: '/scores',    label: 'Scores',   icon: ClipboardList },
  { to: '/exams',     label: 'Exams',    icon: FileSpreadsheet },
  { to: '/settings',  label: 'Settings', icon: Settings },
];

export default function Layout({ children }) {
  const nav = useNavigate();

  async function handleSignOut() {
    await logout();
    nav('/');
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
              <GraduationCap size={18} />
            </div>
            <span className="font-semibold">GradeCompanion</span>
          </div>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-accent-soft text-accent-text font-medium'
                        : 'text-ink-muted hover:bg-muted hover:text-ink'
                    }`
                  }
                >
                  <Icon size={16} />
                  {t.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <SyncBadge />
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-muted hover:text-ink"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                    isActive ? 'text-accent-text' : 'text-ink-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`grid h-8 w-12 place-items-center rounded-lg transition ${
                      isActive ? 'bg-accent-soft' : ''
                    }`}>
                      <Icon size={18} />
                    </div>
                    <span>{t.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}