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
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

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

function toSafeId(id: string): string {
  return String(id || '').replace(/[\/#?\[\]]/g, '_');
}

function prune(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => prune(v)).filter((v) => v !== undefined);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = prune(v);
      if (pv !== undefined) out[k] = pv;
    }
    return out;
  }
  return value;
}

export async function upsertSnapshotToFirestore(uid: string, snapshot: any): Promise<void> {
  const words: any[] = snapshot?.wordEntries ?? [];
  const reviews: any[] = snapshot?.reviewStates ?? [];
  for (const w of words) {
    const safeId = toSafeId(w.id);
    const ref = doc(wordsCol(uid), safeId);
    await setDoc(ref, { ...prune(w), id: safeId, originalId: w.id }, { merge: true });
  }
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
  const safeId = toSafeId(state.id);
  const ref = doc(reviewsCol(uid), safeId);
  await setDoc(ref, { ...prune(state), id: safeId, originalId: state.id }, { merge: true });
}

export async function setWordIncludeInQuiz(uid: string, wordId: string, include: boolean): Promise<void> {
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

export async function deleteWord(uid: string, wordId: string): Promise<void> {
  const db = getFirestore(getApp());
  const wid = toSafeId(wordId);
  await deleteDoc(doc(collection(db, `users/${uid}/words`), wid));
  await deleteDoc(doc(collection(db, `users/${uid}/reviews`), wid));
}

export async function deleteWords(uid: string, wordIds: string[]): Promise<void> {
  if (!wordIds.length) return;
  const db = getFirestore(getApp());
  const batch = writeBatch(db);
  for (const id of wordIds) {
    const wid = toSafeId(id);
    batch.delete(doc(collection(db, `users/${uid}/words`), wid));
    batch.delete(doc(collection(db, `users/${uid}/reviews`), wid));
  }
  await batch.commit();
}

export async function setWordTags(uid: string, wordId: string, tags: string[]): Promise<void> {
  const db = getFirestore(getApp());
  const ref = doc(collection(db, `users/${uid}/words`), toSafeId(wordId));
  await setDoc(ref, { tags }, { merge: true });
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  filter: 'all' | 'included' | 'excluded';
  mode: QuizMode;
  createdAt: number;
}

export async function getSavedFilters(uid: string): Promise<SavedFilter[]> {
  const db = getFirestore(getApp());
  const snap = await getDocs(query(collection(db, `users/${uid}/settings`)));
  const d = snap.docs.find((x) => x.id === 'filters');
  const arr = (d?.data()?.items as SavedFilter[] | undefined) ?? [];
  return Array.isArray(arr) ? arr : [];
}

export async function setSavedFilters(uid: string, items: SavedFilter[]): Promise<void> {
  const db = getFirestore(getApp());
  const ref = doc(collection(db, `users/${uid}/settings`), 'filters');
  await setDoc(ref, { items }, { merge: true });
}
