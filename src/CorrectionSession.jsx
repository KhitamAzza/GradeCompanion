import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, ChevronLeft, UserX, CheckCircle2, XCircle, Trophy,
} from 'lucide-react';
import { saveResponse, saveState, clearState, computeScore } from './correction';
import SyncBadge from './SyncBadge';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const BLANK   = '-';

export default function CorrectionSession({
  exam, students, responses, mode, onExit,
}) {
  const mcqCount   = exam.mcqCount   ?? 0;
  const essayCount = exam.essayCount ?? 0;

  const firstPending = useMemo(
    () => students.find((s) => !responses[s.id])?.id ?? students[0]?.id ?? null,
    [students, responses]
  );

  const [studentId, setStudentId] = useState(() => {
    if (mode.type === 'student') return mode.studentId;
    if (mode.type === 'resume')  return mode.state.studentId;
    return firstPending;
  });

  const [phase, setPhase] = useState(() => {
    if (mode.type === 'resume' && mode.state.phase) return mode.state.phase;
    return mcqCount > 0 ? 'mcq' : 'essay';
  });

  const [answers, setAnswers] = useState(() => {
    if (mode.type === 'resume')  return mode.state.answers ?? {};
    if (mode.type === 'student') return responses[mode.studentId]?.answers ?? {};
    return {};
  });

  const [essayScores, setEssayScores] = useState(() => {
    if (mode.type === 'resume')  return mode.state.essayScores ?? {};
    if (mode.type === 'student') return responses[mode.studentId]?.essayScores ?? {};
    return {};
  });

  const [mcqIndex, setMcqIndex] = useState(() =>
    mode.type === 'resume' ? (mode.state.mcqIndex ?? 0) : 0);
  const [essayIndex, setEssayIndex] = useState(() =>
    mode.type === 'resume' ? (mode.state.essayIndex ?? 0) : 0);

  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [editSummaryQ, setEditSummaryQ] = useState(null);

  const currentStudent = students.find((s) => s.id === studentId) ?? null;
  const currentIndex   = students.findIndex((s) => s.id === studentId);
  const doneCount      = students.filter((s) => responses[s.id] && !responses[s.id].absent).length;

  const computed = useMemo(
    () => computeScore(exam, answers, essayScores),
    [exam, answers, essayScores]
  );

  useEffect(() => {
    if (!studentId) return;
    if (phase === 'studentSummary') return;
    const t = setTimeout(() => {
      saveState(exam.id, { studentId, phase, answers, essayScores, mcqIndex, essayIndex })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [exam.id, studentId, phase, answers, essayScores, mcqIndex, essayIndex]);

  const ref = useRef({});
  ref.current = { phase, editSummaryQ, mcqIndex, exam, answerMcq };

  useEffect(() => {
    function onKey(e) {
      const s = ref.current;
      if (s.phase !== 'mcq' || s.editSummaryQ) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const limit = s.exam.optionCount ?? 4;
      const letters = LETTERS.slice(0, limit);
      const k = e.key.toUpperCase();

      if (letters.includes(k)) { e.preventDefault(); s.answerMcq(k); return; }

      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= limit) {
        e.preventDefault(); s.answerMcq(letters[n - 1]); return;
      }
      if (e.key === '0' || e.key === ' ') { e.preventDefault(); s.answerMcq(BLANK); return; }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (s.mcqIndex > 0) setMcqIndex(s.mcqIndex - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function answerMcq(letter) {
    const q = String(mcqIndex + 1);
    setAnswers((prev) => ({ ...prev, [q]: letter }));

    if (editSummaryQ) {
      setEditSummaryQ(null);
      setPhase('mcqSummary');
      return;
    }
    if (mcqIndex + 1 < mcqCount) setMcqIndex(mcqIndex + 1);
    else                         setPhase('mcqSummary');
  }

  function scoreEssay(v) {
    const q = String(essayIndex + 1);
    const clamped = Math.max(0, Math.min(10, v));
    setEssayScores((prev) => ({ ...prev, [q]: clamped }));
  }

  function essayNext() {
    if (essayIndex + 1 < essayCount) setEssayIndex(essayIndex + 1);
    else                             finishStudent();
  }
  function essayPrev() {
    if (essayIndex > 0) setEssayIndex(essayIndex - 1);
  }

  async function finishStudent() {
    const { mcqCorrect, mcqScore, essayScore, totalScore, passed } =
      computeScore(exam, answers, essayScores);

    setSaving(true);
    try {
      await saveResponse(exam.id, currentStudent.id, {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        studentClass: currentStudent.class,
        answers,
        essayScores,
        mcqCorrect, mcqScore, essayScore, totalScore, passed,
        absent: false,
      });
      await clearState(exam.id);
      setPhase('studentSummary');
    } finally {
      setSaving(false);
    }
  }

  function advanceToStudent(id) {
    setStudentId(id);
    setPhase(mcqCount > 0 ? 'mcq' : 'essay');
    setAnswers({});
    setEssayScores({});
    setMcqIndex(0);
    setEssayIndex(0);
    setEditSummaryQ(null);
  }

  function nextStudent() {
    const next = students[currentIndex + 1];
    if (!next) { onExit('complete'); return; }
    advanceToStudent(next.id);
  }

  async function markAbsent() {
    if (!currentStudent) return;
    if (!confirm(`Mark ${currentStudent.name} as absent?`)) return;
    await saveResponse(exam.id, currentStudent.id, {
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      studentClass: currentStudent.class,
      absent: true,
      answers: {}, essayScores: {},
      mcqCorrect: 0, mcqScore: 0, essayScore: 0, totalScore: 0, passed: false,
    });
    nextStudent();
  }

  async function handleExit() {
    if (phase !== 'studentSummary' && currentStudent) {
      await saveState(exam.id, {
        studentId, phase, answers, essayScores, mcqIndex, essayIndex,
      }).catch(() => {});
    }
    onExit('exit');
  }

  if (!currentStudent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas p-6">
        <div className="text-center">
          <p className="text-ink-muted">No students to correct.</p>
          <button onClick={() => onExit('exit')}
            className="mt-4 rounded-lg border border-line-strong px-4 py-2 hover:bg-muted">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <button onClick={() => setConfirmExit(true)}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink"
          aria-label="Exit">
          <X size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{currentStudent.name}</div>
          <div className="truncate text-xs text-ink-muted">
            {currentStudent.class} · {currentIndex + 1} / {students.length} · {doneCount} done
          </div>
        </div>
        <SyncBadge />
      </header>

      <main className="flex-1 overflow-auto p-4">
        {phase === 'mcq' && (
          <McqStep exam={exam} mcqIndex={mcqIndex} answers={answers}
            onPick={answerMcq}
            onBack={() => mcqIndex > 0 && setMcqIndex(mcqIndex - 1)}
            onSummary={() => setPhase('mcqSummary')} />
        )}

        {phase === 'mcqSummary' && (
          <McqSummary exam={exam} answers={answers}
            onEdit={(q) => {
              setEditSummaryQ(String(q));
              setMcqIndex(q - 1);
              setPhase('mcq');
            }}
            onContinue={() => {
              if (essayCount > 0) { setEssayIndex(0); setPhase('essay'); }
              else                { finishStudent(); }
            }} />
        )}

        {phase === 'essay' && (
          <EssayStep exam={exam} essayIndex={essayIndex} essayScores={essayScores}
            onChange={scoreEssay}
            onPrev={essayPrev}
            onNext={essayNext} />
        )}

        {phase === 'studentSummary' && (
          <StudentSummary
            student={currentStudent}
            exam={exam}
            result={computed}
            essayScores={essayScores}
            onNext={nextStudent}
            isLast={currentIndex + 1 >= students.length}
          />
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-line bg-card px-4 py-2 text-xs text-ink-muted">
        <button onClick={markAbsent}
          className="inline-flex items-center gap-1.5 transition hover:text-amber-500">
          <UserX size={13} /> Mark absent
        </button>
        {saving && <span>Saving…</span>}
      </footer>

      {confirmExit && (
        <ConfirmDialog
          title="Exit session?"
          body="Your progress is saved. You can resume later from this exam."
          confirmLabel="Exit"
          onCancel={() => setConfirmExit(false)}
          onConfirm={async () => { setConfirmExit(false); await handleExit(); }}
        />
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function McqStep({ exam, mcqIndex, answers, onPick, onBack, onSummary }) {
  const q       = String(mcqIndex + 1);
  const current = answers[q];
  const limit   = exam.optionCount ?? 4;
  const letters = LETTERS.slice(0, limit);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-1 text-sm text-ink-muted">Question</div>
      <div className="mb-6 text-3xl font-semibold">
        {mcqIndex + 1}
        <span className="ml-2 text-xl text-ink-subtle">/ {exam.mcqCount}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {letters.map((L) => (
          <button key={L} onClick={() => onPick(L)}
            className={`rounded-xl border py-6 text-2xl font-semibold transition ${
              current === L
                ? 'border-accent bg-accent-soft text-accent-text'
                : 'border-line-strong bg-card hover:border-accent'
            }`}>{L}</button>
        ))}
        <button onClick={() => onPick(BLANK)}
          className={`rounded-xl border py-6 text-lg font-medium transition ${
            current === BLANK
              ? 'border-accent bg-accent-soft text-accent-text'
              : 'border-line-strong bg-card text-ink-muted hover:border-line-strong'
          }`}>Blank</button>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} disabled={mcqIndex === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-40">
          <ChevronLeft size={14} /> Previous
        </button>
        <button onClick={onSummary} className="text-sm text-ink-muted transition hover:text-accent">
          Skip to summary
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-ink-subtle">
        Tap a letter. Desktop: A–{letters[letters.length - 1]} or 1–{limit} to pick, 0 or Space = blank, Backspace = back.
      </p>
    </div>
  );
}

function McqSummary({ exam, answers, onEdit, onContinue }) {
  const items = [];
  for (let i = 1; i <= exam.mcqCount; i++) {
    items.push({ q: i, a: answers[String(i)] });
  }
  const filled  = items.filter((it) => it.a !== undefined).length;
  const allDone = filled === exam.mcqCount;

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-1 text-xl font-semibold">Review MCQ answers</h2>
      <p className="mb-5 text-sm text-ink-muted">
        Tap any question to change. {filled}/{exam.mcqCount} answered.
      </p>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {items.map(({ q, a }) => (
          <button key={q} onClick={() => onEdit(q)}
            className={`rounded-lg border px-2 py-2 text-sm transition ${
              a === undefined
                ? 'border-dashed border-line-strong text-ink-subtle hover:border-accent'
                : 'border-line-strong bg-card hover:border-accent'
            }`}>
            <div className="text-[10px] text-ink-subtle">Q{q}</div>
            <div className="font-semibold">
              {a === undefined ? '–' : a === BLANK ? '·' : a}
            </div>
          </button>
        ))}
      </div>

      <button onClick={onContinue} disabled={!allDone}
        className="mt-6 w-full rounded-lg bg-accent py-3 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50">
        {exam.essayCount > 0 ? 'Continue to essays →' : 'Finish student →'}
      </button>
      {!allDone && (
        <p className="mt-2 text-center text-xs text-amber-500">
          Answer all {exam.mcqCount} questions to continue.
        </p>
      )}
    </div>
  );
}

function EssayStep({ exam, essayIndex, essayScores, onChange, onNext, onPrev }) {
  const q   = String(essayIndex + 1);
  const val = essayScores[q];

  const stateRef = useRef({});
  stateRef.current = { onChange, onNext, onPrev };

  const pendingOneRef = useRef(false);
  const waitTimerRef  = useRef(null);
  const advTimerRef   = useRef(null);

  useEffect(() => {
    pendingOneRef.current = false;
    if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
    if (advTimerRef.current)  { clearTimeout(advTimerRef.current);  advTimerRef.current  = null; }
  }, [essayIndex]);

  function commit(value) {
    stateRef.current.onChange(value);
    if (advTimerRef.current) clearTimeout(advTimerRef.current);
    advTimerRef.current = setTimeout(() => {
      stateRef.current.onNext();
    }, 100);
  }

  function handleDigit(d) {
    if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
    const wasPendingOne = pendingOneRef.current;
    pendingOneRef.current = false;

    if (d === 0 && wasPendingOne) { commit(10); return; }

    if (d === 1) {
      pendingOneRef.current = true;
      stateRef.current.onChange(1);
      waitTimerRef.current = setTimeout(() => {
        pendingOneRef.current = false;
        stateRef.current.onNext();
      }, 400);
      return;
    }

    commit(d);
  }

  function handleButton(n) {
    if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
    pendingOneRef.current = false;
    commit(n);
  }

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        stateRef.current.onPrev();
        return;
      }
      const n = parseInt(e.key, 10);
      if (isNaN(n) || n < 0 || n > 9) return;
      e.preventDefault();
      handleDigit(n);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <div className="text-sm text-ink-muted">Essay</div>
        <div className="text-2xl font-semibold">
          {essayIndex + 1}
          <span className="ml-2 text-lg text-ink-subtle">/ {exam.essayCount}</span>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-card p-6 text-center">
        <div className="text-xs text-ink-muted">Score (0–10)</div>
        <div
          className={`mt-2 text-6xl font-bold tabular-nums ${
            val === undefined ? 'text-ink-subtle' : 'text-accent'
          }`}
        >
          {val ?? '—'}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleButton(i)}
            className={`h-14 rounded-lg text-lg font-semibold transition ${
              val === i
                ? 'bg-accent text-accent-fg'
                : 'border border-line-strong bg-card text-ink hover:border-accent active:bg-accent-soft'
            }`}
          >
            {i}
          </button>
        ))}
        <button
          onClick={() => handleButton(10)}
          className={`col-span-2 h-14 rounded-lg text-lg font-semibold transition ${
            val === 10
              ? 'bg-accent text-accent-fg'
              : 'border border-line-strong bg-card text-ink hover:border-accent active:bg-accent-soft'
          }`}
        >
          10
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={essayIndex === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-4 py-2 text-sm transition hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        {val !== undefined && (
          <button
            onClick={onNext}
            className="ml-auto rounded-lg border border-line-strong px-4 py-2 text-sm text-ink-muted transition hover:border-accent hover:text-accent"
          >
            Next →
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-ink-subtle">
        Tap a score to advance. Desktop: 0–9, or 1 then 0 for 10. Backspace = previous essay.
      </p>
    </div>
  );
}

function StudentSummary({ student, exam, result, essayScores, onNext, isLast }) {
  const essaySum = exam.essayWeight
    ? Math.round((result.essayScore / exam.essayWeight) * exam.essayCount * 10)
    : 0;

  const PassIcon = result.passed ? CheckCircle2 : XCircle;
  const passColor = result.passed ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <div className="text-sm text-ink-muted">{student.class}</div>
        <div className="text-xl font-semibold">{student.name}</div>
      </div>

      <div className="rounded-xl border border-line bg-card p-6 text-center">
        <div className="mb-2 flex justify-center">
          <div className={`grid h-12 w-12 place-items-center rounded-full ${
            result.passed ? 'bg-emerald-500/15' : 'bg-rose-500/15'
          }`}>
            <Trophy size={22} className={passColor} />
          </div>
        </div>
        <div className="text-sm text-ink-muted">Final score</div>
        <div className={`mt-2 text-6xl font-bold ${passColor}`}>
          {result.totalScore}
        </div>
        <div className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${passColor}`}>
          <PassIcon size={14} />
          {result.passed ? 'PASSED' : 'FAILED'} · threshold {exam.passingThreshold}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {exam.mcqCount > 0 && (
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="text-xs text-ink-muted">MCQ</div>
            <div className="text-lg font-semibold">
              {result.mcqCorrect} / {exam.mcqCount}
            </div>
            <div className="text-xs text-ink-muted">
              {result.mcqScore} / {exam.mcqWeight}
            </div>
          </div>
        )}
        {exam.essayCount > 0 && (
          <div className="rounded-xl border border-line bg-card p-4">
            <div className="text-xs text-ink-muted">Essay</div>
            <div className="text-lg font-semibold">
              {essaySum} / {exam.essayCount * 10}
            </div>
            <div className="text-xs text-ink-muted">
              {result.essayScore} / {exam.essayWeight}
            </div>
          </div>
        )}
      </div>

      <button onClick={onNext}
        className="mt-6 w-full rounded-lg bg-accent py-3 font-medium text-accent-fg transition hover:bg-accent-hover">
        {isLast ? 'Finish session' : 'Next student →'}
      </button>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {body && <p className="mt-2 text-sm text-ink-muted">{body}</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 rounded-lg border border-line-strong py-2 hover:bg-muted">Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 rounded-lg bg-accent py-2 font-medium text-accent-fg hover:bg-accent-hover">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}