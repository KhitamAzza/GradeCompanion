import {
  collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc,
  deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const scoreCol = () => collection(db, 'dailyScores');
const dateDoc  = (cls) => doc(db, 'classDates', cls);

export const scoreId = (studentId, date) => `${studentId}__${date}`;

export function subscribeScores(cls, cb) {
  const q = query(scoreCol(), where('class', '==', cls));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeScores', err); cb([]); }
  );
}

export function subscribeClassDates(cls, cb) {
  return onSnapshot(
    dateDoc(cls),
    (snap) => cb(snap.exists() ? (snap.data().dates ?? []) : []),
    (err) => { console.error('subscribeClassDates', err); cb([]); }
  );
}

export async function setScore(studentId, cls, date, score) {
  return setDoc(doc(db, 'dailyScores', scoreId(studentId, date)), {
    studentId, class: cls, date, score: Number(score),
    updatedAt: serverTimestamp(),
  });
}

export async function removeScore(studentId, date) {
  return deleteDoc(doc(db, 'dailyScores', scoreId(studentId, date)));
}

export async function addDate(cls, date) {
  const ref  = dateDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().dates ?? []) : [];
  if (existing.includes(date)) return;
  await setDoc(ref, { dates: [...existing, date].sort() }, { merge: true });
}

export async function removeDate(cls, date) {
  // Remove the date from the class's list
  const ref  = dateDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().dates ?? []) : [];
  await setDoc(ref, { dates: existing.filter((d) => d !== date) }, { merge: true });

  // Delete every score doc that belongs to this class + date
  const q = query(scoreCol(), where('class', '==', cls), where('date', '==', date));
  const hits = await getDocs(q);
  const batch = writeBatch(db);
  hits.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}