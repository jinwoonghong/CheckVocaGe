import { describe, beforeEach, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getDatabase } from '../storage/db';
import {
  registerSelection,
  queueSelectionForRetry,
  takeNextPendingRequest,
  fetchWordList,
  fetchDueReviews,
  saveReviewStateRecord,
  exportSnapshot,
  importSnapshot,
} from './cache';
import type { SelectionPayload } from '../types/selection';
import type { ReviewState } from '../models';

function createPayload(word: string): SelectionPayload {
  return {
    word,
    context: `${word} in context`,
    url: 'https://example.com/article',
    selectionRange: {
      startContainerPath: 'body[0]>p[0]>#text[0]',
      startOffset: 0,
      endContainerPath: 'body[0]>p[0]>#text[0]',
      endOffset: word.length,
    },
    timestamp: Date.now(),
    clientMeta: {
      title: 'Example',
      language: 'en',
    },
  };
}

async function resetDatabase(): Promise<void> {
  const db = getDatabase();
  await Promise.all([
    db.wordEntries.clear(),
    db.reviewStates.clear(),
    db.pendingRequests.clear(),
    db.quizSessions.clear(),
    db.settings.clear(),
  ]);
}

describe('cache repository integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('registers and lists word entries', async () => {
    const payload = createPayload('resilience');
    const entry = await registerSelection(payload);
    expect(entry.word).toBe('resilience');

    const words = await fetchWordList();
    expect(words).toHaveLength(1);
    expect(words[0].id).toBe(entry.id);
  });

  it('queues pending requests and pops them in FIFO order', async () => {
    const first = await queueSelectionForRetry(createPayload('alpha'));
    await queueSelectionForRetry(createPayload('beta'));

    const popped = await takeNextPendingRequest();
    expect(popped?.id).toBe(first.id);
  });

  it('saves review state and fetches due reviews', async () => {
    const payload = createPayload('serendipity');
    const entry = await registerSelection(payload);

    const review: ReviewState = {
      id: entry.id,
      wordId: entry.id,
      nextReviewAt: Date.now() - 1000,
      interval: 1,
      easeFactor: 2.5,
      repetitions: 1,
      history: [],
    };
    await saveReviewStateRecord(review);

    const due = await fetchDueReviews();
    expect(due.map((item) => item.id)).toContain(entry.id);
  });

  it('exports and imports snapshot', async () => {
    await registerSelection(createPayload('ephemeral'));
    const snapshot = await exportSnapshot();

    await resetDatabase();
    await importSnapshot(snapshot);

    const words = await fetchWordList();
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe('ephemeral');
  });
});
