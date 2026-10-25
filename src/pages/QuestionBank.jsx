import { useState, useEffect, useMemo } from 'react';
import { Plus, Target, Search, Pencil, Trash2, Image as ImageIcon, Upload, CheckSquare, Square, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeSubjects, subscribeCompetencies, subscribeIndicators } from '../lessons';
import AddQuestionModal from '../AddQuestionModal';
import ImportQuestions from '../ImportQuestions';
import { deleteQuestion, bulkDeleteQuestions } from '../questions';

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [comps, setComps] = useState([]);
  const [inds, setInds] = useState([]);
  
  const [activeSubId, setActiveSubId] = useState('');
  const [activeCompId, setActiveCompId] = useState('');
  const [activeIndId, setActiveIndId] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setQuestions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);
  useEffect(() => subscribeSubjects(setSubjects), []);
  useEffect(() => subscribeCompetencies(setComps), []);
  useEffect(() => subscribeIndicators(setInds), []);

  const filteredComps = useMemo(() => comps.filter(c => c.subjectId === activeSubId), [comps, activeSubId]);
  const filteredInds = useMemo(() => inds.filter(i => i.competencyId === activeCompId), [inds, activeCompId]);

  const visibleQuestions = useMemo(() => {
    if (!activeIndId) return [];
    return questions.filter(q => q.indicatorId === activeIndId);
  }, [questions, activeIndId]);

  const activeInd = inds.find(i => i.id === activeIndId);

  // Reset selection when switching indicators
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedIds([]);
  }, [activeIndId]);

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSingle = async (id) => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion(id);
  };

  const handleDeleteBatch = async () => {
    if (!confirm(`Delete ${selectedIds.length} questions?`)) return;
    setDeleting(true);
    try {
      await bulkDeleteQuestions(selectedIds);
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20"> {/* pb-20 for floating bar clearance */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Question Bank</h1>
      </div>

      {/* CONTEXT BAR */}
      <div className="rounded-xl border border-line bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1 text-sm font-medium text-ink-muted">
          <Target size={16} /> Workspace Context
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={activeSubId} onChange={e => { setActiveSubId(e.target.value); setActiveCompId(''); setActiveIndId(''); }} className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">1. Select Subject...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={activeCompId} onChange={e => { setActiveCompId(e.target.value); setActiveIndId(''); }} disabled={!activeSubId} className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50">
            <option value="">2. Select Competency...</option>
            {filteredComps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={activeIndId} onChange={e => setActiveIndId(e.target.value)} disabled={!activeCompId} className="w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50">
            <option value="">3. Select Indicator...</option>
            {filteredInds.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      </div>

      {/* LIST */}
      {!activeIndId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong p-12 text-center">
          <Search size={40} className="text-ink-subtle mb-3" />
          <p className="text-ink-muted">Select a Subject, Competency, and Indicator above to view or add questions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-medium">
              {visibleQuestions.length} question{visibleQuestions.length === 1 ? '' : 's'} for <span className="text-accent">{activeInd?.name}</span>
            </h2>
            
            <div className="flex gap-2">
              {visibleQuestions.length > 0 && (
                <button 
                  onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} 
                  className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition shadow-sm ${
                    isSelectMode ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-card hover:border-accent hover:text-accent'
                  }`}
                >
                  {isSelectMode ? <X size={16} /> : <CheckSquare size={16} />}
                  {isSelectMode ? 'Cancel' : 'Select'}
                </button>
              )}

              <button onClick={() => setShowImport(true)} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm font-medium transition hover:border-accent hover:text-accent shadow-sm">
                <Upload size={16} /> Import
              </button>
              
              <button onClick={() => { setEditingQuestion(null); setShowAdd(true); }} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover shadow-sm">
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-2">
            {visibleQuestions.map(q => {
              const answerLetter = q.answer?.toUpperCase();
              const answerIndex = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;
              const answerText = q.options?.[answerIndex] || '';
              const isSelected = selectedIds.includes(q.id);

              return (
                <div 
                  key={q.id} 
                  onClick={() => isSelectMode && toggleSelection(q.id)}
                  className={`group relative rounded-xl border p-4 transition ${
                    isSelectMode ? 'cursor-pointer hover:border-accent' : 'hover:border-accent/50'
                  } ${isSelected ? 'border-accent bg-accent-soft/10' : 'border-line bg-card'}`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex gap-2 text-xs text-ink-muted items-center flex-wrap">
                      
                      {/* Checkbox in Select Mode */}
                      {isSelectMode && (
                        <div className="text-accent shrink-0">
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                      )}

                      <span className="bg-muted px-2 py-0.5 rounded">{q.type.toUpperCase()}</span>
                      
                      {q.type === 'mcq' && answerLetter && (
                        <span 
                          className="bg-emerald-500/10 text-emerald-500 font-medium px-2 py-0.5 rounded max-w-[180px] sm:max-w-[400px] truncate inline-block align-bottom"
                          title={`Kunci: ${answerLetter} - ${answerText}`}
                        >
                          Kunci: {answerLetter} "{answerText}"
                        </span>
                      )}

                      {q.imageUrl && <span className="flex items-center gap-1 text-indigo-500"><ImageIcon size={12}/> Image</span>}
                    </div>

                    {/* Action Buttons (Hide in Select Mode) */}
                    {!isSelectMode && (
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); setShowAdd(true); }}
                          className="p-1.5 text-ink-muted hover:text-accent hover:bg-accent-soft rounded-md transition"
                          title="Edit Question"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteSingle(q.id); }}
                          className="p-1.5 text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition"
                          title="Delete Question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="font-medium pl-0">{q.text}</p>
                </div>
              );
            })}
            
            {visibleQuestions.length === 0 && (
              <p className="text-ink-muted text-center py-8 border border-dashed border-line rounded-xl">
                No questions yet for this indicator. Click Add to start.
              </p>
            )}
          </div>
        </div>
      )}

      {/* FLOATING BATCH DELETE BAR */}
      {isSelectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md bg-card border border-line shadow-2xl rounded-full flex items-center justify-between p-2 pl-5 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <button 
            onClick={handleDeleteBatch}
            disabled={deleting}
            className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition"
          >
            <Trash2 size={16} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {/* MODALS */}
      {showAdd && (
        <AddQuestionModal 
          subjectId={activeSubId}
          competencyId={activeCompId}
          indicatorId={activeIndId}
          subjectName={subjects.find(s => s.id === activeSubId)?.name}
          competencyName={comps.find(c => c.id === activeCompId)?.name}
          indicatorName={activeInd?.name}
          existingQuestions={visibleQuestions.slice(0, 5)}
          editQuestion={editingQuestion}
          onClose={() => { setShowAdd(false); setEditingQuestion(null); }} 
        />
      )}

      {showImport && (
        <ImportQuestions 
          subjectId={activeSubId}
          competencyId={activeCompId}
          indicatorId={activeIndId}
          indicatorName={activeInd?.name}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}