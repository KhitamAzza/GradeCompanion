import { useEffect, useMemo, useState } from 'react';
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
  const [session, setSession]   = useState(null); // { mode } | null

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
    return <p className="text-slate-500">Loading…</p>;
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
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Correction</h1>

      {exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No exams yet. Create one on the <b>Exams</b> page first.
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">Exam / subject</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 sm:w-80"
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
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-600">
            <b className="text-slate-900">{students.length}</b> students ·{' '}
            <b className="text-emerald-600">{done.length}</b> done ·{' '}
            <b className="text-slate-500">{pending.length}</b> pending ·{' '}
            <b className="text-amber-600">{absent.length}</b> absent
          </div>
          <button
            onClick={() => onStart(
              resumeId
                ? { type: 'resume', state }
                : { type: 'fresh' }
            )}
            className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            {resumeId ? 'Resume session' : 'Start session'}
          </button>
        </div>
        {resumeId && (
          <p className="mt-2 text-xs text-amber-700">
            Resuming — last active: {students.find((s) => s.id === resumeId)?.name ?? 'unknown'}
          </p>
        )}
      </div>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {students.map((s) => {
          const r = responses[s.id];
          const status = !r ? 'pending' : r.absent ? 'absent' : 'done';
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-500">{s.class}</div>
              </div>
              {status === 'done' && (
                <span className="text-sm font-semibold text-slate-900">{r.totalScore}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                status === 'done'   ? 'bg-emerald-100 text-emerald-700'
              : status === 'absent' ? 'bg-amber-100 text-amber-700'
              :                       'bg-slate-100 text-slate-600'
              }`}>{status}</span>
              <button
                onClick={() => onStart({ type: 'student', studentId: s.id })}
                className="text-xs text-slate-500 hover:text-indigo-600"
              >
                {status === 'pending' ? 'Correct' : 'Re-correct'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}