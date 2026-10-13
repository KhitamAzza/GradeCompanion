import {
  collection, doc, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const col = () => collection(db, 'exams');

export function subscribeExams(cb) {
  const q = query(col(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeExams', err); cb([]); }
  );
}

export async function createExam(data) {
  return addDoc(col(), {
    ...data,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateExam(id, patch) {
  return updateDoc(doc(db, 'exams', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExam(id) {
  // Cascade: wipe responses and resume-state first, then the exam itself.
  const responses = await getDocs(collection(db, 'exams', id, 'responses'));
  const batch = writeBatch(db);
  responses.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await deleteDoc(doc(db, 'exams', id, 'state', 'current')).catch(() => {});
  await deleteDoc(doc(db, 'exams', id));
}