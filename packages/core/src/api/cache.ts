import type { SelectionPayload } from '../types/selection';
import type { WordEntry, PendingRequest } from '../models';
import {
  enqueuePendingRequest,
  getDueReviews,
  listWords,
  popNextPendingRequest,
  recordPendingFailure,
  saveReviewState,
  saveQuizSession,
  upsertWordWithContext,
  recordWordView as recordWordViewRepository,
  exportSnapshot as exportRepositorySnapshot,
  importSnapshot as importRepositorySnapshot,
} from '../storage/repository';
import { getDatabase } from '../storage/db';
import type { ReviewState, ReviewHistoryItem } from '../models';
import { publishCacheEvent } from '../utils/broadcast';

export async function registerSelection(payload: SelectionPayload): Promise<WordEntry> {
  const word = await upsertWordWithContext(payload);
  publishCacheEvent({ type: 'word:updated', id: word.id });
  return word;
}

export async function queueSelectionForRetry(payload: SelectionPayload): Promise<PendingRequest> {
  const pending = await enqueuePendingRequest(payload);
  publishCacheEvent({ type: 'pending:queued' });
  return pending;
}

export async function takeNextPendingRequest(): Promise<PendingRequest | undefined> {
  return popNextPendingRequest();
}

export async function markPendingFailure(request: PendingRequest): Promise<void> {
  await recordPendingFailure(request);
}

export async function fetchWordList(limit?: number, offset?: number): Promise<WordEntry[]> {
  return listWords(limit, offset);
}

export async function fetchDueReviews(reference?: number): Promise<WordEntry[]> {
  return getDueReviews(reference);
}

export const saveReviewStateRecord = saveReviewState;
export const saveQuizSessionRecord = saveQuizSession;
export const exportSnapshot = exportRepositorySnapshot;
export const importSnapshot = importRepositorySnapshot;
export const recordWordView = recordWordViewRepository;

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

function now(): number {
  return Date.now();
}

function days(n: number): number {
  return Math.round(n * 24 * 60 * 60 * 1000);
}

function applySm2(state: ReviewState, grade: ReviewGrade): ReviewState {
  let { easeFactor, repetitions, interval } = state;
  if (grade < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const reviewedAt = now();
  return {
    ...state,
    easeFactor,
    repetitions,
    interval,
    nextReviewAt: reviewedAt + days(interval),
    history: [...state.history, { reviewedAt, grade } as ReviewHistoryItem],
  };
}

export async function applySm2Review(wordId: string, grade: ReviewGrade): Promise<ReviewState> {
  const db = getDatabase();
  // Load or create initial state
  let state = (await db.reviewStates.get(wordId)) as ReviewState | undefined;
  if (!state) {
    state = {
      id: wordId,
      wordId,
      nextReviewAt: now(),
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      history: [],
    };
  }
  const updated = applySm2(state, grade as ReviewGrade);
  await saveReviewState(updated);
  return updated;
}

export async function seedDummyData(count = 5): Promise<void> {
  const samples = ['synthesis', 'ubiquitous', 'ephemeral', 'resilience', 'serendipity'];
  for (let i = 0; i < count; i += 1) {
    const word = samples[i % samples.length];
    await registerSelection({
      word,
      context: `${word} sample sentence ${i + 1}.`,
      url: 'https://example.com/article',
      selectionRange: {
        startContainerPath: 'body[0]>p[0]>#text[0]',
        startOffset: 0,
        endContainerPath: 'body[0]>p[0]>#text[0]',
        endOffset: word.length,
      },
      timestamp: Date.now(),
      clientMeta: {
        title: 'Seed data',
        language: 'en',
      },
    });
  }
}

export async function logCacheSummary(logger: (message: string, data?: unknown) => void = console.info): Promise<void> {
  const db = getDatabase();
  const [wordCount, pendingCount, reviewCount] = await Promise.all([
    db.wordEntries.count(),
    db.pendingRequests.count(),
    db.reviewStates.count(),
  ]);
  logger('WebVoca cache summary', { wordCount, pendingCount, reviewCount });
}
