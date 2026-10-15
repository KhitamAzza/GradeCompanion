import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Upload, BookOpen, ChevronRight, ChevronDown,
  Pencil, Trash2, Check, X, Layers, Target,
} from 'lucide-react';
import {
  subscribeSubjects, subscribeCompetencies, subscribeIndicators,
  addSubject, updateSubject, deleteSubject,
  addCompetency, updateCompetency, deleteCompetency,
  addIndicator, updateIndicator, deleteIndicator,
} from '../lessons';
import ImportLessons from '../ImportLessons';

export default function Lessons() {
  const [subjects, setSubjects] = useState(null);
  const [comps, setComps]       = useState(null);
  const [inds, setInds]         = useState(null);
  const [showImport, setShowImport] = useState(false);

  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedComps, setExpandedComps]       = useState({});

  const [newSubjectName, setNewSubjectName] = useState('');
  const [addingSubject, setAddingSubject]   = useState(false);

  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName]   = useState('');

  const [addingCompToSubjectId, setAddingCompToSubjectId] = useState(null);
  const [newCompName, setNewCompName] = useState('');

  const [editingCompId, setEditingCompId] = useState(null);
  const [editCompName, setEditCompName]   = useState('');

  const [addingIndToCompId, setAddingIndToCompId] = useState(null);
  const [newIndName, setNewIndName] = useState('');

  const [editingIndId, setEditingIndId] = useState(null);
  const [editIndName, setEditIndName]   = useState('');

  useEffect(() => subscribeSubjects(setSubjects), []);
  useEffect(() => subscribeCompetencies(setComps), []);
  useEffect(() => subscribeIndicators(setInds), []);

  const compsBySubject = useMemo(() => {
    const m = {};
    (comps ?? []).forEach((c) => { (m[c.subjectId] ??= []).push(c); });
    return m;
  }, [comps]);

  const indsByComp = useMemo(() => {
    const m = {};
    (inds ?? []).forEach((i) => { (m[i.competencyId] ??= []).push(i); });
    return m;
  }, [inds]);

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
    const cCount = (compsBySubject[s.id] ?? []).length;
    if (!confirm(`Delete "${s.name}" and all its competencies and indicators?`)) return;
    await deleteSubject(s.id);
  }

  async function handleAddComp(subjectId) {
    if (!newCompName.trim()) return;
    await addCompetency(subjectId, newCompName);
    setNewCompName('');
    setAddingCompToSubjectId(null);
  }

  async function saveCompEdit() {
    if (!editCompName.trim()) return;
    await updateCompetency(editingCompId, editCompName);
    setEditingCompId(null);
  }

  async function handleDeleteComp(c) {
    const iCount = (indsByComp[c.id] ?? []).length;
    if (!confirm(`Delete "${c.name}" and its ${iCount} indicator${iCount === 1 ? '' : 's'}?`)) return;
    await deleteCompetency(c.id);
  }

  async function handleAddInd(compId) {
    if (!newIndName.trim()) return;
    await addIndicator(compId, newIndName);
    setNewIndName('');
    setAddingIndToCompId(null);
  }

  async function saveIndEdit() {
    if (!editIndName.trim()) return;
    await updateIndicator(editingIndId, editIndName);
    setEditingIndId(null);
  }

  async function handleDeleteInd(i) {
    if (!confirm(`Delete "${i.name}"?`)) return;
    await deleteIndicator(i.id);
  }

  if (subjects === null || comps === null || inds === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lessons</h1>
          <span className="text-sm text-ink-muted">
            {subjects.length} subject{subjects.length === 1 ? '' : 's'} ·{' '}
            {comps.length} competenc{comps.length === 1 ? 'y' : 'ies'} ·{' '}
            {inds.length} indicator{inds.length === 1 ? '' : 's'}
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

      <form onSubmit={handleAddSubject} className="mb-4 rounded-xl border border-line bg-card p-4">
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
        <ul className="space-y-2">
          {subjects.map((s) => {
            const sOpen = expandedSubjects[s.id];
            const subjComps = compsBySubject[s.id] ?? [];
            return (
              <li key={s.id} className="overflow-hidden rounded-xl border border-line bg-card">
                {/* --- SUBJECT ROW --- */}
                <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  <button
                    onClick={() => setExpandedSubjects((e) => ({ ...e, [s.id]: !e[s.id] }))}
                    className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition hover:bg-muted"
                    aria-label={sOpen ? 'Collapse' : 'Expand'}
                  >
                    {sOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
                      <button onClick={saveSubjectEdit}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg hover:bg-accent-hover">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingSubjectId(null)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-ink-muted hover:bg-muted">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.name}</div>
                        <div className="text-xs text-ink-muted">
                          {subjComps.length} competenc{subjComps.length === 1 ? 'y' : 'ies'}
                        </div>
                      </div>
                      <button
                        onClick={() => { setEditingSubjectId(s.id); setEditSubjectName(s.name); }}
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

                {/* --- COMPETENCIES --- */}
                {sOpen && (
                  <div className="border-t border-line bg-muted/30 p-3 sm:p-4">
                    {subjComps.length === 0 && (
                      <p className="mb-3 text-sm text-ink-muted">No competencies yet.</p>
                    )}

                    <ul className="mb-3 space-y-2">
                      {subjComps.map((c) => {
                        const cOpen = expandedComps[c.id];
                        const cInds = indsByComp[c.id] ?? [];
                        return (
                          <li key={c.id} className="rounded-lg border border-line bg-card">
                            {/* COMPETENCY ROW */}
                            <div className="flex items-center gap-2 px-2.5 py-2">
                              <button
                                onClick={() => setExpandedComps((e) => ({ ...e, [c.id]: !e[c.id] }))}
                                className="grid h-7 w-7 place-items-center rounded-md text-ink-muted transition hover:bg-muted"
                              >
                                {cOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </button>

                              {editingCompId === c.id ? (
                                <>
                                  <input
                                    value={editCompName}
                                    onChange={(e) => setEditCompName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')  saveCompEdit();
                                      if (e.key === 'Escape') setEditingCompId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 rounded-lg border border-accent bg-card px-3 py-1.5 text-sm text-ink outline-none"
                                  />
                                  <button onClick={saveCompEdit}
                                    className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-fg hover:bg-accent-hover">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => setEditingCompId(null)}
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-line-strong text-ink-muted hover:bg-muted">
                                    <X size={13} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Layers size={14} className="shrink-0 text-ink-subtle" />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm">{c.name}</div>
                                    <div className="text-[10px] text-ink-subtle">
                                      {cInds.length} indicator{cInds.length === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => { setEditingCompId(c.id); setEditCompName(c.name); }}
                                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-accent"
                                    title="Rename"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComp(c)}
                                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-rose-500"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>

                            {/* INDICATORS */}
                            {cOpen && (
                              <div className="border-t border-line bg-muted/20 p-2.5">
                                {cInds.length === 0 && (
                                  <p className="mb-2 text-xs text-ink-muted">No indicators yet.</p>
                                )}
                                <ul className="mb-2 space-y-0.5">
                                  {cInds.map((i) => (
                                    <li key={i.id} className="flex items-center gap-2">
                                      {editingIndId === i.id ? (
                                        <>
                                          <input
                                            value={editIndName}
                                            onChange={(e) => setEditIndName(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter')  saveIndEdit();
                                              if (e.key === 'Escape') setEditingIndId(null);
                                            }}
                                            autoFocus
                                            className="flex-1 rounded-lg border border-accent bg-card px-2.5 py-1 text-xs text-ink outline-none"
                                          />
                                          <button onClick={saveIndEdit}
                                            className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-fg">
                                            <Check size={11} />
                                          </button>
                                          <button onClick={() => setEditingIndId(null)}
                                            className="grid h-6 w-6 place-items-center rounded-md border border-line-strong text-ink-muted hover:bg-muted">
                                            <X size={11} />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <Target size={12} className="shrink-0 text-ink-subtle" />
                                          <span className="min-w-0 flex-1 truncate text-xs">{i.name}</span>
                                          <button
                                            onClick={() => { setEditingIndId(i.id); setEditIndName(i.name); }}
                                            className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition hover:bg-muted hover:text-accent"
                                          >
                                            <Pencil size={11} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteInd(i)}
                                            className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition hover:bg-muted hover:text-rose-500"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>

                                {addingIndToCompId === c.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      value={newIndName}
                                      onChange={(e) => setNewIndName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter')  handleAddInd(c.id);
                                        if (e.key === 'Escape') { setAddingIndToCompId(null); setNewIndName(''); }
                                      }}
                                      autoFocus
                                      placeholder="Indicator name"
                                      className="flex-1 rounded-lg border border-line-strong bg-card px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                                    />
                                    <button onClick={() => handleAddInd(c.id)}
                                      disabled={!newIndName.trim()}
                                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50">
                                      Add
                                    </button>
                                    <button onClick={() => { setAddingIndToCompId(null); setNewIndName(''); }}
                                      className="rounded-md border border-line-strong px-2.5 py-1 text-xs hover:bg-muted">
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setAddingIndToCompId(c.id); setNewIndName(''); }}
                                    className="flex items-center gap-1 text-xs text-ink-muted transition hover:text-accent"
                                  >
                                    <Plus size={11} /> Add indicator
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {addingCompToSubjectId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={newCompName}
                          onChange={(e) => setNewCompName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')  handleAddComp(s.id);
                            if (e.key === 'Escape') { setAddingCompToSubjectId(null); setNewCompName(''); }
                          }}
                          autoFocus
                          placeholder="Competency name"
                          className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
                        />
                        <button onClick={() => handleAddComp(s.id)}
                          disabled={!newCompName.trim()}
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50">
                          Add
                        </button>
                        <button onClick={() => { setAddingCompToSubjectId(null); setNewCompName(''); }}
                          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingCompToSubjectId(s.id); setNewCompName(''); }}
                        className="flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-accent"
                      >
                        <Plus size={14} /> Add competency
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
          existingComps={comps}
          existingInds={inds}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}