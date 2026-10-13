import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { subscribeStudents } from '../students';
import { subscribeExams, createExam, updateExam, deleteExam } from '../exams';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function Exams() {
  const [exams, setExams]       = useState(null);
  const [students, setStudents] = useState(null);
  const [editing, setEditing]   = useState(null);

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
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Exams</h1>
          <span className="text-sm text-ink-muted">
            {exams === null ? '…' : `${exams.length} exam${exams.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
        >
          <Plus size={16} />
          New exam
        </button>
      </div>

      {exams === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <FileSpreadsheet size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">No exams yet. Create one to get started.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {exams.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{e.subject}</span>
                  <StatusPill status={e.status} />
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-muted">
                  {(e.classes ?? []).join(', ') || 'no classes'} · {e.mcqCount} MCQ · {e.essayCount} essay
                </div>
              </div>
              <button
                onClick={() => setEditing(e)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete "${e.subject}"?\nAll responses for this exam will be removed.`)) return;
                  await deleteExam(e.id);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-rose-500"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatusPill({ status }) {
  const cls =
    status === 'active' ? 'bg-emerald-500/15 text-emerald-500'
  : status === 'done'   ? 'bg-muted text-ink-muted'
  :                       'bg-amber-500/15 text-amber-500';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>;
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
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-ink-muted transition hover:text-ink">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-semibold">
          {isNew ? 'New exam' : `Edit ${exam.subject}`}
        </h1>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-card p-4">
        <Field label="Subject name">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Dasar DKV"
            className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Assigned classes">
          {classes.length === 0 ? (
            <p className="text-sm text-ink-subtle">No classes yet — add students first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const on = selectedClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleClass(c)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      on
                        ? 'bg-accent text-accent-fg'
                        : 'border border-line-strong text-ink-muted hover:border-accent hover:text-accent'
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
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </Field>
          <Field label="Options per MCQ">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {[4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOptionCount(n)}
                  className={`flex-1 rounded-md py-1 text-sm font-medium transition ${
                    optionCount === n ? 'bg-card text-ink shadow' : 'text-ink-muted'
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
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </Field>
          <Field label="Passing score">
            <input
              type="number" min="0" max="100"
              value={passing}
              onChange={(e) => setPassing(Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10))))}
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </Field>
        </div>

        <Field label={`MCQ weight (essay gets ${essayWeight}%)`}>
          <input
            type="range" min="0" max="100" step="5"
            value={mcqWeight}
            onChange={(e) => setMcqWeight(parseInt(e.target.value, 10))}
            className="w-full accent-[var(--t-accent)]"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>MCQ {mcqWeight}%</span>
            <span>Essay {essayWeight}%</span>
          </div>
        </Field>
      </div>

      {mcqCount > 0 && (
        <div className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3">
            <div className="font-medium">Answer key (MCQ)</div>
            <div className="text-xs text-ink-muted">
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
        <p className="rounded-lg bg-muted px-4 py-3 text-xs text-ink-muted">
          Essays are scored manually during the correction session (0–10 per essay).
        </p>
      )}

      {err && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Saving…' : isNew ? 'Create exam' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-line-strong px-4 py-2 hover:bg-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

function KeyInput({ count, optionCount, value, onChange }) {
  const validLetters = useMemo(
    () => LETTERS.slice(0, optionCount),
    [optionCount]
  );

  function handleChange(e) {
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
        className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 font-mono text-lg uppercase tracking-widest text-ink outline-none focus:border-accent"
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
                  ? 'border-accent bg-accent-soft text-accent-text'
                  : isNext
                  ? 'border-dashed border-accent text-ink-subtle'
                  : 'border-line text-ink-subtle'
              }`}
            >
              {ch || i + 1}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-ink-muted">
        {value.length} / {count} filled
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}