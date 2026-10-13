import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  writeBatch, getDocs,
} from 'firebase/firestore';

import { db } from './firebase';

const col = () => collection(db, 'students');

export function subscribeStudents(cb) {
  // orderBy('order') puts legacy docs (missing field) first, then ordered ones.
  const q = query(col(), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeStudents', err); cb([]); }
  );
}


export async function addStudent(name, cls) {
  return addDoc(col(), {
    name: name.trim(),
    class: cls.trim(),
    order: await nextOrder(),
    createdAt: serverTimestamp(),
  });
}


export async function updateStudent(id, patch) {
  return updateDoc(doc(db, 'students', id), patch);
}

export async function deleteStudent(id) {
  return deleteDoc(doc(db, 'students', id));
}
async function nextOrder() {
  // Highest existing order + 1. Cheap because the roster is small.
  const snap = await getDocs(query(col(), orderBy('order', 'desc')));
  const top = snap.docs[0]?.data()?.order;
  return typeof top === 'number' ? top + 1 : 0;
}
// import { writeBatch, doc } from 'firebase/firestore';
// (these two are new — merge into the existing firebase/firestore import at the top if you prefer,
//  but adding a separate import line at the bottom also works)

export async function bulkAddStudents(list) {
  const start = await nextOrder();
  const CHUNK = 400;
  let added = 0;
  for (let i = 0; i < list.length; i += CHUNK) {
    const batch = writeBatch(db);
    const slice = list.slice(i, i + CHUNK);
    slice.forEach((s, j) => {
      const ref = doc(col());
      batch.set(ref, {
        name: s.name.trim(),
        class: s.class.trim(),
        order: start + i + j,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
    added += slice.length;
  }
  return added;
}