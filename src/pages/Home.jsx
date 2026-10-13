import { Link } from 'react-router-dom';

const cards = [
  { to: '/students',   title: 'Students',     desc: 'Roster & classes' },
  { to: '/scores',     title: 'Daily Scores', desc: 'Record per-day scores' },
  { to: '/exams',      title: 'Exams',        desc: 'Create exams and answer keys' },
  { to: '/correction', title: 'Correction',   desc: 'Grade a session student by student' },
];

export default function Home() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-sm"
          >
            <div className="font-medium text-slate-900">{c.title}</div>
            <div className="mt-1 text-sm text-slate-500">{c.desc}</div>
          </Link>
        ))}
      </div>
    </>
  );
}