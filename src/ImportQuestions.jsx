import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { bulkSaveQuestions } from './questions';

export default function ImportQuestions({ 
  subjectId, competencyId, indicatorId, 
  indicatorName, onClose 
}) {
  const [parsedRows, setParsedRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleFile(e) {
    setErr(''); setBusy(true);
    try {
      const file = e.target.files[0];
      if (!file) return;
      
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!aoa || aoa.length === 0) throw new Error('File is empty');

      // Detect header row (expects Type, Question, Option A...)
      const firstRow = aoa[0].map(c => String(c ?? '').trim().toLowerCase());
      const hasHeader = firstRow.includes('type') || firstRow.includes('question');
      const data = hasHeader ? aoa.slice(1) : aoa;

      let nameIdx = 0, textIdx = 1;
      let optAIdx = 2, optBIdx = 3, optCIdx = 4, optDIdx = 5, optEIdx = 6, ansIdx = 7;

      if (hasHeader) {
        textIdx = firstRow.indexOf('question');
        optAIdx = firstRow.indexOf('option a');
        optBIdx = firstRow.indexOf('option b');
        optCIdx = firstRow.indexOf('option c');
        optDIdx = firstRow.indexOf('option d');
        optEIdx = firstRow.indexOf('option e');
        ansIdx = firstRow.indexOf('answer');
      }

      const parsed = [];
      for (const r of data) {
        const type = String(r[0] ?? 'mcq').trim().toLowerCase();
        const text = String(r[textIdx] ?? '').trim();
        if (!text) continue; // Skip empty rows

        const options = [
          String(r[optAIdx] ?? '').trim(),
          String(r[optBIdx] ?? '').trim(),
          String(r[optCIdx] ?? '').trim(),
          String(r[optDIdx] ?? '').trim(),
          String(r[optEIdx] ?? '').trim()
        ].filter(Boolean); // Remove empty trailing options

        const answer = String(r[ansIdx] ?? '').trim().toUpperCase();

        parsed.push({
          type: type === 'essay' ? 'essay' : 'mcq',
          text,
          options: type === 'essay' ? [] : options,
          answer: type === 'essay' ? '' : answer,
          subjectId, competencyId, indicatorId,
          imageUrl: '', imageSize: 'medium'
        });
      }

      if (parsed.length === 0) throw new Error('No valid questions found');
      setParsedRows(parsed);

    } catch (e) {
      setErr(e.message);
      setParsedRows(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!parsedRows) return;
    setBusy(true); setErr('');
    try {
      await bulkSaveQuestions(parsedRows);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-t-2xl border border-line bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Import Questions</h2>
            <div className="text-xs text-ink-muted">Target: <span className="text-accent font-medium">{indicatorName}</span></div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {!parsedRows ? (
          <div className="rounded-lg border border-line p-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-accent-fg file:cursor-pointer hover:file:bg-accent-hover"
            />
            <p className="mt-2 text-xs text-ink-muted">
              Columns expected: <b>Type, Question, Option A, Option B, Option C, Option D, Option E, Answer</b>.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-500 flex items-center gap-1.5">
                <FileSpreadsheet size={16} /> {parsedRows.length} questions ready
              </span>
            </div>
            
            <div className="max-h-64 overflow-auto rounded-lg border border-line p-2 space-y-2">
              {parsedRows.map((q, i) => (
                <div key={i} className="text-xs p-2 bg-muted/30 rounded-md">
                  <div className="font-semibold mb-1">{i + 1}. [{q.type.toUpperCase()}] {q.text}</div>
                  {q.options.map((o, j) => (
                    <div key={j} className={q.answer === String.fromCharCode(65+j) ? 'text-emerald-500' : 'text-ink-muted'}>
                      {String.fromCharCode(65+j)}. {o}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={confirmImport} disabled={busy} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50">
                <Upload size={16} /> {busy ? 'Importing...' : 'Confirm Import'}
              </button>
              <button onClick={() => setParsedRows(null)} className="rounded-lg border border-line-strong px-4 py-2.5 hover:bg-muted">
                Reset
              </button>
            </div>
          </div>
        )}

        {err && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
      </div>
    </div>
  );
}