import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const qCol = () => collection(db, 'questions');

// 1. Upload Image to Cloudinary
export async function uploadQuestionImage(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary env vars in .env.local");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Upload failed');
  }

  const data = await res.json();
  return data.secure_url;
}

// 2. Save Question to Firestore
export async function saveQuestion(data) {
  return addDoc(qCol(), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// 3. Update Question
export async function updateQuestion(id, data) {
  const ref = doc(db, 'questions', id);
  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// 4. Delete Question(s)
export async function deleteQuestion(id) {
  return deleteDoc(doc(db, 'questions', id));
}

export async function bulkDeleteQuestions(ids) {
  const batch = writeBatch(db);
  ids.forEach(id => batch.delete(doc(db, 'questions', id)));
  await batch.commit();
}

// 5. Bulk Save (Import XLSX)
export async function bulkSaveQuestions(questions) {
  const CHUNK = 400;
  let added = 0;

  for (let i = 0; i < questions.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = questions.slice(i, i + CHUNK);
    
    slice.forEach(q => {
      const newRef = doc(collection(db, 'questions'));
      batch.set(newRef, {
        ...q,
        createdAt: serverTimestamp(),
      });
    });
    
    await batch.commit();
    added += slice.length;
  }
  return added;
}

// --- AI GENERATION LOGIC ---

// Shared Prompt for both AIs (Now supports MCQ and Essay)
function buildPrompt(subjectName, compName, indName, existingQuestions, type) {
  const context = existingQuestions.length > 0 
    ? `WARNING: The following questions ALREADY EXIST in the database. You MUST generate completely different questions that cover a different angle or sub-topic of this indicator. DO NOT duplicate or closely paraphrase these existing questions:\n${existingQuestions.map(q => `- ${q.text}`).join('\n')}`
    : '';

  let instructions = "";
  let jsonStructure = "";

  if (type === 'mcq') {
    instructions = "Generate exactly 7 different multiple-choice questions (MCQ) make sure its always in Indonesian.";
    jsonStructure = `{
      "questions": [
        {
          "text": "The question string",
          "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
          "answer": "A" 
        }
      ]
    }`;
  } else {
    instructions = "Generate exactly 7 different essay/short-answer questions in Indonesian.";
    jsonStructure = `{
      "questions": [
        {
          "text": "The question string"
        }
      ]
    }`;
  }

  return `
    You are an expert high school teacher creating exam questions for a ${subjectName} class.
    Context:
    - Subject: ${subjectName}
    - Competency: ${compName}
    - Indicator: ${indName}
    ${context}

    ${instructions} 
    Format the response STRICTLY as a JSON object containing a "questions" array. Do not include markdown formatting like \`\`\`json or any conversational text. Just the raw JSON object.
    
    The structure must be exactly:
    ${jsonStructure}
  `;
}

// Primary: Gemini
async function generateWithGemini(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); 

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Gemini API Failed");
    }

    const data = await res.json();
    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsed = JSON.parse(rawText);
    return parsed.questions || parsed; 
    
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Gemini request timed out (took longer than 10 seconds)");
    }
    throw err; 
  }
}

// Fallback: Groq
async function generateWithGroq(prompt) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing Groq API Key");

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ 
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "You are a helpful assistant that only outputs valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Groq API Failed");
  }

  const data = await res.json();
  let rawText = data.choices[0].message.content;
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  
  const parsed = JSON.parse(rawText);
  return parsed.questions || parsed;
}

// The Fail-safe Wrapper
export async function generateAIQuestions(subjectName, compName, indName, existingQuestions, type = 'mcq') {
  const prompt = buildPrompt(subjectName, compName, indName, existingQuestions, type);

  try {
    console.log(`Attempting AI generation (${type}) with Gemini...`);
    return await generateWithGemini(prompt);
  } catch (geminiError) {
    console.warn("Gemini failed, switching to Groq fallback. Reason:", geminiError.message);
    
    try {
      console.log(`Attempting AI generation (${type}) with Groq...`);
      return await generateWithGroq(prompt);
    } catch (groqError) {
      console.error("Both Gemini and Groq failed.");
      throw new Error(`AI Generation failed. Gemini: ${geminiError.message}. Groq: ${groqError.message}`);
    }
  }
}