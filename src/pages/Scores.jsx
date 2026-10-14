import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Download, X, ClipboardList, Check } from 'lucide-react';
import { subscribeStudents } from '../students';
import { subscribeSubjects, subscribeSubMasteries } from '../lessons';
import {
  subscribeScores, subscribeClassColumns, setScore, removeScore,
  addColumn, removeColumn,
} from '../scores';
import { useSearchParams } from 'react-router-dom';
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Scores() {
  const [students, setStudents]             = useState(null);
  const [subjects, setSubjects]             = useState(null);
  const [subs, setSubs]                     = useState(null);
  const [selectedClass, setSelectedClass]   = useState('');
  const [scores, setScores]                 = useState(null);
  const [columnIds, setColumnIds]           = useState(null);
  const [editing, setEditing]               = useState(null); // { studentId, subMasteryId }
  const [editValue, setEditValue]           = useState('');
  const [showAddColumn, setShowAddColumn]   = useState(false);
  const [searchParams] = useSearchParams();
  const requestedClass = searchParams.get('class');

  useEffect(() => subscribeStudents(setStudents), []);
  useEffect(() => subscribeSubjects(setSubjects), []);
  useEffect(() => subscribeSubMasteries(setSubs), []);

  const classes = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map((s) => s.class))].sort();
  }, [students]);

    useEffect(() => {
    if (requestedClass && classes.includes(requestedClass)) {
      setSelectedClass(requestedClass);
    } else if (!selectedClass && classes.length) {
      setSelectedClass(classes[0]);
    }
  }, [classes, selectedClass, requestedClass]);

  useEffect(() => {
    if (!selectedClass) { setScores(null); setColumnIds(null); return; }
    const u1 = subscribeScores(selectedClass, setScores);
    const u2 = subscribeClassColumns(selectedClass, setColumnIds);
    return () => { u1(); u2(); };
  }, [selectedClass]);

  const classStudents = useMemo(
    () => students?.filter((s) => s.class === selectedClass) ?? [],
    [students, selectedClass]
  );

  // Lookup maps for rendering column headers and orphan detection.
  const subById = useMemo(() => {
    const m = {};
    (subs ?? []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [subs]);

  const subjectById = useMemo(() => {
    const m = {};
    (subjects ?? []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [subjects]);

  const columns = columnIds ?? [];

  const scoreMap = useMemo(() => {
    const m = {};
    (scores ?? []).forEach((s) => {
      (m[s.studentId] ??= {})[s.subMasteryId] = s.score;
    });
    return m;
  }, [scores]);

  const maxCount = useMemo(() => {
    let mx = 0;
    for (const st of classStudents) {
      const c = Object.keys(scoreMap[st.id] ?? {}).length;
      if (c > mx) mx = c;
    }
    return mx;
  }, [classStudents, scoreMap]);

  function startEdit(studentId, subMasteryId) {
    const existing = scoreMap[studentId]?.[subMasteryId];
    setEditing({ studentId, subMasteryId });
    setEditValue(existing !== undefined ? String(existing) : '');
  }

  async function commitEdit() {
    if (!editing) return;
    const raw = editValue.trim();
    if (raw === '') {
      await removeScore(editing.studentId, editing.subMasteryId);
    } else {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        await setScore(editing.studentId, selectedClass, editing.subMasteryId, num);
      }
    }
    setEditing(null);
    setEditValue('');
  }

  async function handleAddColumn(subMasteryId) {
    await addColumn(selectedClass, subMasteryId);
  }

  async function handleRemoveColumn(subMasteryId) {
    const sub = subById[subMasteryId];
    const name = sub?.name ?? 'this column';
    if (!confirm(`Remove "${name}"?\nAll scores for this column will be deleted.`)) return;
    await removeColumn(selectedClass, subMasteryId);
  }

  function handleExport() {
    const header = [
      'Name',
      ...columns.map((id) => subById[id]?.name ?? 'Unknown'),
      'Count',
      'Status',
    ];
    const aoa = [header];
    for (const st of classStudents) {
      const row = [st.name];
      let count = 0;
      for (const col of columns) {
        const v = scoreMap[st.id]?.[col];
        row.push(v ?? '');
        if (v !== undefined) count++;
      }
      row.push(count);
      row.push(maxCount === 0 || count === maxCount ? 'Complete' : 'Incomplete');
      aoa.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedClass.slice(0, 30) || 'Scores');
    XLSX.writeFile(wb, `scores-${selectedClass}-${todayISO()}.xlsx`);
  }

  if (students === null || subjects === null || subs === null) {
    return <p className="text-ink-muted">Loading…</p>;
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
        <ClipboardList size={48} className="text-ink-subtle" strokeWidth={1.5} />
        <p className="text-ink-muted">Add students first.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Scores</h1>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add column</span>
          </button>
          <button
            onClick={handleExport}
            disabled={!columns.length}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {scores === null || columnIds === null ? (
        <p className="text-ink-muted">Loading scores…</p>
      ) : columns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <Plus size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">
            No columns yet. Click <b className="text-ink">Add column</b> to pick a sub-mastery.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="sticky left-0 z-10 border-r border-line bg-muted px-3 py-2 text-left text-xs font-medium text-ink-muted">
                  Name
                </th>
                {columns.map((subId) => {
                  const sub = subById[subId];
                  const subject = sub ? subjectById[sub.subjectId] : null;
                  return (
                    <th key={subId} className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-ink-muted">
                      <div className="text-ink">{sub?.name ?? '(deleted)'}</div>
                      {subject && (
                        <div className="text-[10px] text-ink-subtle">{subject.name}</div>
                      )}
                      <button
                        onClick={() => handleRemoveColumn(subId)}
                        className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-normal text-ink-subtle transition hover:text-rose-500"
                        title="Remove this column"
                      >
                        <X size={10} /> remove
                      </button>
                    </th>
                  );
                })}
                <th className="border-l border-line px-3 py-2 text-right text-xs font-medium text-ink-muted">
                  Count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {classStudents.map((st) => {
                const count = Object.keys(scoreMap[st.id] ?? {}).length;
                const incomplete = count < maxCount;
                return (
                  <tr key={st.id}>
                    <td className="sticky left-0 z-10 border-r border-line bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[10rem] truncate">{st.name}</span>
                        {incomplete && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                            Incomplete
                          </span>
                        )}
                      </div>
                    </td>
                    {columns.map((subId) => {
                      const v = scoreMap[st.id]?.[subId];
                      const isEditing =
                        editing?.studentId === st.id &&
                        editing?.subMasteryId === subId;
                      return (
                        <td key={subId} className="px-1 py-1 text-center">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="100"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')  commitEdit();
                                if (e.key === 'Escape') { setEditing(null); setEditValue(''); }
                              }}
                              className="w-14 rounded border border-accent bg-card px-1 py-1 text-center text-ink outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(st.id, subId)}
                              className={`w-full min-w-[3rem] rounded px-2 py-1.5 transition ${
                                v === undefined
                                  ? 'text-ink-subtle hover:bg-muted'
                                  : 'text-ink hover:bg-accent-soft'
                              }`}
                            >
                              {v === undefined ? '–' : v}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-l border-line px-3 py-2 text-right text-xs text-ink-muted">
                      {count}/{maxCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddColumn && (
        <AddColumnModal
          subjects={subjects}
          subs={subs}
          existingColumnIds={columns}
          onPick={handleAddColumn}
          onClose={() => setShowAddColumn(false)}
        />
      )}
    </>
  );
}

/* ---------- Add column modal ---------- */

function AddColumnModal({ subjects, subs, existingColumnIds, onPick, onClose }) {
  const [openSubjectId, setOpenSubjectId] = useState(subjects[0]?.id ?? null);

  const subsBySubject = useMemo(() => {
    const m = {};
    subs.forEach((sm) => { (m[sm.subjectId] ??= []).push(sm); });
    return m;
  }, [subs]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add column</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {subjects.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No subjects yet. Add them on the <b className="text-ink">Lessons</b> page.
          </p>
        ) : (
          <div className="space-y-1.5">
            {subjects.map((subj) => {
              const list = subsBySubject[subj.id] ?? [];
              const isOpen = openSubjectId === subj.id;
              return (
                <div key={subj.id} className="rounded-lg border border-line bg-card">
                  <button
                    onClick={() => setOpenSubjectId(isOpen ? null : subj.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium">{subj.name}</span>
                    <span className="text-xs text-ink-muted">
                      {list.length} sub-master{list.length === 1 ? 'y' : 'ies'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-line bg-muted/40 p-3">
                      {list.length === 0 ? (
                        <p className="text-xs text-ink-muted">No sub-masteries.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((sm) => {
                            const already = existingColumnIds.includes(sm.id);
                            return (
                              <button
                                key={sm.id}
                                onClick={() => !already && onPick(sm.id)}
                                disabled={already}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                                  already
                                    ? 'cursor-not-allowed bg-muted text-ink-subtle'
                                    : 'border border-line-strong hover:border-accent hover:text-accent'
                                }`}
                                title={already ? 'Already a column' : 'Add as column'}
                              >
                                {already && <Check size={11} />}
                                {sm.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}