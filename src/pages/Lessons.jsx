import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Upload, BookOpen, ChevronRight, ChevronDown,
  Pencil, Trash2, Check, X, Layers,
} from 'lucide-react';
import {
  subscribeSubjects, subscribeSubMasteries,
  addSubject, updateSubject, deleteSubject,
  addSubMastery, updateSubMastery, deleteSubMastery,
} from '../lessons';
import ImportLessons from '../ImportLessons';

export default function Lessons() {
  const [subjects, setSubjects] = useState(null);
  const [subs, setSubs]         = useState(null);
  const [expanded, setExpanded] = useState({});
  const [showImport, setShowImport] = useState(false);

  const [newSubjectName, setNewSubjectName] = useState('');
  const [addingSubject, setAddingSubject]   = useState(false);

  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName]   = useState('');

  const [addingSubToId, setAddingSubToId] = useState(null);
  const [newSubName, setNewSubName]       = useState('');

  const [editingSubId, setEditingSubId] = useState(null);
  const [editSubName, setEditSubName]   = useState('');

  useEffect(() => subscribeSubjects(setSubjects), []);
  useEffect(() => subscribeSubMasteries(setSubs), []);

  const subsBySubject = useMemo(() => {
    const map = {};
    (subs ?? []).forEach((s) => {
      (map[s.subjectId] ??= []).push(s);
    });
    return map;
  }, [subs]);

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setAddingSubject(true);
    try {
      await addSubject(newSubjectName);
      setNewSubjectName('');
    } finally {
      setAddingSubject(false);
    }
  }

  async function saveSubjectEdit() {
    if (!editSubjectName.trim()) return;
    await updateSubject(editingSubjectId, editSubjectName);
    setEditingSubjectId(null);
  }

  async function handleDeleteSubject(s) {
    const count = (subsBySubject[s.id] ?? []).length;
    if (!confirm(`Delete "${s.name}" and its ${count} sub-master${count === 1 ? 'y' : 'ies'}?\n\nAny score columns using these will still show but with an unknown topic.`)) return;
    await deleteSubject(s.id);
  }

  async function handleAddSub(subjectId) {
    if (!newSubName.trim()) return;
    await addSubMastery(subjectId, newSubName);
    setNewSubName('');
    setAddingSubToId(null);
  }

  async function saveSubEdit() {
    if (!editSubName.trim()) return;
    await updateSubMastery(editingSubId, editSubName);
    setEditingSubId(null);
  }

  async function handleDeleteSub(sm) {
    if (!confirm(`Delete "${sm.name}"?`)) return;
    await deleteSubMastery(sm.id);
  }

  if (subjects === null || subs === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lessons</h1>
          <span className="text-sm text-ink-muted">
            {subjects.length} subject{subjects.length === 1 ? '' : 's'} ·{' '}
            {subs.length} sub-master{subs.length === 1 ? 'y' : 'ies'}
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
        onSubmit={handleAddSubject}
        className="mb-4 rounded-xl border border-line bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            placeholder="New subject (e.g. Pengenalan Nirmana)"
            className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={addingSubject || !newSubjectName.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus size={16} />
            Add subject
          </button>
        </div>
      </form>

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <BookOpen size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">
            No subjects yet. Add one above or <b className="text-ink">Import</b> from a sheet.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-line bg-card">
          {subjects.map((s) => {
            const isOpen = expanded[s.id];
            const subList = subsBySubject[s.id] ?? [];
            return (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))}
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition hover:bg-muted"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {editingSubjectId === s.id ? (
                    <>
                      <input
                        value={editSubjectName}
                        onChange={(e) => setEditSubjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  saveSubjectEdit();
                          if (e.key === 'Escape') setEditingSubjectId(null);
                        }}
                        autoFocus
                        className="flex-1 rounded-lg border border-accent bg-card px-3 py-1.5 text-ink outline-none"
                      />
                      <button
                        onClick={saveSubjectEdit}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg hover:bg-accent-hover"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingSubjectId(null)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-ink-muted hover:bg-muted"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.name}</div>
                        <div className="text-xs text-ink-muted">
                          {subList.length} sub-master{subList.length === 1 ? 'y' : 'ies'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingSubjectId(s.id);
                          setEditSubjectName(s.name);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                        title="Rename"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(s)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-line bg-muted/40 px-3 py-3 sm:px-4">
                    {subList.length === 0 && (
                      <p className="mb-3 text-sm text-ink-muted">
                        No sub-masteries yet.
                      </p>
                    )}

                    <ul className="mb-3 space-y-1">
                      {subList.map((sm) => (
                        <li key={sm.id} className="flex items-center gap-2">
                          {editingSubId === sm.id ? (
                            <>
                              <input
                                value={editSubName}
                                onChange={(e) => setEditSubName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')  saveSubEdit();
                                  if (e.key === 'Escape') setEditingSubId(null);
                                }}
                                autoFocus
                                className="flex-1 rounded-lg border border-accent bg-card px-3 py-1.5 text-sm text-ink outline-none"
                              />
                              <button
                                onClick={saveSubEdit}
                                className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg hover:bg-accent-hover"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingSubId(null)}
                                className="grid h-7 w-7 place-items-center rounded-lg border border-line-strong text-ink-muted hover:bg-muted"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <Layers size={14} className="shrink-0 text-ink-subtle" />
                              <span className="min-w-0 flex-1 truncate text-sm">{sm.name}</span>
                              <button
                                onClick={() => {
                                  setEditingSubId(sm.id);
                                  setEditSubName(sm.name);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                                title="Rename"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteSub(sm)}
                                className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-rose-500"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>

                    {addingSubToId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')  handleAddSub(s.id);
                            if (e.key === 'Escape') { setAddingSubToId(null); setNewSubName(''); }
                          }}
                          autoFocus
                          placeholder="Sub-mastery name"
                          className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => handleAddSub(s.id)}
                          disabled={!newSubName.trim()}
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingSubToId(null); setNewSubName(''); }}
                          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingSubToId(s.id); setNewSubName(''); }}
                        className="flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-accent"
                      >
                        <Plus size={14} /> Add sub-mastery
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showImport && (
        <ImportLessons
          existingSubjects={subjects}
          existingSubs={subs}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}