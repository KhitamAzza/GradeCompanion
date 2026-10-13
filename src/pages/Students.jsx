import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Upload, Pencil, Trash2, Check, X, Users } from 'lucide-react';
import {
  subscribeStudents, addStudent, updateStudent, deleteStudent,
} from '../students';
import ImportStudents from '../ImportStudents';

export default function Students() {
  const [students, setStudents] = useState(null);
  const [classFilter, setClassFilter] = useState('all');

  const [name, setName] = useState('');
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCls, setEditCls] = useState('');

  const [showImport, setShowImport] = useState(false);

  useEffect(() => subscribeStudents(setStudents), []);

  const classes = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map((s) => s.class))].sort();
  }, [students]);

  const visible = useMemo(() => {
    if (!students) return [];
    return classFilter === 'all'
      ? students
      : students.filter((s) => s.class === classFilter);
  }, [students, classFilter]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !cls.trim()) return;
    setBusy(true);
    try {
      await addStudent(name, cls);
      setName('');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditCls(s.class);
  }

  async function saveEdit() {
    if (!editName.trim() || !editCls.trim()) return;
    await updateStudent(editingId, {
      name: editName.trim(),
      class: editCls.trim(),
    });
    setEditingId(null);
  }

  async function handleDelete(s) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    await deleteStudent(s.id);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <span className="text-sm text-ink-muted">
            {students === null ? '…' : `${visible.length} shown`}
          </span>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Import</span>
        </button>
      </div>

      <form
        onSubmit={handleAdd}
        className="mb-4 rounded-xl border border-line bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Student name"
            className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <input
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            placeholder="Class (e.g. XI-IPA-1)"
            list="class-options"
            className="rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent sm:w-48"
          />
          <datalist id="class-options">
            {classes.map((c) => <option key={c} value={c} />)}
          </datalist>
          <button
            type="submit"
            disabled={busy || !name.trim() || !cls.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <UserPlus size={16} />
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-subtle">
          The class field is remembered after adding, so you can enter a whole roster quickly.
        </p>
      </form>

      {classes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip
            active={classFilter === 'all'}
            onClick={() => setClassFilter('all')}
          >
            All
          </FilterChip>
          {classes.map((c) => (
            <FilterChip
              key={c}
              active={classFilter === c}
              onClick={() => setClassFilter(c)}
            >
              {c}
            </FilterChip>
          ))}
        </div>
      )}

      {students === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {visible.map((s) => (
            <li key={s.id} className="p-3">
              {editingId === s.id ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-ink outline-none focus:border-accent"
                  />
                  <input
                    value={editCls}
                    onChange={(e) => setEditCls(e.target.value)}
                    className="rounded-lg border border-line-strong bg-card px-3 py-1.5 text-ink outline-none focus:border-accent sm:w-40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-ink-muted">{s.class}</div>
                  </div>
                  <button
                    onClick={() => startEdit(s)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-rose-500"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showImport && students !== null && (
        <ImportStudents
          existing={students}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
      <Users size={48} className="text-ink-subtle" strokeWidth={1.5} />
      <p className="text-ink-muted">No students yet. Add one above or import a file.</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-accent text-accent-fg'
          : 'border border-line-strong bg-card text-ink-muted hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}