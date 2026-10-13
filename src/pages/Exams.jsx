import { useEffect, useMemo, useState } from 'react';
import { subscribeStudents } from '../students';
import { subscribeExams, createExam, updateExam, deleteExam } from '../exams';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function Exams() {
  const [exams, setExams]       = useState(null);
  const [students, setStudents] = useState(null);
  const [editing, setEditing]   = useState(null); // null | 'new' | exam object

  useEffect(() => subscribeExams(setExams), []);
  useEffect(() => subscribeStudents(setStudents), []);

  const classes = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map((s) => s.class))].sort();
  }, [students]);

  if (editing) {
    return (
      <ExamForm
        exam={editing === 'new' ? null : editing}
        classes={classes}
        onCancel={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exams</h1>
          <span className="text-sm text-slate-500">
            {exams === null ? '…' : `${exams.length} exam${exams.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New exam
        </button>
      </div>

      {exams === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No exams yet. Create one to get started.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {exams.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{e.subject}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    e.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                    : e.status === 'done' ? 'bg-slate-100 text-slate-600'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {e.status}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500">
                  {(e.classes ?? []).join(', ') || 'no classes'} · {e.mcqCount} MCQ · {e.essayCount} essay
                </div>
              </div>
              <button
                onClick={() => setEditing(e)}
                className="text-sm text-slate-500 hover:text-indigo-600"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete "${e.subject}"?\nAll responses for this exam will be removed.`)) return;
                  await deleteExam(e.id);
                }}
                className="text-sm text-slate-500 hover:text-rose-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- form ---------- */

function ExamForm({ exam, classes, onCancel, onSaved }) {
  const isNew = !exam;

  const [subject, setSubject]           = useState(exam?.subject ?? '');
  const [selectedClasses, setClasses]   = useState(exam?.classes ?? []);
  const [mcqCount, setMcqCount]         = useState(exam?.mcqCount ?? 10);
  const [optionCount, setOptionCount]   = useState(exam?.optionCount ?? 4);
  const [essayCount, setEssayCount]     = useState(exam?.essayCount ?? 3);
  const [mcqWeight, setMcqWeight]       = useState(exam?.mcqWeight ?? 60);
  const [passing, setPassing]           = useState(exam?.passingThreshold ?? 75);
  const [keyStr, setKeyStr]             = useState(() => {
    if (!exam?.key) return '';
    const out = [];
    for (let i = 1; i <= (exam.mcqCount ?? 0); i++) out.push(exam.key[String(i)] ?? '');
    return out.join('');
  });
  const [err, setErr]                   = useState('');
  const [busy, setBusy]                 = useState(false);

  const essayWeight = 100 - mcqWeight;

  function toggleClass(c) {
    setClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function validate() {
    if (!subject.trim())               return 'Subject name is required.';
    if (selectedClasses.length === 0)  return 'Pick at least one class.';
    if (mcqCount + essayCount < 1)     return 'Add at least one question.';
    if (mcqWeight < 0 || mcqWeight > 100) return 'MCQ weight must be 0–100.';
    if (mcqCount > 0 && keyStr.length !== mcqCount)
      return `Answer key incomplete: ${keyStr.length} of ${mcqCount} filled.`;
    return '';
  }

  async function handleSave() {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr('');
    try {
      const key = {};
      for (let i = 0; i < keyStr.length; i++) key[String(i + 1)] = keyStr[i];

      const data = {
        subject: subject.trim(),
        classes: selectedClasses,
        mcqCount: Number(mcqCount),
        optionCount: Number(optionCount),
        essayCount: Number(essayCount),
        mcqWeight: Number(mcqWeight),
        essayWeight,
        passingThreshold: Number(passing),
        key,
      };

      if (isNew) await createExam(data);
      else       await updateExam(exam.id, data);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-slate-900">
          {isNew ? 'New exam' : `Edit ${exam.subject}`}
        </h1>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Subject name">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Dasar DKV"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </Field>

        <Field label="Assigned classes">
          {classes.length === 0 ? (
            <p className="text-sm text-slate-400">No classes yet — add students first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const on = selectedClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleClass(c)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      on
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-300 text-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="MCQ questions">
            <input
              type="number" min="0" max="100"
              value={mcqCount}
              onChange={(e) => setMcqCount(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </Field>
          <Field label="Options per MCQ">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {[4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOptionCount(n)}
                  className={`flex-1 rounded-md py-1 text-sm font-medium ${
                    optionCount === n ? 'bg-white shadow' : 'text-slate-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Essay questions">
            <input
              type="number" min="0" max="50"
              value={essayCount}
              onChange={(e) => setEssayCount(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </Field>
          <Field label="Passing score">
            <input
              type="number" min="0" max="100"
              value={passing}
              onChange={(e) => setPassing(Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10))))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </Field>
        </div>

        <Field label={`MCQ weight (essay gets ${essayWeight}%)`}>
          <input
            type="range" min="0" max="100" step="5"
            value={mcqWeight}
            onChange={(e) => setMcqWeight(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>MCQ {mcqWeight}%</span>
            <span>Essay {essayWeight}%</span>
          </div>
        </Field>
      </div>

      {mcqCount > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="font-medium text-slate-900">Answer key (MCQ)</div>
            <div className="text-xs text-slate-500">
              Type or paste the letters in order. Only A–{LETTERS[optionCount - 1]}. Backspace to delete.
            </div>
          </div>
          <KeyInput
            count={mcqCount}
            optionCount={optionCount}
            value={keyStr}
            onChange={setKeyStr}
          />
        </div>
      )}

      {essayCount > 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Essays are scored manually during the correction session (0–10 per essay).
        </p>
      )}

      {err && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : isNew ? 'Create exam' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- rapid-fire key input ---------- */

function KeyInput({ count, optionCount, value, onChange }) {
  const validLetters = useMemo(
    () => LETTERS.slice(0, optionCount),
    [optionCount]
  );

  function handleChange(e) {
    // Filter first (drops invalid chars, works for paste), then cap length.
    let v = e.target.value.toUpperCase();
    v = v.split('').filter((c) => validLetters.includes(c)).join('');
    v = v.slice(0, count);
    onChange(v);
  }

  return (
    <div>
      <input
        value={value}
        onChange={handleChange}
        placeholder={`e.g. ${'DACBE'.padEnd(count, 'A').slice(0, count)}`}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg uppercase tracking-widest outline-none focus:border-indigo-500"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: count }).map((_, i) => {
          const ch = value[i];
          const isNext = i === value.length;
          return (
            <div
              key={i}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold ${
                ch
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : isNext
                  ? 'border-dashed border-indigo-400 text-slate-300'
                  : 'border-slate-200 text-slate-300'
              }`}
            >
              {ch || i + 1}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {value.length} / {count} filled
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}