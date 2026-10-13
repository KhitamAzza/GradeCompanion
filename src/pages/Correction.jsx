import { useEffect, useMemo, useState } from 'react';
import { Play, PlayCircle, RotateCcw, CheckCircle2, Clock, MinusCircle, ClipboardList } from 'lucide-react';
import { subscribeExams, updateExam } from '../exams';
import { subscribeStudents } from '../students';
import { subscribeResponses, subscribeState } from '../correction';
import CorrectionSession from '../CorrectionSession';

export default function Correction() {
  const [exams, setExams]       = useState(null);
  const [students, setStudents] = useState(null);
  const [examId, setExamId]     = useState('');
  const [responses, setResponses] = useState({});
  const [state, setState]       = useState(null);
  const [session, setSession]   = useState(null);

  useEffect(() => subscribeExams(setExams), []);
  useEffect(() => subscribeStudents(setStudents), []);

  useEffect(() => {
    if (!examId) { setResponses({}); setState(null); return; }
    const u1 = subscribeResponses(examId, setResponses);
    const u2 = subscribeState(examId, setState);
    return () => { u1(); u2(); };
  }, [examId]);

  const exam = useMemo(
    () => exams?.find((e) => e.id === examId) ?? null,
    [exams, examId]
  );

  const examStudents = useMemo(() => {
    if (!exam || !students) return [];
    const set = new Set(exam.classes ?? []);
    return students.filter((s) => set.has(s.class));
  }, [exam, students]);

  async function startSession(mode) {
    if (!exam) return;
    if (exam.status === 'draft') {
      updateExam(exam.id, { status: 'active' }).catch(() => {});
    }
    setSession({ mode });
  }

  if (exams === null || students === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  if (session && exam) {
    return (
      <CorrectionSession
        exam={exam}
        students={examStudents}
        responses={responses}
        mode={session.mode}
        onExit={async (reason) => {
          setSession(null);
          if (reason === 'complete') {
            const allDone = examStudents.every((s) => responses[s.id]);
            if (allDone) await updateExam(exam.id, { status: 'done' });
          }
        }}
      />
    );
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Correction</h1>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <ClipboardList size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">No exams yet. Create one on the <b className="text-ink">Exams</b> page first.</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-ink-muted">Exam / subject</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent sm:w-80"
            >
              <option value="">— Select an exam —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.subject} · {(e.classes ?? []).join(', ')}
                </option>
              ))}
            </select>
          </div>

          {exam && (
            <StudentQueue
              exam={exam}
              students={examStudents}
              responses={responses}
              state={state}
              onStart={startSession}
            />
          )}
        </>
      )}
    </>
  );
}

function StudentQueue({ exam, students, responses, state, onStart }) {
  const done    = students.filter((s) => responses[s.id] && !responses[s.id].absent);
  const absent  = students.filter((s) => responses[s.id]?.absent);
  const pending = students.filter((s) => !responses[s.id]);
  const resumeId = state?.studentId;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-ink-muted">
            <b className="text-ink">{students.length}</b> students ·{' '}
            <b className="text-emerald-500">{done.length}</b> done ·{' '}
            <b className="text-ink-muted">{pending.length}</b> pending ·{' '}
            <b className="text-amber-500">{absent.length}</b> absent
          </div>
          <button
            onClick={() => onStart(
              resumeId
                ? { type: 'resume', state }
                : { type: 'fresh' }
            )}
            className="ml-auto flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            {resumeId ? <PlayCircle size={16} /> : <Play size={16} />}
            {resumeId ? 'Resume session' : 'Start session'}
          </button>
        </div>
        {resumeId && (
          <p className="mt-2 text-xs text-amber-500">
            Resuming — last active: {students.find((s) => s.id === resumeId)?.name ?? 'unknown'}
          </p>
        )}
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {students.map((s) => {
          const r = responses[s.id];
          const status = !r ? 'pending' : r.absent ? 'absent' : 'done';
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.name}</div>
                <div className="text-xs text-ink-muted">{s.class}</div>
              </div>
              {status === 'done' && (
                <span className="text-sm font-semibold">{r.totalScore}</span>
              )}
              <StatusBadge status={status} />
              <button
                onClick={() => onStart({ type: 'student', studentId: s.id })}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                title={status === 'pending' ? 'Correct' : 'Re-correct'}
              >
                {status === 'pending' ? <Play size={14} /> : <RotateCcw size={14} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    done:    { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2, label: 'done' },
    absent:  { cls: 'bg-amber-500/15 text-amber-500',     Icon: MinusCircle,  label: 'absent' },
    pending: { cls: 'bg-muted text-ink-muted',            Icon: Clock,        label: 'pending' },
  };
  const { cls, Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}