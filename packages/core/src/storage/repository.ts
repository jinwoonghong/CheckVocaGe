import { getDatabase } from './db';
import type {
  WordEntry,
  ReviewState,
  PendingRequest,
  QuizSession,
  SettingsRecord,
} from '../models';
import type { SelectionPayload } from '../types/selection';
import { generateId } from '../utils/id';
import { toNormalizedWord } from '../utils/text';

let __lastNow = 0;
function now(): number {
  const t = Date.now();
  if (t <= __lastNow) {
    __lastNow += 1;
    return __lastNow;
  }
  __lastNow = t;
  return __lastNow;
}

function mergeWord(existing: WordEntry, payload: SelectionPayload): WordEntry {
  const normalizedWord = toNormalizedWord(payload.word);
  return {
    ...existing,
    word: payload.word,
    normalizedWord,
    context: payload.context,
    url: payload.url,
    selectionRange: payload.selectionRange,
    updatedAt: now(),
    viewCount: existing.viewCount ?? 0,
    sourceTitle: payload.clientMeta.title,
    language: payload.clientMeta.language,
    tags: payload.tags ?? existing.tags,
    isFavorite: payload.isFavorite ?? existing.isFavorite,
    note: payload.note ?? existing.note,
    manuallyEdited: existing.manuallyEdited,
    definitions: payload.definitions ?? existing.definitions,
    phonetic: payload.phonetic ?? existing.phonetic,
    audioUrl: payload.audioUrl ?? existing.audioUrl,
  };
}

export async function upsertWordWithContext(payload: SelectionPayload): Promise<WordEntry> {
  const db = getDatabase();
  const normalizedWord = toNormalizedWord(payload.word);
  const id = `${normalizedWord}::${payload.url}`;
  const existing = await db.wordEntries.get(id);
  const base: WordEntry = existing
    ? mergeWord(existing, payload)
    : {
        id,
        word: payload.word,
        normalizedWord,
        context: payload.context,
        contextSnapshot: null,
        url: payload.url,
        selectionRange: payload.selectionRange,
        createdAt: now(),
        updatedAt: now(),
        viewCount: 0,
        sourceTitle: payload.clientMeta.title,
        language: payload.clientMeta.language,
        tags: payload.tags ?? [],
        isFavorite: payload.isFavorite ?? false,
        manuallyEdited: false,
        note: payload.note,
        definitions: payload.definitions ?? [],
        phonetic: payload.phonetic,
        audioUrl: payload.audioUrl,
      };
  await db.wordEntries.put(base);
  return base;
}

export async function listWords(limit = 100, offset = 0): Promise<WordEntry[]> {
  const db = getDatabase();
  return db.wordEntries.orderBy('createdAt').reverse().offset(offset).limit(limit).toArray();
}

export async function markKnown(wordId: string): Promise<void> {
  const db = getDatabase();
  await db.wordEntries.update(wordId, { isFavorite: false });
  await db.reviewStates.delete(wordId);
}

export async function getDueReviews(reference: number = now()): Promise<WordEntry[]> {
  const db = getDatabase();
  const states = await db.reviewStates.where('nextReviewAt').belowOrEqual(reference).toArray();
  const wordIds = states.map((state) => state.wordId);
  if (!wordIds.length) return [];
  return db.wordEntries.bulkGet(wordIds).then((entries) => entries.filter(Boolean) as WordEntry[]);
}

export async function saveReviewState(state: ReviewState): Promise<void> {
  const db = getDatabase();
  await db.reviewStates.put(state);
}

export async function enqueuePendingRequest(payload: SelectionPayload): Promise<PendingRequest> {
  const db = getDatabase();
  const record: PendingRequest = {
    id: generateId('pending'),
    payload,
    status: 'pending',
    attemptCount: 0,
    createdAt: now(),
  };
  await db.pendingRequests.add(record);
  return record;
}

export async function popNextPendingRequest(): Promise<PendingRequest | undefined> {
  const db = getDatabase();
  const next = await db.pendingRequests.orderBy('createdAt').first();
  if (!next) return undefined;
  await db.pendingRequests.delete(next.id);
  return next;
}

export async function recordPendingFailure(request: PendingRequest): Promise<void> {
  const db = getDatabase();
  await db.pendingRequests.put({
    ...request,
    lastAttemptedAt: now(),
  });
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  const db = getDatabase();
  await db.quizSessions.put(session);
}

export async function recordWordView(wordId: string): Promise<void> {
  const db = getDatabase();
  const rec = await db.wordEntries.get(wordId);
  const t = now();
  if (!rec) return;
  const vc = typeof rec.viewCount === 'number' ? rec.viewCount : 0;
  await db.wordEntries.update(wordId, {
    viewCount: vc + 1,
    lastViewedAt: t,
    updatedAt: t,
  });
}

export async function exportSnapshot(): Promise<Record<string, unknown>> {
  const db = getDatabase();
  const [wordEntries, reviewStates, pendingRequests, quizSessions, settings] = await Promise.all([
    db.wordEntries.toArray(),
    db.reviewStates.toArray(),
    db.pendingRequests.toArray(),
    db.quizSessions.toArray(),
    db.settings.toArray(),
  ]);
  return { wordEntries, reviewStates, pendingRequests, quizSessions, settings };
}

export async function importSnapshot(data: Record<string, unknown>): Promise<void> {
  const db = getDatabase();
  await db.transaction('rw', [db.wordEntries, db.reviewStates, db.pendingRequests, db.quizSessions, db.settings], async () => {
    await Promise.all([
      db.wordEntries.clear(),
      db.reviewStates.clear(),
      db.pendingRequests.clear(),
      db.quizSessions.clear(),
      db.settings.clear(),
    ]);
    const { wordEntries = [], reviewStates = [], pendingRequests = [], quizSessions = [], settings = [] } = data as {
      wordEntries: WordEntry[];
      reviewStates: ReviewState[];
      pendingRequests: PendingRequest[];
      quizSessions: QuizSession[];
      settings: SettingsRecord[];
    };
    await db.wordEntries.bulkAdd(wordEntries);
    await db.reviewStates.bulkAdd(reviewStates);
    await db.pendingRequests.bulkAdd(pendingRequests);
    await db.quizSessions.bulkAdd(quizSessions);
    await db.settings.bulkAdd(settings);
  });
}

