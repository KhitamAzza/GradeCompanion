import { useState } from 'react';
import { X, Upload, Link2, AlertTriangle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { bulkImportLessons } from './lessons';

export default function ImportLessons({ existingSubjects, existingComps, existingInds, onClose }) {
  const [parsed, setParsed]   = useState(null); // [{ subjectName, competencyName, indicatorName }]
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [mode, setMode]       = useState('file');

  /**
   * Row-based sheet. Columns:
   *   A = Subject  |  B = Competency  |  C = Indicator
   * Blank cells inherit from the cell above (except row 1, which must have a subject).
   * If row 1 looks like headers ("subject"/"competency"/"indicator"), it's skipped.
   */
  function parseRows(aoa) {
    if (!aoa || aoa.length === 0) throw new Error('Sheet is empty');

    // Header detection on row 1.
    const first = (aoa[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase());
    const isHeader =
      first.some((c) => c === 'subject') ||
      first.some((c) => c === 'competency') ||
      first.some((c) => c === 'indicator');
    const data = isHeader ? aoa.slice(1) : aoa;

    let lastSubject = '';
    let lastComp    = '';
    const rows = [];

    for (const r of data) {
      const rawSubject = String(r?.[0] ?? '').trim();
      const rawComp    = String(r?.[1] ?? '').trim();
      const rawInd     = String(r?.[2] ?? '').trim();

      if (rawSubject) lastSubject = rawSubject;
      if (rawComp)    lastComp    = rawComp;

      // Skip fully blank rows.
      if (!rawSubject && !rawComp && !rawInd) continue;
      if (!lastSubject) continue;

      rows.push({
        subjectName:   lastSubject,
        competencyName: rawComp ? rawComp : (rawInd ? lastComp : ''),
        indicatorName: rawInd,
      });
    }

    if (rows.length === 0) throw new Error('No usable rows found');
    return rows;
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
      setParsed(parseRows(aoa));
    } catch (e) {
      setErr(e.message); setParsed(null);
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
      setParsed(parseRows(aoa));
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

  // Group preview rows by subject for readability.
  const preview = parsed ? (() => {
    const map = new Map();
    for (const r of parsed) {
      const sKey = r.subjectName.toLowerCase();
      if (!map.has(sKey)) map.set(sKey, { name: r.subjectName, comps: new Map() });
      const s = map.get(sKey);
      const cKey = (r.competencyName || '').toLowerCase();
      if (!s.comps.has(cKey)) s.comps.set(cKey, { name: r.competencyName, inds: [] });
      if (r.indicatorName) s.comps.get(cKey).inds.push(r.indicatorName);
    }
    return Array.from(map.values());
  })() : null;

  const totalRows = parsed?.length ?? 0;

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
          <ModeTab active={mode === 'file'}  onClick={() => setMode('file')}  icon={Upload}>Upload XLSX</ModeTab>
          <ModeTab active={mode === 'sheet'} onClick={() => setMode('sheet')} icon={Link2}>Google Sheet</ModeTab>
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
              <p><b className="text-ink">Format:</b> column A = Subject, B = Competency, C = Indicator. Blank cells inherit from the row above.</p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[10px] leading-tight">
{`Subject            | Competency   | Indicator
Pengenalan Nirmana | Nirmana dasar| Garis lurus
                   |              | Garis lengkung
                   | Nirmana garis| Ketebalan
                   |              | Arah
Warna & Kontras    | Teori warna  | Roda warna`}
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

        {preview && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-500">
                <Check size={12} /> {totalRows} row{totalRows === 1 ? '' : 's'} to import
              </span>
            </div>

            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-line p-3">
              {preview.map((s, si) => (
                <div key={si} className="mb-3 last:mb-0">
                  <div className="text-sm font-medium">{s.name}</div>
                  <ul className="mt-1 ml-3 space-y-1 border-l border-line pl-3">
                    {Array.from(s.comps.values()).map((c, ci) => (
                      <li key={ci}>
                        <div className="text-xs text-ink-muted">{c.name || '(no competency)'}</div>
                        {c.inds.length > 0 && (
                          <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-line pl-3">
                            {c.inds.map((ind, ii) => (
                              <li key={ii} className="text-xs text-ink-subtle">· {ind}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmImport}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
              >
                <Upload size={15} />
                {busy ? 'Importing…' : 'Import'}
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