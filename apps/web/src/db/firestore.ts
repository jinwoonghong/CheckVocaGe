import { getApp } from '../auth/firebase';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
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
  return String(id || '').replace(/[/#?[\]]/g, '_');
}

function prune(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return (value as unknown[]).map((v) => prune(v)).filter((v) => v !== undefined);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pv = prune(v);
      if (pv !== undefined) out[k] = pv;
    }
    return out;
  }
  return value;
}

export interface SnapshotWord { id: string; [k: string]: unknown }
export interface SnapshotReview { id: string; [k: string]: unknown }
export interface LocalSnapshot { wordEntries?: SnapshotWord[]; reviewStates?: SnapshotReview[] }

export async function upsertSnapshotToFirestore(uid: string, snapshot: LocalSnapshot): Promise<void> {
  const words: SnapshotWord[] = (snapshot?.wordEntries ?? []) as SnapshotWord[];
  const reviews: SnapshotReview[] = (snapshot?.reviewStates ?? []) as SnapshotReview[];
  for (const w of words) {
    const safeId = toSafeId(w.id);
    const ref = doc(wordsCol(uid), safeId);
    await setDoc(ref, { ...(prune(w) as Record<string, unknown>), id: safeId, originalId: w.id }, { merge: true });
  }
  for (const r of reviews) {
    const safeId = toSafeId(r.id);
    const ref = doc(reviewsCol(uid), safeId);
    await setDoc(ref, { ...(prune(r) as Record<string, unknown>), id: safeId, originalId: r.id }, { merge: true });
  }
}

export interface CloudWordRow { id: string; word: string; context?: string; includeInQuiz?: boolean; [k: string]: unknown }
export async function fetchUserWords(uid: string, limit = 50): Promise<CloudWordRow[]> {
  const q = query(wordsCol(uid), orderBy('createdAt', 'desc'), qLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as CloudWordRow[];
}

export function subscribeUserWords(
  uid: string,
  limit: number,
  cb: (rows: CloudWordRow[]) => void,
): () => void {
  const q = query(wordsCol(uid), orderBy('createdAt', 'desc'), qLimit(limit));
  const unsub = onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as CloudWordRow[];
    cb(rows);
  });
  return unsub;
}

export interface ReviewState { id: string; [k: string]: unknown }
export async function upsertReviewState(uid: string, state: ReviewState): Promise<void> {
  const safeId = toSafeId(String(state.id));
  const ref = doc(reviewsCol(uid), safeId);
  await setDoc(ref, { ...(prune(state) as Record<string, unknown>), id: safeId, originalId: state.id }, { merge: true });
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
