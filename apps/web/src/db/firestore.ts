import { getApp } from '../auth/firebase';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit as qLimit,
} from 'firebase/firestore'

export interface UserRef {
  uid: string;
}

function wordsCol(uid: string) {
  const db = getFirestore(getApp());
  return collection(db, `users/${uid}/words`);
}

function reviewsCol(uid: string) {
  const db = getFirestore(getApp());
  return collection(db, `users/${uid}/reviews`);
}

export async function upsertSnapshotToFirestore(uid: string, snapshot: any): Promise<void> {
  const words: any[] = snapshot?.wordEntries ?? [];
  const reviews: any[] = snapshot?.reviewStates ?? [];
  // Firestore does not allow undefined values. Prune them recursively.
  const prune = (v: any): any => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (Array.isArray(v)) {
      const arr = v.map((it) => prune(it)).filter((it) => it !== undefined);
      return arr;
    }
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) {
        const pv = prune(val);
        if (pv !== undefined) out[k] = pv;
      }
      return out;
    }
    return v;
  };
  const toSafeId = (id: string) => String(id || '').replace(/[\/#?\[\]]/g, '_');
  // Upsert words
  for (const w of words) {
    const safeId = toSafeId(w.id);
    const ref = doc(wordsCol(uid), safeId);
    await setDoc(ref, { ...prune(w), id: safeId, originalId: w.id }, { merge: true });
  }
  // Upsert review states
  for (const r of reviews) {
    const safeId = toSafeId(r.id);
    const ref = doc(reviewsCol(uid), safeId);
    await setDoc(ref, { ...prune(r), id: safeId, originalId: r.id }, { merge: true });
  }
}

export async function fetchUserWords(uid: string, limit = 50): Promise<any[]> {
  const q = query(wordsCol(uid), orderBy('createdAt', 'desc'), qLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertReviewState(uid: string, state: any): Promise<void> {
  const toSafeId = (id: string) => String(id || '').replace(/[\/#?\[\]]/g, '_');
  const prune = (v: any): any => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (Array.isArray(v)) return v.map((it) => prune(it)).filter((it) => it !== undefined);
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) {
        const pv = prune(val);
        if (pv !== undefined) out[k] = pv;
      }
      return out;
    }
    return v;
  };
  const safeId = toSafeId(state.id);
  const ref = doc(reviewsCol(uid), safeId);
  await setDoc(ref, { ...prune(state), id: safeId, originalId: state.id }, { merge: true });
}





export async function setWordIncludeInQuiz(uid: string, wordId: string, include: boolean): Promise<void> {
  const toSafeId = (id: string) => String(id || '').replace(/[\/#?\[\]]/g, '_');
  const ref = doc(wordsCol(uid), toSafeId(wordId));
  await setDoc(ref, { includeInQuiz: include }, { merge: true });
}

export type QuizMode = 'all' | 'onlyIncluded';
export async function setQuizPreference(uid: string, mode: QuizMode): Promise<void> {
  const db = getFirestore(getApp());
  const ref = doc(collection(db, `users/${uid}/settings`), 'quiz');
  await setDoc(ref, { mode }, { merge: true });
}
export async function getQuizPreference(uid: string): Promise<QuizMode | undefined> {
  const db = getFirestore(getApp());
  const snap = await getDocs(query(collection(db, `users/${uid}/settings`)));
  const d = snap.docs.find((x) => x.id === 'quiz');
  return (d?.data()?.mode as QuizMode | undefined) || undefined;
}


// Delete a word (and its review state) in cloud
export async function deleteWord(uid: string, wordId: string): Promise<void> {
  const toSafeId = (id: string) => String(id || '').replace(/[\/#?\[\]]/g, '_');
  const db = getFirestore(getApp());
  const wid = toSafeId(wordId);
  await deleteDoc(doc(collection(db, `users/${uid}/words`), wid));
  await deleteDoc(doc(collection(db, `users/${uid}/reviews`), wid));
}


