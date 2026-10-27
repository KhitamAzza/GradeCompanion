import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, Image as ImageIcon, Loader2, Plus, X, CheckSquare, Square, Printer, Trash2, ArrowRight, Shuffle, ChevronRight, ChevronDown, ClipboardCheck } from 'lucide-react';
import { subscribeSubjects, subscribeCompetencies, subscribeIndicators } from '../lessons';
import { subscribeStudents } from '../students';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadQuestionImage } from '../questions';
import { createPaper, updatePaper, subscribePapers, deletePaper } from '../exampapers';
import { createExam } from '../exams';
import PrintPaper from '../PrintPaper';

export default function ExamBuilder() {
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  // Metadata State
  const [paperId, setPaperId] = useState(null);
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');
  const [targetClasses, setTargetClasses] = useState([]);
  const [dayDate, setDayDate] = useState('');
  const [time, setTime] = useState('');
  const [mcqInstruction, setMcqInstruction] = useState('A. Pilihlah jawaban yang benar !');
  const [essayInstruction, setEssayInstruction] = useState('Jawablah pertanyaan di Bawah ini dengan Tepat !');
  const [shrinkFormat, setShrinkFormat] = useState(false);
  
  // Selected Questions State
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  // Data State
  const [bankQuestions, setBankQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [comps, setComps] = useState([]);
  const [inds, setInds] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);

  // Drafts List State
  const [drafts, setDrafts] = useState([]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    const unsubQ = onSnapshot(q, snap => setBankQuestions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const unsubDrafts = subscribePapers(setDrafts);
    const unsubSub = subscribeSubjects(setSubjects);
    const unsubComp = subscribeCompetencies(setComps);
    const unsubInd = subscribeIndicators(setInds);
    const unsubStudents = subscribeStudents(setStudents);

    return () => { 
      unsubQ(); unsubDrafts(); unsubSub(); unsubComp(); unsubInd(); unsubStudents(); 
    };
  }, []);

  const availableClasses = useMemo(() => {
    return [...new Set(students.map(s => s.class))].sort();
  }, [students]);

  const toggleTargetClass = (cls) => {
    setTargetClasses(prev => 
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const handleHeaderUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadQuestionImage(file);
      setHeaderImageUrl(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleScramble = () => {
    if (selectedQuestions.length === 0) return;
    if (!confirm('Scramble all MCQ options? This will randomize A, B, C, D, E and update the answer key.')) return;

    const scrambled = selectedQuestions.map(q => {
      // Treat missing type as MCQ
      if ((q.type && q.type !== 'mcq') || !q.options || q.options.length === 0) return q;

      const mappedOpts = q.options.map((opt, i) => ({
        text: opt,
        isCorrect: i === (q.answer.charCodeAt(0) - 65)
      }));

      for (let i = mappedOpts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mappedOpts[i], mappedOpts[j]] = [mappedOpts[j], mappedOpts[i]];
      }

      const newCorrectIndex = mappedOpts.findIndex(o => o.isCorrect);
      
      return {
        ...q,
        options: mappedOpts.map(o => o.text),
        answer: String.fromCharCode(65 + newCorrectIndex)
      };
    });

    setSelectedQuestions(scrambled);
    alert('Options scrambled successfully!');
  };

  // Treat missing type as 'mcq' for legacy data
  const sortedSelected = useMemo(() => {
    const mcqs = selectedQuestions.filter(q => q.type === 'mcq' || !q.type);
    const essays = selectedQuestions.filter(q => q.type === 'essay');
    return [...mcqs, ...essays];
  }, [selectedQuestions]);

  const handleSaveDraft = async () => {
    if (!subjectName.trim()) return alert('Please enter at least the Subject Name to save.');
    setSaving(true);
    try {
      const payload = {
        headerImageUrl, subjectName, className, targetClasses, dayDate, time,
        mcqInstruction, essayInstruction, shrinkFormat,
        questions: sortedSelected
      };
      
      if (paperId) {
        await updatePaper(paperId, payload);
        alert('Draft updated!');
      } else {
        const docRef = await createPaper(payload);
        setPaperId(docRef.id);
        alert('Draft saved! You can finish it later.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCorrection = async () => {
    if (!subjectName.trim()) return alert('Subject Name is required.');
    if (targetClasses.length === 0) return alert('Please select at least one Target Class for the correction session.');
    if (selectedQuestions.length === 0) return alert('No questions selected.');

    const mcqs = sortedSelected.filter(q => q.type === 'mcq' || !q.type);
    const essays = sortedSelected.filter(q => q.type === 'essay');
    
    const key = {};
    mcqs.forEach((q, i) => {
      key[String(i + 1)] = q.answer || 'A';
    });

    const maxOptions = mcqs.length > 0 
      ? Math.max(...mcqs.map(q => q.options?.length || 4)) 
      : 4;

    const mcqWeight = mcqs.length > 0 && essays.length > 0 ? 60 : (mcqs.length > 0 ? 100 : 0);
    const essayWeight = 100 - mcqWeight;

    setCreatingExam(true);
    try {
      await createExam({
        subject: subjectName,
        classes: targetClasses,
        mcqCount: mcqs.length,
        optionCount: maxOptions,
        essayCount: essays.length,
        mcqWeight,
        essayWeight,
        passingThreshold: 75,
        key,
        status: 'draft'
      });
      alert('Correction session created! Go to the Correction page to start grading.');
    } catch (err) {
      alert('Failed to create correction session: ' + err.message);
    } finally {
      setCreatingExam(false);
    }
  };

  const handleLoadDraft = (draft) => {
    setShrinkFormat(draft.shrinkFormat || false);
    setPaperId(draft.id);
    setHeaderImageUrl(draft.headerImageUrl || '');
    setSubjectName(draft.subjectName || '');
    setClassName(draft.className || '');
    setTargetClasses(draft.targetClasses || []);
    setDayDate(draft.dayDate || '');
    setTime(draft.time || '');
    setMcqInstruction(draft.mcqInstruction || 'A. Pilihlah jawaban yang benar !');
    setEssayInstruction(draft.essayInstruction || 'Jawablah pertanyaan di Bawah ini dengan Tepat !');
    setSelectedQuestions(draft.questions || []);
  };

  const resetBuilder = () => {
    setPaperId(null);
    setHeaderImageUrl('');
    setSubjectName('');
    setClassName('');
    setTargetClasses([]);
    setDayDate('');
    setTime('');
    setMcqInstruction('A. Pilihlah jawaban yang benar !');
    setEssayInstruction('Jawablah pertanyaan di Bawah ini dengan Tepat !');
    setSelectedQuestions([]);
  };

    if (isPrintMode) {
    return (
      <PrintPaper 
        paper={{ 
          headerImageUrl, subjectName, className, dayDate, time, 
          mcqInstruction, essayInstruction, questions: sortedSelected,
          shrinkFormat // PASS IT HERE
        }} 
        onBack={() => setIsPrintMode(false)} 
      />
    );
  }

  // Drafts Dashboard
  if (!paperId && drafts.length > 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Exam Papers</h1>
          <button onClick={resetBuilder} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg hover:bg-accent-hover shadow-sm">
            <Plus size={16} /> New Paper
          </button>
        </div>

        <div className="space-y-2">
          {drafts.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-line bg-card p-4 hover:border-accent/50 transition">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleLoadDraft(d)}>
                <div className="font-medium text-lg truncate">{d.subjectName || 'Untitled Paper'}</div>
                <div className="text-sm text-ink-muted">
                  {d.targetClasses?.join(', ') || d.className || 'No Class'} · {d.questions?.length || 0} Questions
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if(confirm('Delete this draft?')) deletePaper(d.id); }} className="p-2 text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg">
                  <Trash2 size={18} />
                </button>
                <button onClick={() => handleLoadDraft(d)} className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  Edit <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{paperId ? 'Edit Paper' : 'Create Exam Paper'}</h1>
          {paperId && <button onClick={resetBuilder} className="text-xs text-ink-muted hover:text-accent underline">Back to list</button>}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSaveDraft} disabled={saving} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          
          <button onClick={handleCreateCorrection} disabled={creatingExam || selectedQuestions.length === 0} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50" title="Generate Answer Key & Session">
            <ClipboardCheck size={16} /> {creatingExam ? 'Creating...' : 'Create Correction'}
          </button>

          <button onClick={() => {
            if (!subjectName || selectedQuestions.length === 0) return alert('Please fill in the subject name and select at least one question.');
            setIsPrintMode(true);
          }} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">
            <Printer size={16} /> Preview & Print
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-5 space-y-4 shadow-sm">
        <h2 className="font-semibold border-b border-line pb-2">1. Document Header & Setup</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-ink-muted">School Header Image (Kop Surat)</label>
            {headerImageUrl ? (
              <div className="relative flex items-center justify-between rounded-lg border border-line p-2 bg-muted/30">
                <img src={headerImageUrl} alt="Header" className="h-16 object-contain" />
                <button onClick={() => setHeaderImageUrl('')} className="text-rose-500 p-2 hover:bg-rose-500/10 rounded"><X size={18}/></button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted hover:border-accent hover:text-accent w-full justify-center">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                {uploading ? 'Uploading...' : 'Upload Header Image (PNG/JPG)'}
              </button>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleHeaderUpload} className="hidden" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Mata Pelajaran (PDF Display)</label>
            <input value={subjectName} onChange={e => setSubjectName(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="e.g. TPAV" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Kelas / Program (PDF Display)</label>
            <input value={className} onChange={e => setClassName(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="e.g. X DKV" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Hari / Tanggal</label>
            <input value={dayDate} onChange={e => setDayDate(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="e.g. Senin, 20 Oktober 2025" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Waktu</label>
            <input value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="e.g. 07:30 - 09:00" />
          </div>

          {/* TARGET CLASSES */}
          <div className="col-span-1 sm:col-span-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <label className="mb-2 block text-xs font-medium text-emerald-600">
              Target Classes for Correction (Wajib dipilih)
            </label>
            {availableClasses.length === 0 ? (
              <p className="text-sm text-rose-500">No classes found in database. Add students first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableClasses.map(c => {
                  const isSelected = targetClasses.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleTargetClass(c)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-line-strong bg-card text-ink-muted hover:border-emerald-500 hover:text-emerald-600'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[10px] text-ink-muted">
              Select the exact classes that will take this exam. These students will appear in the Correction module.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">MCQ Instruction (Bold)</label>
            <input value={mcqInstruction} onChange={e => setMcqInstruction(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Essay Instruction (Bold)</label>
            <input value={essayInstruction} onChange={e => setEssayInstruction(e.target.value)} className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
        </div>
      </div>

      {/* QUESTION SELECTOR */}
      <div className="rounded-xl border border-line bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-line pb-2 gap-2">
          
          <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2 flex-wrap">
            <span className="text-blue-500">{selectedQuestions.filter(q => q.type === 'mcq' || !q.type).length} MCQ</span>
            <span className="text-ink-muted">and</span>
            <span className="text-amber-500">{selectedQuestions.filter(q => q.type === 'essay').length} Essay</span>
            <span className="text-ink-muted font-normal">selected (total {selectedQuestions.length} Questions)</span>
          </h2>

          <div className="flex gap-2">
             <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-muted hover:text-ink bg-muted/30 px-3 py-1.5 rounded-lg border border-line">
              <input 
                type="checkbox" 
                checked={shrinkFormat} 
                onChange={(e) => setShrinkFormat(e.target.checked)}
                className="accent-accent"
              />
              Shrink Options
            </label>
            <button onClick={handleScramble} disabled={selectedQuestions.length === 0} className="flex items-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted hover:text-accent disabled:opacity-50" title="Scramble MCQ Options">
              <Shuffle size={16} /> Scramble
            </button>
            <button onClick={() => setShowPicker(true)} className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover">
              <Plus size={16} /> Add Questions
            </button>
          </div>
        </div>

        {selectedQuestions.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-6">No questions selected. Click "Add Questions" to pull from the Question Bank.</p>
        ) : (
          <div className="space-y-2">
            {sortedSelected.map((q, idx) => (
              <div key={q.id} className="flex items-start gap-3 rounded-lg border border-line p-3 bg-muted/20">
                <div className="font-bold text-ink-muted shrink-0 w-6 text-center">{idx + 1}.</div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 mb-1">
                    <span className="text-xs font-medium text-ink-muted">{q.type === 'essay' ? 'ESSAY' : 'MCQ'}</span>
                    {q.type !== 'essay' && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1 rounded">Key: {q.answer}</span>}
                  </div>
                  <p className="text-sm truncate">{q.text}</p>
                </div>
                <button onClick={() => setSelectedQuestions(prev => prev.filter(x => x.id !== q.id))} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded shrink-0">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPicker && (
        <QuestionPickerModal 
          bank={bankQuestions}
          subjects={subjects}
          comps={comps}
          inds={inds}
          selectedIds={selectedQuestions.map(q => q.id)}
          onSelect={(qs) => setSelectedQuestions(qs)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

/* --- Subcomponent: Grouped Question Picker --- */
function QuestionPickerModal({ bank, subjects, comps, inds, selectedIds, onSelect, onClose }) {
  const [tempSelected, setTempSelected] = useState(selectedIds);
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleSelect = (id) => {
    setTempSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectedBreakdown = useMemo(() => {
    let mcq = 0;
    let essay = 0;
    tempSelected.forEach(id => {
      const q = bank.find(item => item.id === id);
      if (q?.type === 'essay') essay++;
      else mcq++;
    });
    return { mcq, essay, total: tempSelected.length };
  }, [tempSelected, bank]);

  const apply = () => {
    const selectedObjs = bank.filter(q => tempSelected.includes(q.id));
    onSelect(selectedObjs);
    onClose();
  };

  const grouped = useMemo(() => {
    return subjects.map(sub => {
      const subComps = comps.filter(c => c.subjectId === sub.id);
      return {
        ...sub,
        comps: subComps.map(comp => {
          const compInds = inds.filter(i => i.competencyId === comp.id);
          return {
            ...comp,
            inds: compInds.map(ind => {
              const indQuestions = bank.filter(q => q.indicatorId === ind.id);
              return { ...ind, questions: indQuestions };
            }).filter(i => i.questions.length > 0)
          };
        }).filter(c => c.inds.length > 0)
      };
    }).filter(s => s.comps.length > 0);
  }, [subjects, comps, inds, bank]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-card sm:h-[90dvh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line sm:shadow-xl">
        
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h2 className="text-lg font-semibold">Select Questions</h2>
            <p className="text-xs text-ink-muted">Filtered by Subject › Competency › Indicator</p>
          </div>
          <button onClick={onClose} className="p-2 text-ink-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
          {grouped.map(sub => (
            <div key={sub.id} className="rounded-xl border border-line bg-card overflow-hidden">
              <button onClick={() => toggleExpand(sub.id)} className="flex w-full items-center gap-2 bg-muted/30 p-3 text-left">
                {expanded[sub.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="font-semibold text-sm">{sub.name}</span>
              </button>

              {expanded[sub.id] && (
                <div className="p-3 space-y-2 border-t border-line">
                  {sub.comps.map(comp => (
                    <div key={comp.id} className="rounded-lg border border-line bg-canvas/50 overflow-hidden">
                      <button onClick={() => toggleExpand(comp.id)} className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-muted/50 transition">
                        {expanded[comp.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="font-medium text-ink-muted">{comp.name}</span>
                      </button>

                      {expanded[comp.id] && (
                        <div className="p-2 space-y-2">
                          {comp.inds.map(ind => (
                            <div key={ind.id} className="rounded-md border border-line bg-card">
                              <button onClick={() => toggleExpand(ind.id)} className="flex w-full items-center gap-2 p-2 text-left text-xs hover:bg-muted/30 transition">
                                {expanded[ind.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span className="font-semibold text-accent">{ind.name}</span>
                                <span className="text-ink-subtle ml-auto">{ind.questions.length} questions</span>
                              </button>

                              {expanded[ind.id] && (
                                <div className="p-2 space-y-1.5 border-t border-line">
                                  {[...ind.questions]
                                    .sort((a, b) => {
                                      const aType = a.type || 'mcq';
                                      const bType = b.type || 'mcq';
                                      return aType.localeCompare(bType) === 0 ? 0 : aType === 'mcq' ? -1 : 1;
                                    })
                                    .map(q => {
                                      const isSel = tempSelected.includes(q.id);
                                      const isMcq = q.type !== 'essay';
                                      
                                      return (
                                        <div key={q.id} onClick={() => toggleSelect(q.id)} className={`flex gap-2 rounded-lg border p-2 cursor-pointer transition ${isSel ? 'border-accent bg-accent-soft/10' : 'border-line bg-card hover:border-accent/50'}`}>
                                          <div className={`mt-0.5 shrink-0 ${isSel ? 'text-accent' : 'text-ink-muted'}`}>
                                            {isSel ? <CheckSquare size={16} /> : <Square size={16} />}
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                isMcq ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                                              }`}>
                                                {isMcq ? 'MCQ' : 'ESSAY'}
                                              </span>
                                            </div>
                                            <p className="text-xs font-medium line-clamp-2">{q.text}</p>
                                          </div>
                                        </div>
                                      );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {grouped.length === 0 && <p className="text-center text-ink-muted py-8">No questions available in the bank.</p>}
        </div>

                <div className="border-t border-line p-4 flex gap-2 bg-card">
          <button onClick={onClose} className="flex-1 rounded-lg border border-line-strong py-2 font-medium hover:bg-muted">Cancel</button>
          
          <button 
            onClick={apply} 
            disabled={selectedBreakdown.total === 0} 
            className="flex-1 rounded-lg bg-accent py-2 font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {selectedBreakdown.total === 0 
              ? 'Select Questions' 
              : `Add ${selectedBreakdown.mcq} MCQ & ${selectedBreakdown.essay} Essay`}
          </button>
        </div>
      </div>
    </div>
  );
}