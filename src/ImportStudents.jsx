import { useState } from 'react';
import { X, Upload, Link2, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { bulkAddStudents } from './students';

export default function ImportStudents({ existing, onClose }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [mode, setMode] = useState('file');
  const [skipDup, setSkipDup] = useState(true);

  const existingNames = new Set(existing.map((s) => s.name.trim().toLowerCase()));

  function parseRows(aoa) {
    if (!aoa || aoa.length === 0) throw new Error('Sheet is empty');

    const first = aoa[0].map((c) => String(c ?? '').trim().toLowerCase());
    const hasHeader =
      first.includes('name') || first.includes('class') || first.includes('nama');

    const data = hasHeader ? aoa.slice(1) : aoa;
    let nameIdx = 0, classIdx = 1;
    if (hasHeader) {
      const n = first.indexOf('name') >= 0 ? first.indexOf('name') : first.indexOf('nama');
      const c = first.indexOf('class');
      if (n >= 0) nameIdx = n;
      if (c >= 0) classIdx = c;
    }

    const seen = new Set();
    const out = [];
    for (const r of data) {
      const name = String(r[nameIdx] ?? '').trim();
      const cls  = String(r[classIdx] ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const dup = existingNames.has(key) || seen.has(key);
      seen.add(key);
      out.push({ name, class: cls, dup });
    }
    if (out.length === 0) throw new Error('No valid rows found');
    return out;
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
      setRows(parseRows(aoa));
    } catch (e) {
      setErr(e.message);
      setRows(null);
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
      setRows(parseRows(aoa));
    } catch (e) {
      setErr(`${e.message}. Make sure the sheet is published to the web as CSV.`);
      setRows(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!rows) return;
    setBusy(true); setErr('');
    try {
      const toAdd = rows.filter((r) => !(skipDup && r.dup));
      if (toAdd.length === 0) { setErr('Nothing to import (all rows skipped).'); return; }
      await bulkAddStudents(toAdd);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const newCount    = rows ? rows.filter((r) => !r.dup).length : 0;
  const dupCount    = rows ? rows.filter((r) =>  r.dup).length : 0;
  const willImport  = rows ? rows.filter((r) => !(skipDup && r.dup)).length : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import students</h2>
          <button onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          <ModeTab active={mode === 'file'} onClick={() => setMode('file')} icon={Upload}>
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
            <p className="mt-2 text-xs text-ink-muted">
              First sheet only. Expects columns <b className="text-ink">Name</b> and <b className="text-ink">Class</b> (case-insensitive).
              If no headers are found, column 1 = name, column 2 = class.
            </p>
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
              In Google Sheets: <b className="text-ink">File → Share → Publish to web → Comma-separated values (.csv) → Publish</b>. Paste that URL.
            </p>
          </div>
        )}

        {err && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {rows && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-500">
                <Check size={12} /> {newCount} new
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-amber-500">
                <AlertTriangle size={12} /> {dupCount} duplicate
              </span>
              <label className="ml-auto inline-flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={skipDup}
                  onChange={(e) => setSkipDup(e.target.checked)}
                  className="accent-[var(--t-accent)]"
                />
                Skip duplicates
              </label>
            </div>

            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{r.class}</td>
                      <td className="px-3 py-1.5">
                        {r.dup
                          ? <span className="text-xs text-amber-500">duplicate</span>
                          : <span className="text-xs text-emerald-500">new</span>}
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
                {busy ? 'Importing…' : `Import ${willImport} student${willImport === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={() => { setRows(null); setErr(''); }}
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