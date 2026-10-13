import { useEffect, useMemo, useState } from 'react';
import {
  Play, PlayCircle, RotateCcw, CheckCircle2, XCircle,
  Clock, MinusCircle, ClipboardList, AlertCircle,
} from 'lucide-react';
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
  const mcqTotal   = exam.mcqCount   ?? 0;
  const essayTotal = exam.essayCount ?? 0;

  // Aggregate counters for the top card.
  let doneCount = 0, partialCount = 0;
  for (const s of students) {
    const r = responses[s.id];
    if (!r || r.absent) continue;
    const m = countFilled(r.answers, mcqTotal);
    const e = countFilled(r.essayScores, essayTotal);
    if (m >= mcqTotal && e >= essayTotal) doneCount++;
    else partialCount++;
  }
  const absentCount  = students.filter((s) => responses[s.id]?.absent).length;
  const pendingCount = students.filter((s) => !responses[s.id]).length;
  const resumeId     = state?.studentId;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span><b className="text-ink">{students.length}</b> students</span>
            <span><b className="text-emerald-500">{doneCount}</b> done</span>
            {partialCount > 0 && (
              <span><b className="text-amber-500">{partialCount}</b> partial</span>
            )}
            <span><b className="text-ink-muted">{pendingCount}</b> pending</span>
            {absentCount > 0 && (
              <span><b className="text-amber-500">{absentCount}</b> absent</span>
            )}
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

          const mcqFilled   = countFilled(r?.answers,     mcqTotal);
          const essayFilled = countFilled(r?.essayScores, essayTotal);
          const mcqComplete   = mcqTotal   === 0 || mcqFilled   >= mcqTotal;
          const essayComplete = essayTotal === 0 || essayFilled >= essayTotal;
          const isComplete    = mcqComplete && essayComplete;

          const status = !r
            ? 'pending'
            : r.absent
            ? 'absent'
            : isComplete
            ? 'done'
            : 'partial';

          return (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.name}</div>
                <div className="text-xs text-ink-muted">{s.class}</div>
              </div>

              {mcqTotal > 0 && (
                <SectionChip
                  label="MCQ"
                  done={mcqFilled}
                  total={mcqTotal}
                  onClick={() => onStart({
                    type: 'student',
                    studentId: s.id,
                    startPhase: 'mcq',
                  })}
                />
              )}

              {essayTotal > 0 && (
                <SectionChip
                  label="Essay"
                  done={essayFilled}
                  total={essayTotal}
                  onClick={() => onStart({
                    type: 'student',
                    studentId: s.id,
                    startPhase: 'essay',
                  })}
                />
              )}

              {status === 'done' && (
                <span className="hidden text-sm font-semibold tabular-nums sm:inline">
                  {r.totalScore}
                </span>
              )}

              <StatusBadge status={status} />

              <button
                onClick={() => onStart({ type: 'student', studentId: s.id })}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                title={status === 'pending' ? 'Start' : 'Open'}
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

function countFilled(map, total) {
  if (!map || total === 0) return 0;
  let n = 0;
  for (let i = 1; i <= total; i++) {
    if (map[String(i)] !== undefined) n++;
  }
  return n;
}

function SectionChip({ label, done, total, onClick }) {
  const complete = done >= total;
  const Icon = complete ? CheckCircle2 : XCircle;
  const cls = complete
    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
    : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${cls}`}
      title={`${label}: ${done}/${total} — click to open`}
    >
      <Icon size={12} />
      <span className="tabular-nums">{done}/{total}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    done:    { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2, label: 'done' },
    partial: { cls: 'bg-amber-500/15 text-amber-500',     Icon: AlertCircle,  label: 'partial' },
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