import { useEffect, useMemo, useRef, useState } from 'react';
import { saveResponse, saveState, clearState, computeScore } from './correction';
import SyncBadge from './SyncBadge';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const BLANK   = '-';   // marker for "explicitly blank", distinct from unanswered

export default function CorrectionSession({
  exam,
  students,            // ordered list of { id, name, class } for this exam's classes
  responses,           // map studentId -> response
  mode,                // { type: 'fresh' | 'resume' | 'student', studentId?, state? }
  onExit,              // (reason: 'exit' | 'complete') => void
}) {
  const mcqCount   = exam.mcqCount   ?? 0;
  const essayCount = exam.essayCount ?? 0;

  const firstPending = useMemo(
    () => students.find((s) => !responses[s.id])?.id ?? students[0]?.id ?? null,
    [students, responses]
  );

  /* ---------- state initialisation (from mode) ---------- */

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

  /* ---------- debounced cursor save ---------- */

  useEffect(() => {
    if (!studentId) return;
    if (phase === 'studentSummary') return; // this student is finished, cursor cleared below
    const t = setTimeout(() => {
      saveState(exam.id, { studentId, phase, answers, essayScores, mcqIndex, essayIndex })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [exam.id, studentId, phase, answers, essayScores, mcqIndex, essayIndex]);

  /* ---------- keyboard (desktop) ---------- */

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

  /* ---------- actions ---------- */

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

  /* ---------- render ---------- */

  if (!currentStudent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <p className="text-slate-600">No students to correct.</p>
          <button onClick={() => onExit('exit')}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={() => setConfirmExit(true)}
          className="text-lg text-slate-400 hover:text-slate-900" aria-label="Exit">✕</button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-900">{currentStudent.name}</div>
          <div className="truncate text-xs text-slate-500">
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
            onNext={essayNext}
            isLast={essayIndex + 1 >= essayCount} />
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

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <button onClick={markAbsent} className="hover:text-rose-600">Mark absent</button>
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
      <div className="mb-1 text-sm text-slate-500">Question</div>
      <div className="mb-6 text-3xl font-semibold text-slate-900">
        {mcqIndex + 1}
        <span className="ml-2 text-xl text-slate-400">/ {exam.mcqCount}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {letters.map((L) => (
          <button key={L} onClick={() => onPick(L)}
            className={`rounded-xl border py-6 text-2xl font-semibold transition ${
              current === L
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white hover:border-indigo-400'
            }`}>{L}</button>
        ))}
        <button onClick={() => onPick(BLANK)}
          className={`rounded-xl border py-6 text-lg font-medium transition ${
            current === BLANK
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
          }`}>Blank</button>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} disabled={mcqIndex === 0}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">
          ← Previous
        </button>
        <button onClick={onSummary} className="text-sm text-slate-500 hover:text-indigo-600">
          Skip to summary
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
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
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Review MCQ answers</h2>
      <p className="mb-5 text-sm text-slate-500">
        Tap any question to change. {filled}/{exam.mcqCount} answered.
      </p>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {items.map(({ q, a }) => (
          <button key={q} onClick={() => onEdit(q)}
            className={`rounded-lg border px-2 py-2 text-sm ${
              a === undefined
                ? 'border-dashed border-slate-300 text-slate-300'
                : 'border-slate-300 bg-white text-slate-900 hover:border-indigo-400'
            }`}>
            <div className="text-[10px] text-slate-400">Q{q}</div>
            <div className="font-semibold">
              {a === undefined ? '–' : a === BLANK ? '·' : a}
            </div>
          </button>
        ))}
      </div>

      <button onClick={onContinue} disabled={!allDone}
        className="mt-6 w-full rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {exam.essayCount > 0 ? 'Continue to essays →' : 'Finish student →'}
      </button>
      {!allDone && (
        <p className="mt-2 text-center text-xs text-amber-600">
          Answer all {exam.mcqCount} questions to continue.
        </p>
      )}
    </div>
  );
}

function EssayStep({ exam, essayIndex, essayScores, onChange, onNext, onPrev }) {
  const q   = String(essayIndex + 1);
  const val = essayScores[q];

  // Latest props in a ref so the keyboard listener can stay mounted once.
  const stateRef = useRef({});
  stateRef.current = { onChange, onNext, onPrev };

  const pendingOneRef = useRef(false);
  const waitTimerRef  = useRef(null);
  const advTimerRef   = useRef(null);

  // Reset pending state when the essay changes.
  useEffect(() => {
    pendingOneRef.current = false;
    if (waitTimerRef.current) { clearTimeout(waitTimerRef.current); waitTimerRef.current = null; }
    if (advTimerRef.current)  { clearTimeout(advTimerRef.current);  advTimerRef.current  = null; }
  }, [essayIndex]);

  function commit(value) {
    stateRef.current.onChange(value);
    if (advTimerRef.current) clearTimeout(advTimerRef.current);
    // Tiny delay so the tapped number flashes before the screen changes.
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

  // Desktop keyboard: 0-9 → score, 1 then 0 → 10, Backspace → previous essay.
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
        <div className="text-sm text-slate-500">Essay</div>
        <div className="text-2xl font-semibold text-slate-900">
          {essayIndex + 1}
          <span className="ml-2 text-lg text-slate-400">/ {exam.essayCount}</span>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <div className="text-xs text-slate-500">Score (0–10)</div>
        <div
          className={`mt-2 text-6xl font-bold tabular-nums ${
            val === undefined ? 'text-slate-300' : 'text-indigo-600'
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
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:border-indigo-400 active:bg-indigo-50'
            }`}
          >
            {i}
          </button>
        ))}
        <button
          onClick={() => handleButton(10)}
          className={`col-span-2 h-14 rounded-lg text-lg font-semibold transition ${
            val === 10
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:border-indigo-400 active:bg-indigo-50'
          }`}
        >
          10
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onPrev}
          disabled={essayIndex === 0}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
        >
          ← Previous
        </button>
        {val !== undefined && (
          <button
            onClick={onNext}
            className="ml-auto rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            Next →
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Tap a score to advance. Desktop: 0–9, or 1 then 0 for 10. Backspace = previous essay.
      </p>
    </div>
  );
}

