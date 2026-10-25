import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const papersCol = () => collection(db, 'examPapers');

export function subscribePapers(cb) {
  const q = query(papersCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(q, 
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => { console.error(err); cb([]); }
  );
}

export async function createPaper(data) {
  return addDoc(papersCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePaper(id, data) {
  return updateDoc(doc(db, 'examPapers', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePaper(id) {
  return deleteDoc(doc(db, 'examPapers', id));
}