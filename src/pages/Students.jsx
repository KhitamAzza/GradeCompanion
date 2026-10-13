import ImportStudents from '../ImportStudents';
import { useEffect, useMemo, useState } from 'react';
import {
  subscribeStudents, addStudent, updateStudent, deleteStudent,
} from '../students';


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
      setName(''); // keep class so you can add the next student in the same class fast
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
    if (!confirm(`Delete "${s.name}"?\n\nTheir daily scores and exam responses will stay in the database but won't be shown in lists.`)) return;
    await deleteStudent(s.id);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
    <span className="text-sm text-slate-500">
      {students === null ? '…' : `${visible.length} shown`}
    </span>
  </div>
  <button
    onClick={() => setShowImport(true)}
    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
  >
    Import
  </button>
</div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Student name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <input
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            placeholder="Class (e.g. XI-IPA-1)"
            list="class-options"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 sm:w-48"
          />
          <datalist id="class-options">
            {classes.map((c) => <option key={c} value={c} />)}
          </datalist>
          <button
            disabled={busy || !name.trim() || !cls.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Tip: the class field is remembered after adding, so you can enter a whole roster quickly.
        </p>
      </form>

      {/* Class filter chips */}
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

      {/* List */}
      {students === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {students.length === 0
            ? 'No students yet. Add one above.'
            : 'No students in this class.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visible.map((s) => (
            <li key={s.id} className="p-3">
              {editingId === s.id ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editCls}
                    onChange={(e) => setEditCls(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-indigo-500 sm:w-40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.class}</div>
                  </div>
                  <button
                    onClick={() => startEdit(s)}
                    className="text-sm text-slate-500 hover:text-indigo-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="text-sm text-slate-500 hover:text-rose-600"
                  >
                    Delete
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

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
      }`}
    >
      {children}
    </button>
  );
}