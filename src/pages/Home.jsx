import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ClipboardList, GraduationCap,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { subscribeStudents } from '../students';
import { subscribeAllScores, subscribeAllClassColumns } from '../scores';

export default function Home() {
  const [students, setStudents]       = useState(null);
  const [scores, setScores]           = useState(null);
  const [columns, setColumns]         = useState(null);

  useEffect(() => subscribeStudents(setStudents), []);
  useEffect(() => subscribeAllScores(setScores), []);
  useEffect(() => subscribeAllClassColumns(setColumns), []);

  const classStats = useMemo(() => {
    if (!students || !scores || !columns) return null;

    const byClass = {};
    students.forEach((s) => { (byClass[s.class] ??= []).push(s); });

    const scoreByStudent = {};
    scores.forEach((sc) => {
      (scoreByStudent[sc.studentId] ??= {})[sc.subMasteryId] = sc.score;
    });

    const stats = [];
    for (const [cls, list] of Object.entries(byClass)) {
      const cols = columns[cls] ?? [];
      const totalCols = cols.length;

      let incompleteCount = 0;
      for (const st of list) {
        const filled = cols.filter(
          (id) => scoreByStudent[st.id]?.[id] !== undefined
        ).length;
        if (filled < totalCols) incompleteCount++;
      }

      stats.push({
        cls,
        studentCount: list.length,
        totalCols,
        incompleteCount,
        complete: incompleteCount === 0 && totalCols > 0,
        empty: totalCols === 0,
      });
    }

    stats.sort((a, b) => {
      if (a.empty !== b.empty) return a.empty ? 1 : -1;
      if (a.incompleteCount !== b.incompleteCount)
        return b.incompleteCount - a.incompleteCount;
      return a.cls.localeCompare(b.cls);
    });
    return stats;
  }, [students, scores, columns]);

  const totalIncomplete = classStats
    ? classStats.reduce((a, c) => a + c.incompleteCount, 0)
    : null;

  const activeSubjects = classStats
    ? classStats.filter((c) => c.totalCols > 0).length
    : null;

  if (students === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Here's what needs your attention today.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile
          icon={Users}
          label="Students"
          value={students.length}
          tint="bg-indigo-500/10 text-indigo-500"
        />
        <StatTile
          icon={ClipboardList}
          label="Active classes"
          value={activeSubjects ?? '—'}
          tint="bg-emerald-500/10 text-emerald-500"
        />
        <StatTile
          icon={AlertCircle}
          label="Incomplete"
          value={totalIncomplete ?? '—'}
          tint={totalIncomplete > 0
            ? 'bg-amber-500/10 text-amber-500'
            : 'bg-muted text-ink-muted'}
        />
      </div>

      <h2 className="mb-3 text-sm font-medium text-ink-muted">Classes</h2>

      {classStats === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : classStats.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <GraduationCap size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">
            Nothing here yet. Add students from the menu to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {classStats.map((c) => (
            <li key={c.cls}>
              <Link
                to={`/scores?class=${encodeURIComponent(c.cls)}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                  c.empty
                    ? 'bg-muted text-ink-muted'
                    : c.complete
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {c.empty ? (
                    <ClipboardList size={18} />
                  ) : c.complete ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertCircle size={18} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.cls}</div>
                  <div className="text-xs text-ink-muted">
                    {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                    {c.empty
                      ? ' · no columns yet'
                      : c.complete
                      ? ` · all ${c.totalCols} filled`
                      : ` · ${c.incompleteCount} incomplete of ${c.totalCols} columns`}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatTile({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 sm:p-4">
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}>
        <Icon size={16} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}