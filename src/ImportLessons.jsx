import { useState } from 'react';
import { X, Upload, Link2, AlertTriangle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { bulkImportLessons } from './lessons';

export default function ImportLessons({ existingSubjects, existingSubs, onClose }) {
  const [parsed, setParsed]   = useState(null); // [{ name, subMasteries: [...], status }]
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [mode, setMode]       = useState('file');

  const existingSubjectNames = new Set(
    existingSubjects.map((s) => s.name.toLowerCase())
  );
  const existingSubsBySubject = new Map();
  existingSubs.forEach((sm) => {
    const key = existingSubjects.find((s) => s.id === sm.subjectId)?.name.toLowerCase();
    if (!key) return;
    if (!existingSubsBySubject.has(key)) existingSubsBySubject.set(key, new Set());
    existingSubsBySubject.get(key).add(sm.name.toLowerCase());
  });

  /**
   * Column-based sheet. For each column:
   *   row 1 = main subject name
   *   rows 2..n = sub-masteries (blank cells = stop for that column)
   */
  function parseColumns(aoa) {
    if (!aoa || aoa.length === 0) throw new Error('Sheet is empty');

    // Widen to longest row so trailing blanks are handled.
    const width = Math.max(...aoa.map((r) => r.length));
    const subjects = [];

    for (let c = 0; c < width; c++) {
      const subjectName = String(aoa[0]?.[c] ?? '').trim();
      if (!subjectName) continue;

      const subMasteries = [];
      for (let r = 1; r < aoa.length; r++) {
        const name = String(aoa[r]?.[c] ?? '').trim();
        if (name) subMasteries.push(name);
      }

      const key = subjectName.toLowerCase();
      const isExistingSubject = existingSubjectNames.has(key);
      const existingSet = existingSubsBySubject.get(key) ?? new Set();

      const newSubs     = subMasteries.filter((n) => !existingSet.has(n.toLowerCase()));
      const dupSubs     = subMasteries.filter((n) =>  existingSet.has(n.toLowerCase()));

      subjects.push({
        name: subjectName,
        subMasteries,
        isExistingSubject,
        newSubs,
        dupSubs,
      });
    }

    if (subjects.length === 0) throw new Error('No subjects found in row 1');
    return subjects;
  }

  async function handleFile(e) {
    setErr(''); setBusy(true);
    try {
      const file = e.target.files[0];
      if (!file) return;
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      setParsed(parseColumns(aoa));
    } catch (e) {
      setErr(e.message);
      setParsed(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSheet() {
    setErr(''); setBusy(true);
    try {
      if (!sheetUrl.trim()) return;
      const res = await fetch(sheetUrl.trim());
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const text = await res.text();
      const wb   = XLSX.read(text, { type: 'string' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const aoa  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      setParsed(parseColumns(aoa));
    } catch (e) {
      setErr(`${e.message}. Make sure the sheet is published to the web as CSV.`);
      setParsed(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!parsed) return;
    setBusy(true); setErr('');
    try {
      await bulkImportLessons(parsed);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const newSubjectCount = parsed ? parsed.filter((p) => !p.isExistingSubject).length : 0;
  const reusedCount     = parsed ? parsed.filter((p) =>  p.isExistingSubject).length : 0;
  const newSubsCount    = parsed ? parsed.reduce((a, p) => a + p.newSubs.length, 0) : 0;
  const dupSubsCount    = parsed ? parsed.reduce((a, p) => a + p.dupSubs.length, 0) : 0;
  const willImport      = newSubjectCount + newSubsCount;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import lessons</h2>
          <button onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          <ModeTab active={mode === 'file'}  onClick={() => setMode('file')}  icon={Upload}>
            Upload XLSX
          </ModeTab>
          <ModeTab active={mode === 'sheet'} onClick={() => setMode('sheet')} icon={Link2}>
            Google Sheet
          </ModeTab>
        </div>

        {mode === 'file' && (
          <div className="rounded-lg border border-line p-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-accent-fg file:cursor-pointer hover:file:bg-accent-hover"
            />
            <div className="mt-2 text-xs text-ink-muted">
              <p><b className="text-ink">Format:</b> first row = main subjects. Below each, its sub-masteries in the same column.</p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[10px] leading-tight">
{`Pengenalan Nirmana | Warna & Kontras | Tipografi
Nirmana dasar      | Teori warna     | Anatomi huruf
Nirmana garis      | Kontras         | Grid
Nirmana bentuk     |                 | Hierarki
Sketsa dasar       |                 |`}
              </pre>
            </div>
          </div>
        )}

        {mode === 'sheet' && (
          <div className="rounded-lg border border-line p-4">
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              className="mb-3 w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              onClick={handleSheet}
              disabled={busy || !sheetUrl.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? 'Fetching…' : 'Fetch preview'}
            </button>
            <p className="mt-2 text-xs text-ink-muted">
              Publish the sheet: <b className="text-ink">File → Share → Publish to web → CSV → Publish</b>. Paste that URL.
            </p>
          </div>
        )}

        {err && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {parsed && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {newSubjectCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-500">
                  <Check size={12} /> {newSubjectCount} new subject{newSubjectCount === 1 ? '' : 's'}
                </span>
              )}
              {reusedCount > 0 && (
                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-indigo-400">
                  {reusedCount} merged into existing
                </span>
              )}
              {newSubsCount > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-500">
                  {newSubsCount} new sub-master{newSubsCount === 1 ? 'y' : 'ies'}
                </span>
              )}
              {dupSubsCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-amber-500">
                  <AlertTriangle size={12} /> {dupSubsCount} skipped
                </span>
              )}
            </div>

            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Main subject</th>
                    <th className="px-3 py-2">Sub-masteries</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-top font-medium">{p.name}</td>
                      <td className="px-3 py-2 align-top text-ink-muted">
                        {p.subMasteries.length === 0 ? (
                          <span className="text-ink-subtle">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {p.subMasteries.map((n, j) => {
                              const isDup = p.dupSubs.includes(n);
                              return (
                                <li key={j} className={isDup ? 'text-amber-500' : ''}>
                                  {n}{isDup && ' (skipped)'}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {p.isExistingSubject
                          ? <span className="text-indigo-400">merging</span>
                          : <span className="text-emerald-500">new</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmImport}
                disabled={busy || willImport === 0}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
              >
                <Upload size={15} />
                {busy ? 'Importing…' : `Import`}
              </button>
              <button
                onClick={() => { setParsed(null); setErr(''); }}
                className="rounded-lg border border-line-strong px-4 py-2 hover:bg-muted"
              >
                Reset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-card text-ink shadow' : 'text-ink-muted hover:text-ink'
      }`}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}