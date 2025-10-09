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

export async function upsertSnapshotToFirestore(uid: string, snapshot: any): Promise<void> {
  const words: any[] = snapshot?.wordEntries ?? [];
  const reviews: any[] = snapshot?.reviewStates ?? [];
  // Upsert words
  for (const w of words) {
    const ref = doc(wordsCol(uid), w.id);
    await setDoc(ref, w, { merge: true });
  }
  // Upsert review states
  for (const r of reviews) {
    const ref = doc(reviewsCol(uid), r.id);
    await setDoc(ref, r, { merge: true });
  }
}

export async function fetchUserWords(uid: string, limit = 50): Promise<any[]> {
  const q = query(wordsCol(uid), orderBy('createdAt', 'desc'), qLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertReviewState(uid: string, state: any): Promise<void> {
  const ref = doc(reviewsCol(uid), state.id);
  await setDoc(ref, state, { merge: true });
}

