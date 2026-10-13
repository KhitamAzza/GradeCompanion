import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Play, PlayCircle, RotateCcw, CheckCircle2, XCircle,
  Clock, MinusCircle, ClipboardList, AlertCircle, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { subscribeExams, updateExam } from '../exams';
import { subscribeStudents } from '../students';
import {
  subscribeResponses, subscribeState, saveResponse, computeScore,
} from '../correction';
import CorrectionSession from '../CorrectionSession';

export default function Correction() {
  const [exams, setExams]             = useState(null);
  const [students, setStudents]       = useState(null);
  const [examId, setExamId]           = useState('');
  const [responses, setResponses]     = useState({});
  const [state, setState]             = useState(null);
  const [session, setSession]         = useState(null);
  const [focusStudentId, setFocusStudentId] = useState(null);

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
        onExit={async (reason, lastStudentId) => {
          setSession(null);
          if (lastStudentId) setFocusStudentId(lastStudentId);
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
          <p className="text-ink-muted">
            No exams yet. Create one on the <b className="text-ink">Exams</b> page first.
          </p>
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
              focusStudentId={focusStudentId}
              onStart={startSession}
            />
          )}
        </>
      )}
    </>
  );
}

function exportResults(exam, students, responses) {
  const rows = [['Name', 'Class', 'Score']];
  for (const s of students) {
    const r = responses[s.id];
    const score = r && !r.absent ? r.totalScore : '';
    rows.push([s.name, s.class, score]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  const sheetName = (exam.subject || 'Results').slice(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const date = new Date().toISOString().slice(0, 10);
  const safeSubject = (exam.subject || 'results').replace(/[^\w\-]+/g, '_');
  XLSX.writeFile(wb, `${safeSubject}-${date}.xlsx`);
}

function StudentQueue({ exam, students, responses, state, focusStudentId, onStart }) {
  const mcqTotal   = exam.mcqCount   ?? 0;
  const essayTotal = exam.essayCount ?? 0;

  const rowRefs = useRef({});

  // Scroll back to whichever student we just came from.
  // Runs once on mount — StudentQueue unmounts while the session is open,
  // so every return from the session triggers a fresh mount.
  useLayoutEffect(() => {
    if (!focusStudentId) return;
    const el = rowRefs.current[focusStudentId];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focusStudentId]);

  const [editPrompt, setEditPrompt] = useState(null); // { student, section }
  const [busy, setBusy]             = useState(false);

  let doneCount = 0;
  let partialCount = 0;
  for (const s of students) {
    const r = responses[s.id];
    if (!r || r.absent) continue;
    const m = countFilled(r.answers, mcqTotal);
    const e = countFilled(r.essayScores, essayTotal);
    if (m >= mcqTotal && e >= essayTotal) doneCount++;
    else partialCount++;
  }
  const absentCount    = students.filter((s) => responses[s.id]?.absent).length;
  const pendingCount   = students.filter((s) => !responses[s.id]).length;
  const resumeId       = state?.studentId;
  const hasAnyResponse = Object.keys(responses).length > 0;

  function handleChipClick(student, section) {
    const r = responses[student.id];
    const isComplete =
      section === 'mcq'
        ? mcqTotal   > 0 && countFilled(r?.answers,     mcqTotal)   >= mcqTotal
        : essayTotal > 0 && countFilled(r?.essayScores, essayTotal) >= essayTotal;

    if (isComplete) {
      setEditPrompt({ student, section });
    } else {
      onStart({ type: 'student', studentId: student.id, startPhase: section });
    }
  }

  async function handleStartOver(student, section) {
    const r = responses[student.id];
    if (!r) return;

    setBusy(true);
    try {
      const newAnswers     = section === 'mcq'   ? {} : (r.answers     ?? {});
      const newEssayScores = section === 'essay' ? {} : (r.essayScores ?? {});

      const { mcqCorrect, mcqScore, essayScore, totalScore, passed } =
        computeScore(exam, newAnswers, newEssayScores);

      await saveResponse(exam.id, student.id, {
        studentId:    student.id,
        studentName:  student.name,
        studentClass: student.class,
        absent:       false,
        answers:      newAnswers,
        essayScores:  newEssayScores,
        mcqCorrect, mcqScore, essayScore, totalScore, passed,
        completed:    false,
      });

      onStart({
        type: 'student',
        studentId: student.id,
        startPhase: section,
        resetSection: section,
      });
      setEditPrompt(null);
    } finally {
      setBusy(false);
    }
  }

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
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => exportResults(exam, students, responses)}
              disabled={!hasAnyResponse}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
              title={hasAnyResponse ? 'Export results to XLSX' : 'No results yet'}
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => onStart(
                resumeId ? { type: 'resume', state } : { type: 'fresh' }
              )}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition hover:bg-accent-hover"
            >
              {resumeId ? <PlayCircle size={16} /> : <Play size={16} />}
              {resumeId ? 'Resume session' : 'Start session'}
            </button>
          </div>
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
            <li
              key={s.id}
              ref={(el) => { rowRefs.current[s.id] = el; }}
              className="flex scroll-mt-20 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.name}</div>
                <div className="text-xs text-ink-muted">{s.class}</div>
              </div>

              {mcqTotal > 0 && (
                <SectionChip
                  label="MCQ"
                  done={mcqFilled}
                  total={mcqTotal}
                  onClick={() => handleChipClick(s, 'mcq')}
                />
              )}

              {essayTotal > 0 && (
                <SectionChip
                  label="Essay"
                  done={essayFilled}
                  total={essayTotal}
                  onClick={() => handleChipClick(s, 'essay')}
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

      {editPrompt && (
        <OverwritePrompt
          student={editPrompt.student}
          section={editPrompt.section}
          exam={exam}
          busy={busy}
          onStartOver={() => handleStartOver(editPrompt.student, editPrompt.section)}
          onMoveToOther={() => {
            const { student, section } = editPrompt;
            const other = section === 'mcq' ? 'essay' : 'mcq';
            setEditPrompt(null);
            onStart({
              type: 'student',
              studentId: student.id,
              startPhase: other,
            });
          }}
          onCancel={() => setEditPrompt(null)}
        />
      )}
    </div>
  );
}

function OverwritePrompt({ student, section, exam, busy, onStartOver, onMoveToOther, onCancel }) {
  const isMcq = section === 'mcq';
  const total = isMcq ? exam.mcqCount : exam.essayCount;
  const otherCount = isMcq ? exam.essayCount : exam.mcqCount;
  const hasOther = otherCount > 0;
  const sectionLabel = isMcq ? 'MCQ' : 'essay';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">
          {isMcq ? 'MCQ' : 'Essay'} already completed
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          <b className="text-ink">{student.name}</b> already has all {total}{' '}
          {isMcq ? 'answers' : 'scores'}. If you continue, the entire {sectionLabel} section
          will be cleared and you'll start from question 1.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onStartOver}
            disabled={busy}
            className="rounded-lg bg-rose-500 py-2 font-medium text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? 'Clearing…' : 'Yes, start over'}
          </button>

          {hasOther && (
            <button
              onClick={onMoveToOther}
              disabled={busy}
              className="rounded-lg bg-accent py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
            >
              Move to {isMcq ? 'essay' : 'MCQ'}
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-line-strong py-2 transition hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
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