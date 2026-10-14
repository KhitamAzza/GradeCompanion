import { useMemo, useState } from 'react';
import {
  X, MessageCircle, Copy, Check, AlertTriangle,
} from 'lucide-react';

export default function WhatsAppReport({
  className,
  columns,
  subById,
  subjectById,
  classStudents,
  scoreMap,
  onClose,
}) {
  const [selected, setSelected]   = useState(() => new Set(columns));
  const [includeAll, setIncludeAll] = useState(false);
  const [copied, setCopied]       = useState(false);

  // Group columns by subject, preserving order.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const colId of columns) {
      const sub = subById[colId];
      if (!sub) continue;
      const sid = sub.subjectId;
      if (!map.has(sid)) map.set(sid, { subject: subjectById[sid], subIds: [] });
      map.get(sid).subIds.push(colId);
    }
    return Array.from(map.values());
  }, [columns, subById, subjectById]);

  // How many students are missing each column.
  const missingCounts = useMemo(() => {
    const m = {};
    for (const colId of columns) {
      m[colId] = classStudents.filter(
        (st) => scoreMap[st.id]?.[colId] === undefined
      ).length;
    }
    return m;
  }, [columns, classStudents, scoreMap]);

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAllInSubject(subjectId) {
    const ids = grouped.find((g) => g.subject?.id === subjectId)?.subIds ?? [];
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (allOn ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  const reportText = useMemo(() => {
    // ---------- Full roster mode ----------
    if (includeAll) {
      const lines = [];
      let sections = 0;

      for (const colId of columns) {
        if (!selected.has(colId)) continue;
        const sub  = subById[colId];
        const subj = sub ? subjectById[sub.subjectId] : null;
        const subjName = subj?.name ?? '(unknown)';
        const subName  = sub?.name  ?? '(unknown)';

        const withScores    = [];
        const withoutScores = [];

        for (const st of classStudents) {
          const v = scoreMap[st.id]?.[colId];
          if (v === undefined || v === 0) {
            withoutScores.push({ name: st.name });
          } else {
            withScores.push({ name: st.name, score: v });
          }
        }

        // Top: highest score first, then alphabetical for ties.
        withScores.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        // Bottom: alphabetical.
        withoutScores.sort((a, b) => a.name.localeCompare(b.name));

        lines.push(`Laporan nilai harian ${className} Mapel ${subjName} - ${subName}`);
        lines.push('');

        if (withScores.length === 0) {
          lines.push('(tidak ada siswa dengan nilai)');
        } else {
          withScores.forEach((s) => lines.push(`${s.name} - ${s.score}`));
        }

        if (withoutScores.length > 0) {
          lines.push('');
          lines.push('Siswa tidak memiliki nilai');
          lines.push('');
          withoutScores.forEach((s) => lines.push(`${s.name} - 0`));
        }

        lines.push('');
        sections++;
      }

      if (sections === 0) {
        lines.push('(tidak ada kolom yang dipilih)');
      }
      return lines.join('\n').trim();
    }

    // ---------- Missing-only mode (original) ----------
    const lines = [`Laporan siswa ${className} dengan nilai kosong`, ''];
    let sections = 0;

    for (const colId of columns) {
      if (!selected.has(colId)) continue;
      const missing = classStudents.filter(
        (st) => scoreMap[st.id]?.[colId] === undefined
      );
      if (missing.length === 0) continue;

      const sub  = subById[colId];
      const subj = sub ? subjectById[sub.subjectId] : null;
      const header = subj && sub
        ? `${subj.name} - ${sub.name}`
        : (sub?.name ?? '(unknown)');

      lines.push(header);
      lines.push('');
      missing.forEach((st) => lines.push(st.name));
      lines.push('');
      sections++;
    }

    if (sections === 0) {
      lines.push('(tidak ada siswa dengan nilai kosong untuk kolom yang dipilih)');
    }

    return lines.join('\n').trim();
  }, [className, columns, selected, classStudents, scoreMap, subById, subjectById, includeAll]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      alert('Copy failed: ' + e.message);
    }
  }

  function handleOpenWa() {
    const url = `https://wa.me/?text=${encodeURIComponent(reportText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const selectedCount = selected.size;
  const totalMissing  = columns.reduce(
    (a, id) => a + (selected.has(id) ? missingCounts[id] : 0),
    0
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageCircle size={18} />
            WhatsApp report
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Mode toggle */}
          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--t-accent)]"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium">Include all students</div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {includeAll
                  ? 'Shows every student ranked by score, with zeros and ungraded at the bottom.'
                  : 'Shows only students with an empty score.'}
              </div>
            </div>
          </label>

          <p className="mb-3 text-xs text-ink-muted">
            Pick which columns to include.
          </p>

          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              No columns to report yet.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.map((g) => {
                const subjectName = g.subject?.name ?? '(unknown)';
                const subjId      = g.subject?.id;
                const allOn       = g.subIds.every((id) => selected.has(id));
                const someOn      = g.subIds.some((id) => selected.has(id));

                return (
                  <div key={subjId} className="rounded-lg border border-line">
                    <button
                      onClick={() => toggleAllInSubject(subjId)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left"
                    >
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => {
                          if (el) el.indeterminate = someOn && !allOn;
                        }}
                        readOnly
                        className="h-4 w-4 accent-[var(--t-accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {subjectName}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {g.subIds.length} sub-master{g.subIds.length === 1 ? 'y' : 'ies'}
                      </span>
                    </button>

                    <div className="border-t border-line bg-muted/30 p-2">
                      <ul className="space-y-0.5">
                        {g.subIds.map((colId) => {
                          const sub = subById[colId];
                          const name = sub?.name ?? '(deleted)';
                          const missing = missingCounts[colId];
                          const on = selected.has(colId);
                          return (
                            <li key={colId}>
                              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggle(colId)}
                                  className="h-4 w-4 accent-[var(--t-accent)]"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm">
                                  {name}
                                </span>
                                <span className={`text-xs tabular-nums ${
                                  missing > 0 ? 'text-amber-500' : 'text-ink-subtle'
                                }`}>
                                  {missing} kosong
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Preview */}
          {selectedCount > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Preview</span>
                <span className="text-xs text-ink-subtle">
                  {selectedCount} column{selectedCount === 1 ? '' : 's'}
                  {includeAll
                    ? ` · ${classStudents.length} students`
                    : ` · ${totalMissing} name${totalMissing === 1 ? '' : 's'}`}
                </span>
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-muted/40 p-3 text-xs leading-relaxed text-ink">
                {reportText}
              </pre>
            </div>
          )}

          {reportText.length > 4000 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Report is long ({reportText.length} characters). Some WhatsApp clients may truncate
              it. Consider narrowing the selection.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-line p-4">
          <button
            onClick={handleCopy}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-40"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleOpenWa}
            disabled={selectedCount === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-40"
          >
            <MessageCircle size={15} />
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}