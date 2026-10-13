import {
  collection, doc, onSnapshot, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const responseDoc = (examId, studentId) =>
  doc(db, 'exams', examId, 'responses', studentId);

const stateDoc = (examId) =>
  doc(db, 'exams', examId, 'state', 'current');

export function subscribeResponses(examId, cb) {
  const col = collection(db, 'exams', examId, 'responses');
  return onSnapshot(
    col,
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data(); });
      cb(map);
    },
    (err) => { console.error('subscribeResponses', err); cb({}); }
  );
}

export function subscribeState(examId, cb) {
  return onSnapshot(
    stateDoc(examId),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => { console.error('subscribeState', err); cb(null); }
  );
}

export async function saveState(examId, patch) {
  return setDoc(stateDoc(examId),
    { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function clearState(examId) {
  return setDoc(stateDoc(examId),
    { studentId: null, phase: null, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveResponse(examId, studentId, data) {
  return setDoc(responseDoc(examId, studentId),
    { ...data, updatedAt: serverTimestamp() });
}

/**
 * Weights: mcqWeight + essayWeight = 100.
 * If one section has zero questions, its weight is ignored and the other gets 100.
 * Returns the pieces the summary screen needs.
 */
export function computeScore(exam, answers, essayScores) {
  const mcqCount   = exam.mcqCount   ?? 0;
  const essayCount = exam.essayCount ?? 0;

  let mcqCorrect = 0;
  for (let i = 1; i <= mcqCount; i++) {
    const a = answers[String(i)];
    const k = exam.key?.[String(i)];
    if (a && k && a === k) mcqCorrect++;
  }

  let essaySum = 0;
  for (let i = 1; i <= essayCount; i++) {
    essaySum += Number(essayScores?.[String(i)]) || 0;
  }

  const mcqRatio   = mcqCount   ? mcqCorrect / mcqCount : 0;
  const essayRatio = essayCount ? essaySum / (essayCount * 10) : 0;

  let mcqW   = exam.mcqWeight   ?? 60;
  let essayW = exam.essayWeight ?? 40;
  if (mcqCount === 0)   { mcqW = 0;   essayW = 100; }
  if (essayCount === 0) { essayW = 0; mcqW = 100; }

  const mcqScore   = round2(mcqRatio   * mcqW);
  const essayScore = round2(essayRatio * essayW);
  const totalScore = Math.round(mcqScore + essayScore);

  return {
    mcqCorrect,
    mcqScore,
    essayScore,
    totalScore,
    maxTotal: 100,
    passed: totalScore >= (exam.passingThreshold ?? 75),
  };
}

const round2 = (n) => Math.round(n * 100) / 100;