function StudentSummary({ student, exam, result, essayScores, onNext, isLast }) {
  const essaySum = exam.essayWeight
  ? Math.round((result.essayScore / exam.essayWeight) * exam.essayCount * 10)
  : 0;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <div className="text-sm text-slate-500">{student.class}</div>
        <div className="text-xl font-semibold text-slate-900">{student.name}</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <div className="text-sm text-slate-500">Final score</div>
        <div className={`mt-2 text-6xl font-bold ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
          {result.totalScore}
        </div>
        <div className={`mt-1 text-sm font-medium ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
          {result.passed ? 'PASSED' : 'FAILED'} · threshold {exam.passingThreshold}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {exam.mcqCount > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">MCQ</div>
            <div className="text-lg font-semibold text-slate-900">
              {result.mcqCorrect} / {exam.mcqCount}
            </div>
            <div className="text-xs text-slate-500">
              {result.mcqScore} / {exam.mcqWeight}
            </div>
          </div>
        )}
        {exam.essayCount > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Essay</div>
            <div className="text-lg font-semibold text-slate-900">
              {essaySum} / {exam.essayCount * 10}
            </div>
            <div className="text-xs text-slate-500">
              {result.essayScore} / {exam.essayWeight}
            </div>
          </div>
        )}
      </div>

      <button onClick={onNext}
        className="mt-6 w-full rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700">
        {isLast ? 'Finish session' : 'Next student →'}
      </button>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {body && <p className="mt-2 text-sm text-slate-600">{body}</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-300 py-2">Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 rounded-lg bg-indigo-600 py-2 font-medium text-white">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}