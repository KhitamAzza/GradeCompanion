import { Link } from 'react-router-dom';
import { Users, ClipboardList, FileSpreadsheet, CheckCircle2, ArrowRight } from 'lucide-react';

const cards = [
  { to: '/students',   title: 'Students',      desc: 'Roster & classes',                 icon: Users,          tint: 'bg-indigo-500/10 text-indigo-500' },
  { to: '/scores',     title: 'Daily Scores',  desc: 'Record per-day scores',            icon: ClipboardList,  tint: 'bg-emerald-500/10 text-emerald-500' },
  { to: '/exams',      title: 'Exams',         desc: 'Create exams and answer keys',     icon: FileSpreadsheet,tint: 'bg-amber-500/10 text-amber-500' },
  { to: '/correction', title: 'Correction',    desc: 'Grade a session student by student', icon: CheckCircle2, tint: 'bg-orange-500/10 text-orange-500' },
];

export default function Home() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage students, daily scores, and exam corrections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-center gap-4 rounded-xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${c.tint}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.title}</div>
                <div className="mt-0.5 text-sm text-ink-muted">{c.desc}</div>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </Link>
          );
        })}
      </div>
    </>
  );
}