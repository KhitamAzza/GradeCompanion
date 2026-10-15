import {
  collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc,
  deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const scoreCol  = () => collection(db, 'dailyScores');
const columnDoc = (cls) => doc(db, 'classColumns', cls);

export const scoreId = (studentId, indicatorId) => `${studentId}__${indicatorId}`;

export function subscribeScores(cls, cb) {
  const q = query(scoreCol(), where('class', '==', cls));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeScores', err); cb([]); }
  );
}

export function subscribeClassColumns(cls, cb) {
  return onSnapshot(columnDoc(cls),
    (snap) => cb(snap.exists() ? (snap.data().indicatorIds ?? []) : []),
    (err) => { console.error('subscribeClassColumns', err); cb([]); }
  );
}

export function subscribeAllScores(cb) {
  return onSnapshot(
    collection(db, 'dailyScores'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeAllScores', err); cb([]); }
  );
}

export function subscribeAllClassColumns(cb) {
  return onSnapshot(
    collection(db, 'classColumns'),
    (snap) => {
      const m = {};
      snap.docs.forEach((d) => { m[d.id] = d.data().indicatorIds ?? []; });
      cb(m);
    },
    (err) => { console.error('subscribeAllClassColumns', err); cb({}); }
  );
}

export async function setScore(studentId, cls, indicatorId, score) {
  return setDoc(doc(db, 'dailyScores', scoreId(studentId, indicatorId)), {
    studentId,
    class: cls,
    indicatorId,
    score: Number(score),
    updatedAt: serverTimestamp(),
  });
}

export async function removeScore(studentId, indicatorId) {
  return deleteDoc(doc(db, 'dailyScores', scoreId(studentId, indicatorId)));
}

export async function addColumn(cls, indicatorId) {
  const ref = columnDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().indicatorIds ?? []) : [];
  if (existing.includes(indicatorId)) return;
  await setDoc(ref, { indicatorIds: [...existing, indicatorId] }, { merge: true });
}

export async function removeColumn(cls, indicatorId) {
  const ref = columnDoc(cls);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data().indicatorIds ?? []) : [];
  await setDoc(ref,
    { indicatorIds: existing.filter((id) => id !== indicatorId) },
    { merge: true });

  const q = query(
    scoreCol(),
    where('class', '==', cls),
    where('indicatorId', '==', indicatorId)
  );
  const hits = await getDocs(q);
  const batch = writeBatch(db);
  hits.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}