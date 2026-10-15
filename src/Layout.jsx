import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Home, ClipboardList, ClipboardCheck,
  Menu, X, Users, BookOpen, FileSpreadsheet, Settings,
  LogOut, 
} from 'lucide-react';
import logo from './assets/logo_in_app.svg';
import { logout } from './auth';
import SyncBadge from './SyncBadge';
import ThemeToggle from './ThemeToggle';

const mainTabs = [
  { to: '/',           label: 'Home',       icon: Home,           end: true },
  { to: '/scores',     label: 'Scores',     icon: ClipboardList },
  { to: '/correction', label: 'Correction', icon: ClipboardCheck },
];

const drawerItems = [
  { to: '/students', label: 'Students', icon: Users,           desc: 'Roster & classes' },
  { to: '/lessons',  label: 'Lessons',  icon: BookOpen,        desc: 'Subjects & sub-masteries' },
  { to: '/exams',    label: 'Exams',    icon: FileSpreadsheet, desc: 'Create & manage exams' },
  { to: '/settings', label: 'Settings', icon: Settings,        desc: 'Preferences' },
];

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <Link to="/" className="flex items-center gap-2">
  <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
    <img 
      src={logo}
      alt="Logo" 
      className="h-[18px] w-[18px]" 
    />
  </div>
  <span className="hidden font-semibold sm:inline">GradeCompanion</span>
</Link>

          <nav className="ml-3 hidden items-center gap-1 sm:flex">
            {mainTabs.map((t) => {
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

          <div className="ml-auto flex items-center gap-1">
            <SyncBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-3">
          {mainTabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                    isActive ? 'text-accent-text' : 'text-ink-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`grid h-8 w-14 place-items-center rounded-lg transition ${
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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function Drawer({ open, onClose }) {
  const nav = useNavigate();

  async function handleSignOut() {
    onClose();
    await logout();
    nav('/');
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-card transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
          <img 
          src={logo}
          alt="Logo" 
          className="h-[18px] w-[18px]" 
          />
          </div>
            <span className="font-semibold">GradeCompanion</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {drawerItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                    isActive ? 'bg-accent-soft text-accent-text' : 'hover:bg-muted'
                  }`
                }
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-ink-muted">{item.desc}</div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-line p-2">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition hover:bg-muted hover:text-ink"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}