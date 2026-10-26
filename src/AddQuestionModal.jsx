import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon, Loader2, Trash2, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { uploadQuestionImage, saveQuestion, updateQuestion, generateAIQuestions } from './questions';

export default function AddQuestionModal({ 
  subjectId, competencyId, indicatorId,
  subjectName, competencyName, indicatorName,
  onClose, existingQuestions, editQuestion 
}) {
  const isEditing = !!editQuestion;

  const [type, setType] = useState('mcq');
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '', '']);
  const [answer, setAnswer] = useState('A');

  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState('medium'); 
  const [uploadingImg, setUploadingImg] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiProvider, setAiProvider] = useState('');
  const [selectedSugs, setSelectedSugs] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(''); // NEW: Manual prompt state
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editQuestion) {
      setType(editQuestion.type || 'mcq');
      setText(editQuestion.text || '');
      setOptions(editQuestion.options?.length ? editQuestion.options : ['', '', '', '', '']);
      setAnswer(editQuestion.answer || 'A');
      setImageUrl(editQuestion.imageUrl || '');
      setImageSize(editQuestion.imageSize || 'medium');
    }
  }, [editQuestion]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadQuestionImage(file);
      setImageUrl(url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingImg(false);
    }
  };

    const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const result = await generateAIQuestions(
        subjectName, competencyName, indicatorName, existingQuestions, type, aiPrompt 
      );
      
      // result is now an object: { questions: [...], provider: '...' }
      if (result && result.questions && result.questions.length > 0) {
        setAiSuggestions(result.questions);
        setAiProvider(result.provider); // <-- SAVE PROVIDER HERE
        setSelectedSugs([]);
      } else {
        alert("AI couldn't generate questions. Try again.");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSugSelection = (index) => {
    setSelectedSugs(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleBulkSave = async () => {
    if (selectedSugs.length === 0) return;
    setBulkSaving(true);
    try {
      for (const idx of selectedSugs) {
        const sug = aiSuggestions[idx];
        await saveQuestion({
          type,
          text: sug.text,
          options: type === 'mcq' ? [...(sug.options || []), '', '', '', '', ''].slice(0, 5) : [],
          answer: type === 'mcq' ? (sug.answer || 'A') : '',
          subjectId, competencyId, indicatorId,
          imageUrl: '', imageSize: 'medium'
        });
      }
      onClose();
    } catch (err) {
      alert("Failed to save some questions: " + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSave = async (closeAfter = false) => {
    if (!text.trim()) return alert('Please enter the question text.');
    setSaving(true);
    try {
      const payload = {
        type,
        text,
        options: type === 'mcq' ? options : [],
        answer: type === 'mcq' ? answer : '',
        subjectId, competencyId, indicatorId,
        imageUrl, imageSize
      };

      if (isEditing) {
        await updateQuestion(editQuestion.id, payload);
        onClose();
      } else {
        await saveQuestion(payload);
        if (closeAfter) {
          onClose();
        } else {
          setSavedSuccess(true);
          setTimeout(() => {
            setText('');
            setOptions(['', '', '', '', '']);
            setAnswer('A');
            setImageUrl('');
            setSavedSuccess(false);
          }, 1500);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-card sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl sm:border sm:border-line sm:shadow-xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{isEditing ? 'Edit Question' : 'Add Question'}</h2>
            <div className="truncate text-xs text-ink-muted">
              {subjectName} › {competencyName} › <span className="text-accent font-medium">{indicatorName}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-ink-muted hover:text-ink ml-2">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {savedSuccess && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/90 backdrop-blur-sm rounded-2xl">
              <CheckCircle2 size={48} className="text-emerald-500 mb-2" />
              <p className="font-medium text-ink">Question Saved!</p>
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {['mcq', 'essay'].map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${type === t ? 'bg-card shadow text-ink' : 'text-ink-muted'}`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* AI SUGGESTIONS SECTION */}
          {!isEditing && (
            <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-500">
                <Sparkles size={14} /> AI Assistant
              </div>
              <input 
                value={aiPrompt} 
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Extra instructions (e.g. 'Focus on practical examples')..." 
                className="w-full rounded-md border border-indigo-500/20 bg-card px-3 py-1.5 text-xs outline-none focus:border-indigo-400" 
              />
              <button onClick={handleAiSuggest} disabled={aiLoading || !indicatorId}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50">
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {aiLoading ? 'Generating...' : `Generate ${type === 'mcq' ? 'MCQs' : 'Essays'}`}
              </button>
            </div>
          )}

          {/* Question Text */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Question Text</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              className="w-full resize-none rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder="Type the question here..." />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
             <label className="mb-1 block text-xs font-medium text-ink-muted">Image (Optional)</label>
             {imageUrl ? (
               <div className="relative rounded-lg border border-line bg-muted/30 p-2 flex flex-col items-center">
                 <img src={imageUrl} alt="preview" className={`rounded object-contain ${imageSize === 'small' ? 'w-1/3' : imageSize === 'medium' ? 'w-2/3' : 'w-full'} max-h-48`} />
                 <div className="mt-2 flex items-center justify-between w-full">
                   <div className="flex gap-2 text-xs">
                     {['small', 'medium', 'large'].map(sz => (
                       <label key={sz} className="flex items-center gap-1 cursor-pointer">
                         <input type="radio" checked={imageSize === sz} onChange={() => setImageSize(sz)} className="accent-accent" />
                         {sz}
                       </label>
                     ))}
                   </div>
                   <button onClick={() => setImageUrl('')} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded"><Trash2 size={16}/></button>
                 </div>
               </div>
             ) : (
               <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}
                 className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong py-4 text-sm text-ink-muted hover:border-accent hover:text-accent">
                 {uploadingImg ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                 {uploadingImg ? 'Uploading...' : 'Upload Image'}
               </button>
             )}
             <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          </div>

          {/* Options */}
          {type === 'mcq' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-ink-muted">Options</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-center font-bold text-ink-muted">{String.fromCharCode(65 + i)}</span>
                  <input value={opt} onChange={e => {
                    const newOpts = [...options]; newOpts[i] = e.target.value; setOptions(newOpts);
                  }} className="flex-1 rounded-lg border border-line-strong bg-card px-3 py-2 text-sm outline-none focus:border-accent" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                </div>
              ))}
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs font-medium text-ink-muted">Kunci:</label>
                {options.map((_, i) => (
                  <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="answer" checked={answer === String.fromCharCode(65 + i)} onChange={() => setAnswer(String.fromCharCode(65 + i))} className="accent-accent" />
                    {String.fromCharCode(65 + i)}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-4 flex gap-2">
          {isEditing ? (
             <button onClick={() => handleSave(true)} disabled={saving} className="w-full rounded-lg bg-accent py-3 font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50">
               {saving ? 'Saving...' : 'Save Changes'}
             </button>
          ) : (
            <>
              <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 rounded-lg border border-line-strong bg-card py-3 font-medium text-ink hover:bg-muted disabled:opacity-50">
                Save & Close
              </button>
              <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 rounded-lg bg-accent py-3 font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50">
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI SUGGESTIONS MODAL OVERLAY */}
      {aiSuggestions && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:rounded-2xl">
          <div className="w-full max-w-lg rounded-xl bg-card p-5 shadow-2xl border border-line flex flex-col max-h-full">
                        {/* Replace this block in the AI Modal overlay */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-indigo-500"/>
                <h3 className="font-semibold text-lg">AI Suggestions</h3>
              </div>
              <span className="text-[10px] font-medium bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Powered by {aiProvider || 'AI'}
              </span>
            </div>
            <p className="text-xs text-ink-muted mb-4">Check multiple to bulk save, or click a card to edit it manually.</p>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {aiSuggestions.map((sug, i) => {
                const isSelected = selectedSugs.includes(i);
                return (
                  <div 
                    key={i} 
                    className={`group relative flex gap-3 rounded-xl border p-4 text-sm transition bg-card cursor-pointer ${isSelected ? 'border-accent bg-accent-soft/10' : 'border-line hover:border-accent/50'}`}
                    onClick={() => toggleSugSelection(i)}
                  >
                    <div className="mt-0.5 text-ink-muted hover:text-accent shrink-0">
                      {isSelected ? <CheckSquare size={20} className="text-accent" /> : <Square size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-3">{sug.text}</p>
                      
                      {/* ALWAYS SHOW ALL OPTIONS FOR MCQ */}
                      {type === 'mcq' && sug.options && (
                        <ul className="space-y-1.5 text-ink-muted text-xs mb-3">
                          {sug.options.map((o, j) => (
                            <li key={j} className={`flex gap-2 ${sug.answer === String.fromCharCode(65+j) ? 'text-emerald-500 font-medium' : ''}`}>
                              <span className="font-bold">{String.fromCharCode(65+j)}.</span> {o}
                            </li>
                          ))}
                        </ul>
                      )}
                      
                      <div className="text-[10px] text-ink-subtle italic">Check to bulk save to bank</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setAiSuggestions(null)} className="flex-1 py-2.5 rounded-lg border border-line-strong text-sm font-medium hover:bg-muted">
                Cancel
              </button>
              <button 
                onClick={handleBulkSave}
                disabled={selectedSugs.length === 0 || bulkSaving}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                {bulkSaving ? 'Saving...' : `Save ${selectedSugs.length} Selected`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}