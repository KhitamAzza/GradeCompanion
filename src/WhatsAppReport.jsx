import { useMemo, useState } from 'react';
import {
  X, MessageCircle, Copy, Check, AlertTriangle,
} from 'lucide-react';

export default function WhatsAppReport({
  className,
  columns,
  indById,
  compById,
  subjectById,
  classStudents,
  scoreMap,
  onClose,
}) {
  const [selected, setSelected]     = useState(() => new Set(columns));
  const [includeAll, setIncludeAll] = useState(false);
  const [copied, setCopied]         = useState(false);

  // Group columns by subject → competency for the picker tree.
  const grouped = useMemo(() => {
    const subjects = new Map();
    for (const indId of columns) {
      const ind = indById[indId];
      if (!ind) continue;
      const comp = compById[ind.competencyId];
      if (!comp) continue;
      const subj = subjectById[comp.subjectId];
      if (!subj) continue;

      if (!subjects.has(subj.id)) {
        subjects.set(subj.id, { subject: subj, comps: new Map() });
      }
      const s = subjects.get(subj.id);
      if (!s.comps.has(comp.id)) s.comps.set(comp.id, { comp, indIds: [] });
      s.comps.get(comp.id).indIds.push(indId);
    }
    return Array.from(subjects.values());
  }, [columns, indById, compById, subjectById]);

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

  function toggleSubject(subjectId) {
    const ids = [];
    const s = grouped.find((g) => g.subject?.id === subjectId);
    if (!s) return;
    s.comps.forEach((c) => c.indIds.forEach((id) => ids.push(id)));
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (allOn ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  function toggleComp(subjectId, compId) {
    const s = grouped.find((g) => g.subject?.id === subjectId);
    const c = s?.comps.get(compId);
    if (!c) return;
    const ids = c.indIds;
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (allOn ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  function labelFor(indId) {
    const ind = indById[indId];
    if (!ind) return '(unknown)';
    const comp = compById[ind.competencyId];
    const subj = comp ? subjectById[comp.subjectId] : null;
    return subj && comp
      ? `${subj.name} - ${comp.name} - ${ind.name}`
      : ind.name;
  }

  const reportText = useMemo(() => {
    // ---------- Full roster ----------
    if (includeAll) {
      const lines = [];
      let sections = 0;

      for (const colId of columns) {
        if (!selected.has(colId)) continue;
        const ind = indById[colId];
        const comp = ind ? compById[ind.competencyId] : null;
        const subj = comp ? subjectById[comp.subjectId] : null;
        const subjName = subj?.name ?? '(unknown)';
        const subName  = ind?.name  ?? '(unknown)';

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

        withScores.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
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

      if (sections === 0) lines.push('(tidak ada kolom yang dipilih)');
      return lines.join('\n').trim();
    }

    // ---------- Missing only ----------
    const lines = [`Laporan siswa ${className} dengan nilai kosong`, ''];
    let sections = 0;

    for (const colId of columns) {
      if (!selected.has(colId)) continue;
      const missing = classStudents.filter(
        (st) => scoreMap[st.id]?.[colId] === undefined
      );
      if (missing.length === 0) continue;

      lines.push(labelFor(colId));
      lines.push('');
      missing.forEach((st) => lines.push(st.name));
      lines.push('');
      sections++;
    }

    if (sections === 0) {
      lines.push('(tidak ada siswa dengan nilai kosong untuk kolom yang dipilih)');
    }

    return lines.join('\n').trim();
  }, [className, columns, selected, classStudents, scoreMap, indById, compById, subjectById, includeAll]);

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

        <div className="flex-1 overflow-y-auto p-5">
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
            Pick which indicators to include.
          </p>

          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              No columns to report yet.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.map((g) => {
                const subjectName = g.subject.name;
                const allIds = [];
                g.comps.forEach((c) => c.indIds.forEach((id) => allIds.push(id)));
                const allOn  = allIds.every((id) => selected.has(id));
                const someOn = allIds.some((id) => selected.has(id));

                return (
                  <div key={g.subject.id} className="rounded-lg border border-line">
                    <button
                      onClick={() => toggleSubject(g.subject.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left"
                    >
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={(el) => { if (el) el.indeterminate = someOn && !allOn; }}
                        readOnly
                        className="h-4 w-4 accent-[var(--t-accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {subjectName}
                      </span>
                    </button>

                    <div className="border-t border-line bg-muted/30 p-2">
                      {Array.from(g.comps.values()).map((c) => {
                        const cAllOn  = c.indIds.every((id) => selected.has(id));
                        const cSomeOn = c.indIds.some((id) => selected.has(id));
                        return (
                          <div key={c.comp.id} className="mb-1.5 last:mb-0">
                            <button
                              onClick={() => toggleComp(g.subject.id, c.comp.id)}
                              className="flex w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                checked={cAllOn}
                                ref={(el) => { if (el) el.indeterminate = cSomeOn && !cAllOn; }}
                                readOnly
                                className="h-3.5 w-3.5 accent-[var(--t-accent)]"
                              />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-muted">
                                {c.comp.name}
                              </span>
                            </button>

                            <ul className="ml-6 space-y-0.5">
                              {c.indIds.map((colId) => {
                                const ind = indById[colId];
                                const missing = missingCounts[colId];
                                const on = selected.has(colId);
                                return (
                                  <li key={colId}>
                                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 hover:bg-muted">
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => toggle(colId)}
                                        className="h-3.5 w-3.5 accent-[var(--t-accent)]"
                                      />
                                      <span className="min-w-0 flex-1 truncate text-xs">
                                        {ind?.name ?? '(deleted)'}
                                      </span>
                                      <span className={`text-[10px] tabular-nums ${
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedCount > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Preview</span>
                <span className="text-xs text-ink-subtle">
                  {selectedCount} indicator{selectedCount === 1 ? '' : 's'}
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