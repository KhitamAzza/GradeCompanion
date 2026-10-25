import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom'; // ENSURE THIS IS IMPORTED
import * as XLSX from 'xlsx';
import {
  Plus, Download, X, ClipboardList, Check, MessageCircle,
  ChevronRight, ChevronDown, Target,
} from 'lucide-react';
import { subscribeStudents } from '../students';
import {
  subscribeSubjects, subscribeCompetencies, subscribeIndicators,
} from '../lessons';
import {
  subscribeScores, subscribeClassColumns, setScore, removeScore,
  addColumn, removeColumn,
} from '../scores';
import WhatsAppReport from '../WhatsAppReport';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Scores() {
  const [students, setStudents]             = useState(null);
  const [subjects, setSubjects]             = useState(null);
  const [comps, setComps]                   = useState(null);
  const [inds, setInds]                     = useState(null);
  
  // URL Params
  const [searchParams, setSearchParams]     = useSearchParams();
  const urlClass = searchParams.get('class');

  const [selectedClass, setSelectedClass]   = useState('');
  const [scores, setScores]                 = useState(null);
  const [columnIds, setColumnIds]           = useState(null);
  const [editing, setEditing]               = useState(null);
  const [editValue, setEditValue]           = useState('');
  const [showAddColumn, setShowAddColumn]   = useState(false);
  const [showWa, setShowWa]                 = useState(false);

  useEffect(() => subscribeStudents(setStudents), []);
  useEffect(() => subscribeSubjects(setSubjects), []);
  useEffect(() => subscribeCompetencies(setComps), []);
  useEffect(() => subscribeIndicators(setInds), []);

  // Use .trim() to ensure no trailing spaces mess up the match
  const classes = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map((s) => s.class.trim()))].sort();
  }, [students]);

  // Sync URL to State and vice versa
  useEffect(() => {
    if (classes.length === 0) return;

    if (urlClass && classes.includes(urlClass)) {
      // If URL has a valid class, use it
      setSelectedClass(urlClass);
    } else if (!selectedClass) {
      // If no URL param and no selected class, default to first and update URL
      setSelectedClass(classes[0]);
      setSearchParams({ class: classes[0] }, { replace: true });
    }
  }, [classes, urlClass, setSearchParams]); // Removed selectedClass from deps to prevent loops

  const handleClassChange = (newClass) => {
    setSelectedClass(newClass);
    setSearchParams({ class: newClass }, { replace: true });
  };

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

  const indById = useMemo(() => {
    const m = {};
    (inds ?? []).forEach((i) => { m[i.id] = i; });
    return m;
  }, [inds]);

  const compById = useMemo(() => {
    const m = {};
    (comps ?? []).forEach((c) => { m[c.id] = c; });
    return m;
  }, [comps]);

  const subjectById = useMemo(() => {
    const m = {};
    (subjects ?? []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [subjects]);

  const columns = columnIds ?? [];

  const scoreMap = useMemo(() => {
    const m = {};
    (scores ?? []).forEach((s) => {
      (m[s.studentId] ??= {})[s.indicatorId] = s.score;
    });
    return m;
  }, [scores]);

  const totalCols = columns.length;

  function filledFor(studentId) {
    const row = scoreMap[studentId] ?? {};
    let n = 0;
    for (const col of columns) if (row[col] !== undefined) n++;
    return n;
  }

  function startEdit(studentId, indicatorId) {
    const existing = scoreMap[studentId]?.[indicatorId];
    setEditing({ studentId, indicatorId });
    setEditValue(existing !== undefined ? String(existing) : '');
  }

  async function commitEdit() {
    if (!editing) return;
    const raw = editValue.trim();
    if (raw === '') {
      await removeScore(editing.studentId, editing.indicatorId);
    } else {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        await setScore(editing.studentId, selectedClass, editing.indicatorId, num);
      }
    }
    setEditing(null);
    setEditValue('');
  }

  async function handleAddColumn(indicatorId) {
    await addColumn(selectedClass, indicatorId);
  }

  async function handleRemoveColumn(indicatorId) {
    const ind = indById[indicatorId];
    const name = ind?.name ?? 'this column';
    if (!confirm(`Remove "${name}"?\nAll scores for this column will be deleted.`)) return;
    await removeColumn(selectedClass, indicatorId);
  }

  function handleExport() {
    const header = [
      'Name',
      ...columns.map((id) => indById[id]?.name ?? 'Unknown'),
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
      row.push(totalCols === 0 || count === totalCols ? 'Complete' : 'Incomplete');
      aoa.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedClass.slice(0, 30) || 'Scores');
    XLSX.writeFile(wb, `scores-${selectedClass}-${todayISO()}.xlsx`);
  }

  if (students === null || subjects === null || comps === null || inds === null) {
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
          onChange={(e) => handleClassChange(e.target.value)} // USE THE NEW HANDLER
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
            onClick={() => setShowWa(true)}
            disabled={!columns.length}
            className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
            title="Report to WhatsApp"
          >
            <MessageCircle size={15} />
            <span className="hidden sm:inline">WA report</span>
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
            No columns yet. Click <b className="text-ink">Add column</b> to pick an indicator.
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
                {columns.map((indId) => {
                  const ind = indById[indId];
                  const comp = ind ? compById[ind.competencyId] : null;
                  const subj = comp ? subjectById[comp.subjectId] : null;
                  return (
                    <th key={indId} className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-ink-muted">
                      <div className="text-ink">{ind?.name ?? '(deleted)'}</div>
                      {comp && (
                        <div className="text-[10px] text-ink-muted">{comp.name}</div>
                      )}
                      {subj && (
                        <div className="text-[10px] text-ink-subtle">{subj.name}</div>
                      )}
                      <button
                        onClick={() => handleRemoveColumn(indId)}
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
                const count = filledFor(st.id);
                const incomplete = totalCols > 0 && count < totalCols;
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
                    {columns.map((indId) => {
                      const v = scoreMap[st.id]?.[indId];
                      const isEditing =
                        editing?.studentId === st.id &&
                        editing?.indicatorId === indId;
                      return (
                        <td key={indId} className="px-1 py-1 text-center">
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
                              onClick={() => startEdit(st.id, indId)}
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
                      {count}/{totalCols}
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
          comps={comps}
          inds={inds}
          existingColumnIds={columns}
          onPick={handleAddColumn}
          onClose={() => setShowAddColumn(false)}
        />
      )}

      {showWa && (
        <WhatsAppReport
          className={selectedClass}
          columns={columns}
          indById={indById}
          compById={compById}
          subjectById={subjectById}
          classStudents={classStudents}
          scoreMap={scoreMap}
          onClose={() => setShowWa(false)}
        />
      )}
    </>
  );
}

/* ---------- Add column modal (3-level drill-down) ---------- */

function AddColumnModal({ subjects, comps, inds, existingColumnIds, onPick, onClose }) {
  const [openSubject, setOpenSubject] = useState(subjects[0]?.id ?? null);
  const [openComp, setOpenComp]       = useState(null);

  const compsBySubject = useMemo(() => {
    const m = {};
    comps.forEach((c) => { (m[c.subjectId] ??= []).push(c); });
    return m;
  }, [comps]);

  const indsByComp = useMemo(() => {
    const m = {};
    inds.forEach((i) => { (m[i.competencyId] ??= []).push(i); });
    return m;
  }, [inds]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl">
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
              const list = compsBySubject[subj.id] ?? [];
              const isOpen = openSubject === subj.id;
              return (
                <div key={subj.id} className="rounded-lg border border-line bg-card">
                  <button
                    onClick={() => { setOpenSubject(isOpen ? null : subj.id); setOpenComp(null); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{subj.name}</span>
                    <span className="text-xs text-ink-muted">
                      {list.length} competenc{list.length === 1 ? 'y' : 'ies'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-line bg-muted/30 p-2">
                      {list.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-ink-muted">No competencies.</p>
                      ) : (
                        <ul className="space-y-1">
                          {list.map((c) => {
                            const cInds = indsByComp[c.id] ?? [];
                            const cOpen = openComp === c.id;
                            return (
                              <li key={c.id} className="rounded-md border border-line bg-card">
                                <button
                                  onClick={() => setOpenComp(cOpen ? null : c.id)}
                                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                                >
                                  {cOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                                  <span className="text-[10px] text-ink-muted">
                                    {cInds.length}
                                  </span>
                                </button>

                                {cOpen && (
                                  <div className="border-t border-line bg-muted/30 p-2">
                                    {cInds.length === 0 ? (
                                      <p className="text-[10px] text-ink-muted">No indicators.</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5">
                                        {cInds.map((ind) => {
                                          const already = existingColumnIds.includes(ind.id);
                                          return (
                                            <button
                                              key={ind.id}
                                              onClick={() => !already && onPick(ind.id)}
                                              disabled={already}
                                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                                already
                                                  ? 'cursor-not-allowed bg-muted text-ink-subtle'
                                                  : 'border border-line-strong hover:border-accent hover:text-accent'
                                              }`}
                                              title={already ? 'Already a column' : 'Add as column'}
                                            >
                                              {already && <Check size={10} />}
                                              {!already && <Target size={10} className="text-ink-subtle" />}
                                              {ind.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
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