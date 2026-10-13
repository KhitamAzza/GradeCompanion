import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { CalendarPlus, Download, CalendarX, X } from 'lucide-react';
import { subscribeStudents } from '../students';
import {
  subscribeScores, subscribeClassDates, setScore, removeScore,
  addDate, removeDate,
} from '../scores';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Scores() {
  const [students, setStudents]             = useState(null);
  const [selectedClass, setSelectedClass]   = useState('');
  const [scores, setScores]                 = useState(null);
  const [classDates, setClassDates]         = useState(null);
  const [editing, setEditing]               = useState(null);
  const [editValue, setEditValue]           = useState('');
  const [showAddDate, setShowAddDate]       = useState(false);
  const [newDate, setNewDate]               = useState(todayISO());

  useEffect(() => subscribeStudents(setStudents), []);

  const classes = useMemo(() => {
    if (!students) return [];
    return [...new Set(students.map((s) => s.class))].sort();
  }, [students]);

  useEffect(() => {
    if (!selectedClass && classes.length) setSelectedClass(classes[0]);
  }, [classes, selectedClass]);

  useEffect(() => {
    if (!selectedClass) { setScores(null); setClassDates(null); return; }
    const u1 = subscribeScores(selectedClass, setScores);
    const u2 = subscribeClassDates(selectedClass, setClassDates);
    return () => { u1(); u2(); };
  }, [selectedClass]);

  const classStudents = useMemo(
    () => students?.filter((s) => s.class === selectedClass) ?? [],
    [students, selectedClass]
  );

  const dates = useMemo(() => {
    const set = new Set(classDates ?? []);
    (scores ?? []).forEach((s) => set.add(s.date));
    return [...set].sort();
  }, [classDates, scores]);

  const scoreMap = useMemo(() => {
    const m = {};
    (scores ?? []).forEach((s) => {
      (m[s.studentId] ??= {})[s.date] = s.score;
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

  function startEdit(studentId, date) {
    const existing = scoreMap[studentId]?.[date];
    setEditing({ studentId, date });
    setEditValue(existing !== undefined ? String(existing) : '');
  }

  async function commitEdit() {
    if (!editing) return;
    const raw = editValue.trim();
    if (raw === '') {
      await removeScore(editing.studentId, editing.date);
    } else {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        await setScore(editing.studentId, selectedClass, editing.date, num);
      }
    }
    setEditing(null);
    setEditValue('');
  }

  async function handleAddDate() {
    if (!newDate) return;
    await addDate(selectedClass, newDate);
    setShowAddDate(false);
    setNewDate(todayISO());
  }

  async function handleRemoveDate(date) {
    if (!confirm(`Delete the column ${date}?\nAll scores for that date will be removed.`)) return;
    await removeDate(selectedClass, date);
  }

  function handleExport() {
    const aoa = [['Name', ...dates, 'Count', 'Status']];
    for (const st of classStudents) {
      const row = [st.name];
      let count = 0;
      for (const d of dates) {
        const v = scoreMap[st.id]?.[d];
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

  if (students === null) return <p className="text-ink-muted">Loading…</p>;

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
        <CalendarX size={48} className="text-ink-subtle" strokeWidth={1.5} />
        <p className="text-ink-muted">Add students first.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Daily Scores</h1>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAddDate(true)}
            className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            <CalendarPlus size={15} />
            <span className="hidden sm:inline">Add date</span>
          </button>
          <button
            onClick={handleExport}
            disabled={!dates.length}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {scores === null || classDates === null ? (
        <p className="text-ink-muted">Loading scores…</p>
      ) : dates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-12 text-center">
          <CalendarPlus size={48} className="text-ink-subtle" strokeWidth={1.5} />
          <p className="text-ink-muted">No dates yet. Click <b className="text-ink">Add date</b> to create one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="sticky left-0 z-10 border-r border-line bg-muted px-3 py-2 text-left text-xs font-medium text-ink-muted">
                  Name
                </th>
                {dates.map((d) => (
                  <th key={d} className="whitespace-nowrap px-2 py-2 text-center text-xs font-medium text-ink-muted">
                    <div>{shortDate(d)}</div>
                    <button
                      onClick={() => handleRemoveDate(d)}
                      className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-normal text-ink-subtle transition hover:text-rose-500"
                      title="Remove this date column"
                    >
                      <X size={10} /> remove
                    </button>
                  </th>
                ))}
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
                    {dates.map((d) => {
                      const v = scoreMap[st.id]?.[d];
                      const isEditing = editing?.studentId === st.id && editing?.date === d;
                      return (
                        <td key={d} className="px-1 py-1 text-center">
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
                              onClick={() => startEdit(st.id, d)}
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

      {showAddDate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-line bg-card p-5 shadow-xl">
            <h3 className="mb-4 font-semibold">Add date column</h3>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="mb-4 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-ink outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddDate}
                className="flex-1 rounded-lg bg-accent py-2 font-medium text-accent-fg transition hover:bg-accent-hover"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddDate(false)}
                className="rounded-lg border border-line-strong px-4 py-2 hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function shortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}