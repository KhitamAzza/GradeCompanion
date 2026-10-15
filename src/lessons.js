import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  writeBatch, getDocs, where,
} from 'firebase/firestore';
import { db } from './firebase';

const subjectsCol     = () => collection(db, 'subjects');
const competenciesCol = () => collection(db, 'competencies');
const indicatorsCol   = () => collection(db, 'indicators');

/* ---------- live subscriptions ---------- */

export function subscribeSubjects(cb) {
  const q = query(subjectsCol(), orderBy('order', 'asc'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeSubjects', err); cb([]); }
  );
}

export function subscribeCompetencies(cb) {
  const q = query(competenciesCol(), orderBy('order', 'asc'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeCompetencies', err); cb([]); }
  );
}

export function subscribeIndicators(cb) {
  const q = query(indicatorsCol(), orderBy('order', 'asc'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('subscribeIndicators', err); cb([]); }
  );
}

/* ---------- order helper ---------- */

async function nextOrder(col) {
  const snap = await getDocs(query(col, orderBy('order', 'desc')));
  const top = snap.docs[0]?.data()?.order;
  return typeof top === 'number' ? top + 1 : 0;
}

/* ---------- subjects ---------- */

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
  // Cascade: competencies -> indicators.
  const comps = await getDocs(query(competenciesCol(), where('subjectId', '==', id)));
  const batch = writeBatch(db);
  const compIds = comps.docs.map((d) => d.id);
  comps.docs.forEach((d) => batch.delete(d.ref));

  // For each competency, we need its indicators — but bulk-deleting them
  // one-by-one through the batch would need multiple reads. Do a second pass.
  for (const cid of compIds) {
    const inds = await getDocs(query(indicatorsCol(), where('competencyId', '==', cid)));
    inds.docs.forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
  await deleteDoc(doc(db, 'subjects', id));
}

/* ---------- competencies ---------- */

export async function addCompetency(subjectId, name) {
  return addDoc(competenciesCol(), {
    subjectId,
    name: name.trim(),
    order: await nextOrder(competenciesCol()),
    createdAt: serverTimestamp(),
  });
}

export async function updateCompetency(id, name) {
  return updateDoc(doc(db, 'competencies', id), { name: name.trim() });
}

export async function deleteCompetency(id) {
  const inds = await getDocs(query(indicatorsCol(), where('competencyId', '==', id)));
  const batch = writeBatch(db);
  inds.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await deleteDoc(doc(db, 'competencies', id));
}

/* ---------- indicators ---------- */

export async function addIndicator(competencyId, name) {
  return addDoc(indicatorsCol(), {
    competencyId,
    name: name.trim(),
    order: await nextOrder(indicatorsCol()),
    createdAt: serverTimestamp(),
  });
}

export async function updateIndicator(id, name) {
  return updateDoc(doc(db, 'indicators', id), { name: name.trim() });
}

export async function deleteIndicator(id) {
  return deleteDoc(doc(db, 'indicators', id));
}

/* ---------- bulk import ---------- */

/**
 * `rows` = [{ subjectName, competencyName, indicatorName }, ...]
 * Blank/null cells should have been filled by the parser before this runs.
 *
 * Behavior:
 *   - Subjects matched by lowercased name; existing ones reused.
 *   - Competencies matched by (subjectId, lowercased name); existing reused.
 *   - Indicators matched by (competencyId, lowercased name); existing skipped.
 * Returns { subjectsAdded, subjectsReused, compsAdded, compsReused,
 *           indsAdded, indsSkipped }.
 */
export async function bulkImportLessons(rows) {
  const existingSubjects = (await getDocs(subjectsCol())).docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingComps    = (await getDocs(competenciesCol())).docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingInds     = (await getDocs(indicatorsCol())).docs.map((d) => ({ id: d.id, ...d.data() }));

  const subjectByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]));
  const compByKey     = new Map(existingComps.map((c) => [`${c.subjectId}__${c.name.toLowerCase()}`, c]));

  const indSet = new Set(existingInds.map((i) => `${i.competencyId}__${i.name.toLowerCase()}`));

  let nextSubjOrder = existingSubjects.length
    ? Math.max(...existingSubjects.map((s) => s.order ?? 0)) + 1 : 0;
  let nextCompOrder = existingComps.length
    ? Math.max(...existingComps.map((c) => c.order ?? 0)) + 1 : 0;
  let nextIndOrder = existingInds.length
    ? Math.max(...existingInds.map((i) => i.order ?? 0)) + 1 : 0;

  let subjectsAdded = 0, subjectsReused = 0;
  let compsAdded = 0, compsReused = 0;
  let indsAdded = 0, indsSkipped = 0;

  for (const row of rows) {
    const sKey = row.subjectName.toLowerCase();
    let subject = subjectByName.get(sKey);
    if (!subject) {
      const ref = await addDoc(subjectsCol(), {
        name: row.subjectName.trim(),
        order: nextSubjOrder++,
        createdAt: serverTimestamp(),
      });
      subject = { id: ref.id, name: row.subjectName };
      subjectByName.set(sKey, subject);
      subjectsAdded++;
    } else {
      subjectsReused++;
    }

    if (!row.competencyName) continue;

    const cKey = `${subject.id}__${row.competencyName.toLowerCase()}`;
    let comp = compByKey.get(cKey);
    if (!comp) {
      const ref = await addDoc(competenciesCol(), {
        subjectId: subject.id,
        name: row.competencyName.trim(),
        order: nextCompOrder++,
        createdAt: serverTimestamp(),
      });
      comp = { id: ref.id, name: row.competencyName };
      compByKey.set(cKey, comp);
      compsAdded++;
    } else {
      compsReused++;
    }

    if (!row.indicatorName) continue;

    const iKey = `${comp.id}__${row.indicatorName.toLowerCase()}`;
    if (indSet.has(iKey)) { indsSkipped++; continue; }

    await addDoc(indicatorsCol(), {
      competencyId: comp.id,
      name: row.indicatorName.trim(),
      order: nextIndOrder++,
      createdAt: serverTimestamp(),
    });
    indSet.add(iKey);
    indsAdded++;
  }

  return { subjectsAdded, subjectsReused, compsAdded, compsReused, indsAdded, indsSkipped };
}