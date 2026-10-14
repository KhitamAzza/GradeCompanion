import {
  collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc,
  deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const scoreCol  = () => collection(db, 'dailyScores');
const columnDoc = (cls) => doc(db, 'classColumns', cls);

export const scoreId = (studentId, subMasteryId) => `${studentId}__${subMasteryId}`;

export function subscribeScores(cls, cb) {
  const q = query(scoreCol(), where('class', '==', cls));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeScores', err); cb([]); }
  );
}

export function subscribeClassColumns(cls, cb) {
  return onSnapshot(columnDoc(cls),
    (snap) => cb(snap.exists() ? (snap.data().subMasteryIds ?? []) : []),
    (err) => { console.error('subscribeClassColumns', err); cb([]); }
  );
}

export async function setScore(studentId, cls, subMasteryId, score) {
  return setDoc(doc(db, 'dailyScores', scoreId(studentId, subMasteryId)), {
    studentId,
    class: cls,
    subMasteryId,
    score: Number(score),
    updatedAt: serverTimestamp(),
  });
}

export async function removeScore(studentId, subMasteryId) {
  return deleteDoc(doc(db, 'dailyScores', scoreId(studentId, subMasteryId)));
}

export async function addColumn(cls, subMasteryId) {
  const ref = columnDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().subMasteryIds ?? []) : [];
  if (existing.includes(subMasteryId)) return;
  await setDoc(ref, { subMasteryIds: [...existing, subMasteryId] }, { merge: true });
}

export async function removeColumn(cls, subMasteryId) {
  const ref = columnDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().subMasteryIds ?? []) : [];
  await setDoc(ref,
    { subMasteryIds: existing.filter((id) => id !== subMasteryId) },
    { merge: true });

  const q = query(
    scoreCol(),
    where('class', '==', cls),
    where('subMasteryId', '==', subMasteryId)
  );
  const hits = await getDocs(q);
  const batch = writeBatch(db);
  hits.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}