import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

const subjectsCol     = () => collection(db, 'subjects');
const subMasteriesCol = () => collection(db, 'subMasteries');

export function subscribeSubjects(cb) {
  const q = query(subjectsCol(), orderBy('order', 'asc'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeSubjects', err); cb([]); }
  );
}

export function subscribeSubMasteries(cb) {
  const q = query(subMasteriesCol(), orderBy('order', 'asc'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeSubMasteries', err); cb([]); }
  );
}

async function nextOrder(col) {
  const snap = await getDocs(query(col, orderBy('order', 'desc')));
  const top = snap.docs[0]?.data()?.order;
  return typeof top === 'number' ? top + 1 : 0;
}

export async function addSubject(name) {
  return addDoc(subjectsCol(), {
    name: name.trim(),
    order: await nextOrder(subjectsCol()),
    createdAt: serverTimestamp(),
  });
}

export async function updateSubject(id, name) {
  return updateDoc(doc(db, 'subjects', id), { name: name.trim() });
}

export async function deleteSubject(id) {
  // Cascade: delete all sub-masteries that belong to this subject.
  const snap = await getDocs(subMasteriesCol());
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    if (d.data().subjectId === id) batch.delete(d.ref);
  });
  await batch.commit();
  await deleteDoc(doc(db, 'subjects', id));
}

export async function addSubMastery(subjectId, name) {
  return addDoc(subMasteriesCol(), {
    subjectId,
    name: name.trim(),
    order: await nextOrder(subMasteriesCol()),
    createdAt: serverTimestamp(),
  });
}

export async function updateSubMastery(id, name) {
  return updateDoc(doc(db, 'subMasteries', id), { name: name.trim() });
}

export async function deleteSubMastery(id) {
  return deleteDoc(doc(db, 'subMasteries', id));
}

/**
 * Bulk import. `subjects` shape:
 *   [{ name: 'Pengenalan Nirmana', subMasteries: ['Nirmana dasar', ...] }, ...]
 * - Subjects already in the DB (by lowercased name) are reused, not duplicated.
 * - Sub-masteries already under the matched subject are skipped.
 * Returns { subjectsAdded, subjectsReused, subsAdded, subsSkipped }.
 */
export async function bulkImportLessons(subjects) {
  const existingSubjects = (await getDocs(subjectsCol())).docs
    .map((d) => ({ id: d.id, ...d.data() }));

  const existingSubs = (await getDocs(subMasteriesCol())).docs
    .map((d) => ({ id: d.id, ...d.data() }));

  const subjectByName = new Map();
  existingSubjects.forEach((s) => subjectByName.set(s.name.toLowerCase(), s));

  const subsBySubject = new Map(); // subjectId -> Set of lowercased sub names
  existingSubs.forEach((sm) => {
    if (!subsBySubject.has(sm.subjectId)) subsBySubject.set(sm.subjectId, new Set());
    subsBySubject.get(sm.subjectId).add(sm.name.toLowerCase());
  });

  let nextSubOrderVal = existingSubs.length
    ? Math.max(...existingSubs.map((s) => s.order ?? 0)) + 1
    : 0;
  let nextSubjOrderVal = existingSubjects.length
    ? Math.max(...existingSubjects.map((s) => s.order ?? 0)) + 1
    : 0;

  let subjectsAdded = 0, subjectsReused = 0, subsAdded = 0, subsSkipped = 0;

  for (const incoming of subjects) {
    const key = incoming.name.toLowerCase();
    let subject = subjectByName.get(key);

    if (!subject) {
      const ref = await addDoc(subjectsCol(), {
        name: incoming.name.trim(),
        order: nextSubjOrderVal++,
        createdAt: serverTimestamp(),
      });
      subject = { id: ref.id, name: incoming.name };
      subjectByName.set(key, subject);
      subsBySubject.set(subject.id, new Set());
      subjectsAdded++;
    } else {
      subjectsReused++;
    }

    const existingSet = subsBySubject.get(subject.id) ?? new Set();
    for (const subName of incoming.subMasteries) {
      const subKey = subName.toLowerCase();
      if (existingSet.has(subKey)) { subsSkipped++; continue; }
      await addDoc(subMasteriesCol(), {
        subjectId: subject.id,
        name: subName.trim(),
        order: nextSubOrderVal++,
        createdAt: serverTimestamp(),
      });
      existingSet.add(subKey);
      subsAdded++;
    }
    subsBySubject.set(subject.id, existingSet);
  }

  return { subjectsAdded, subjectsReused, subsAdded, subsSkipped };
}