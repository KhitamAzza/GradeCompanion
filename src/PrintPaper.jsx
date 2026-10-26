import { createPortal } from 'react-dom';
import { ArrowLeft, Printer } from 'lucide-react';

const NUM_W = '6.35mm'; // hanging width of "1." / "a."

const imageSizeClass = (size) => {
  if (size === 'small') return 'w-1/3';
  if (size === 'large') return 'w-full';
  return 'w-2/3';
};

function Question({ q, index, showOptions }) {
  return (
    <div className="flex" style={{ breakInside: 'avoid' }}>
      <div style={{ width: NUM_W, marginLeft: NUM_W, flexShrink: 0 }}>{index + 1}.</div>
      <div className="flex-1 min-w-0">
        <div>{q.text}</div>

        {q.imageUrl && (
          <div className="my-1">
            <img
              src={q.imageUrl}
              alt={`Gambar ${index + 1}`}
              className={`${imageSizeClass(q.imageSize)} object-contain`}
            />
          </div>
        )}

        {showOptions &&
          q.options.map((opt, j) => (
            <div key={j} className="flex">
              <div style={{ width: NUM_W, flexShrink: 0 }}>{String.fromCharCode(97 + j)}.</div>
              <div className="flex-1 min-w-0">{opt}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function PrintPaper({ paper, onBack }) {
  // Treat missing type as MCQ
  const mcqs = paper.questions.filter((q) => q.type === 'mcq' || !q.type);
  const essays = paper.questions.filter((q) => q.type === 'essay');

  return createPortal(
    <div className="print-root fixed inset-0 z-[9999] overflow-auto bg-slate-200 py-8 print:bg-white print:py-0">
      {/* Page setup for printing / Save as PDF */}
      <style>{`
        @page { size: portrait; margin: 10mm; }
        @media print {
          html, body { margin: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
          /* hide the whole app (menu, sidebar, etc.) - only the paper is printed */
          body > *:not(.print-root) { display: none !important; }
          .print-root { position: static !important; inset: auto !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
          .exam-paper { width: auto !important; min-height: 0 !important; padding: 0 !important; box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
          <ArrowLeft size={18} /> Back to Builder
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
        >
          <Printer size={18} /> Save as PDF / Print
        </button>
      </div>

      {/* Paper: F4, 10mm margins */}
      <div
        className="exam-paper mx-auto bg-white shadow-xl"
        style={{
          width: '210mm',
          minHeight: '330mm',
          padding: '10mm',
          boxSizing: 'border-box',
          fontFamily: 'Cambria, Caladea, "Times New Roman", serif',
          fontSize: '11pt',
          lineHeight: 1.17, // Word "single" for Cambria
          color: '#000',
        }}
      >
        {/* Kop surat */}
        {paper.headerImageUrl && (
          <img
            src={paper.headerImageUrl}
            alt="Kop"
            style={{ display: 'block', width: '100%', height: '35mm', objectFit: 'fill' }}
          />
        )}

        {/* Thin grey rule under the kop */}
        <div style={{ height: '1.5pt', background: '#A0A0A0', margin: '2mm 0 4mm' }} />

        {/* Meta info: indented 35mm, two columns */}
        <table style={{ marginLeft: '35mm', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ whiteSpace: 'nowrap' }}>Mata Pelajaran</td>
              <td style={{ padding: '0 2mm' }}>:</td>
              <td style={{ paddingRight: '14mm', minWidth: '35mm' }}>{paper.subjectName}</td>
              <td style={{ whiteSpace: 'nowrap' }}>Hari/Tanggal</td>
              <td style={{ padding: '0 2mm' }}>:</td>
              <td>{paper.dayDate}</td>
            </tr>
            <tr>
              <td style={{ whiteSpace: 'nowrap' }}>Kelas/Program</td>
              <td style={{ padding: '0 2mm' }}>:</td>
              <td style={{ paddingRight: '14mm' }}>{paper.className}</td>
              <td style={{ whiteSpace: 'nowrap' }}>Waktu</td>
              <td style={{ padding: '0 2mm' }}>:</td>
              <td>{paper.time}</td>
            </tr>
          </tbody>
        </table>

        {/* Divider between meta info and questions */}
        <div style={{ borderTop: '1px solid #000', margin: '3mm 0 4mm' }} />

        {/* Questions: 2 columns, 12.7mm gap */}
        <div style={{ columnCount: 2, columnGap: '12.7mm' }}>
          {mcqs.length > 0 && (
            <>
              <div className="font-bold">{paper.mcqInstruction || 'A. Pilihlah jawaban yang benar !'}</div>
              {mcqs.map((q, i) => (
                <Question key={q.id} q={q} index={i} showOptions />
              ))}
            </>
          )}

          {essays.length > 0 && (
            <>
              <div className="font-bold" style={{ marginTop: mcqs.length ? '4mm' : 0 }}>
                {paper.essayInstruction || 'B. Jawablah pertanyaan di bawah ini dengan tepat !'}
              </div>
              {essays.map((q, i) => (
                <Question key={q.id} q={q} index={i} showOptions={false} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}