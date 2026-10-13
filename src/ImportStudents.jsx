import { useState } from 'react';
import * as XLSX from 'xlsx';
import { bulkAddStudents } from './students';

export default function ImportStudents({ existing, onClose }) {
  const [rows, setRows] = useState(null);      // parsed rows
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [mode, setMode] = useState('file');    // 'file' | 'sheet'
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
      if (!name) continue;                          // skip blank rows
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Import students</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <ModeTab active={mode === 'file'}  onClick={() => setMode('file')}>Upload XLSX</ModeTab>
          <ModeTab active={mode === 'sheet'} onClick={() => setMode('sheet')}>Google Sheet</ModeTab>
        </div>

        {mode === 'file' && (
          <div className="rounded-lg border border-slate-200 p-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm"
            />
            <p className="mt-2 text-xs text-slate-500">
              First sheet only. Expects columns <b>Name</b> and <b>Class</b> (case-insensitive).
              If no headers are found, column 1 = name, column 2 = class.
            </p>
          </div>
        )}

        {mode === 'sheet' && (
          <div className="rounded-lg border border-slate-200 p-4">
            <input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSheet}
              disabled={busy || !sheetUrl.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Fetching…' : 'Fetch preview'}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              In Google Sheets: <b>File → Share → Publish to web → Comma-separated values (.csv) → Publish</b>. Paste that URL.
            </p>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

        {rows && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{newCount} new</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{dupCount} duplicate</span>
              <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={skipDup}
                  onChange={(e) => setSkipDup(e.target.checked)}
                />
                Skip duplicates
              </label>
            </div>

            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.class}</td>
                      <td className="px-3 py-1.5">
                        {r.dup
                          ? <span className="text-xs text-amber-600">duplicate</span>
                          : <span className="text-xs text-emerald-600">new</span>}
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
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Importing…' : `Import ${willImport} student${willImport === 1 ? '' : 's'}`}
              </button>
              <button
                onClick={() => { setRows(null); setErr(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2"
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

function ModeTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}