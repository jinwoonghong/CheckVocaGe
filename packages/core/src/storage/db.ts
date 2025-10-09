import Dexie, { type EntityTable } from 'dexie';
import type {
  WordEntry,
  ReviewState,
  PendingRequest,
  QuizSession,
  SettingsRecord,
} from '../models';
import {
  DB_NAME,
  DB_VERSION,
  STORE_PENDING_REQUESTS,
  STORE_QUIZ_SESSIONS,
  STORE_REVIEW_STATES,
  STORE_SETTINGS,
  STORE_WORD_ENTRIES,
} from './schema';

export class CheckVocaDatabase extends Dexie {
  wordEntries!: EntityTable<WordEntry, 'id'>;
  reviewStates!: EntityTable<ReviewState, 'id'>;
  pendingRequests!: EntityTable<PendingRequest, 'id'>;
  quizSessions!: EntityTable<QuizSession, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      [STORE_WORD_ENTRIES]: '&id, normalizedWord, url, createdAt',
      [STORE_REVIEW_STATES]: '&id, wordId, nextReviewAt',
      [STORE_PENDING_REQUESTS]: '&id, status, createdAt',
      [STORE_QUIZ_SESSIONS]: '&id, startedAt',
      [STORE_SETTINGS]: '&id, key',
    });

    this.wordEntries = this.table(STORE_WORD_ENTRIES);
    this.reviewStates = this.table(STORE_REVIEW_STATES);
    this.pendingRequests = this.table(STORE_PENDING_REQUESTS);
    this.quizSessions = this.table(STORE_QUIZ_SESSIONS);
    this.settings = this.table(STORE_SETTINGS);
  }
}

let dbInstance: CheckVocaDatabase | null = null;

export function getDatabase(): CheckVocaDatabase {
  if (!dbInstance) {
    dbInstance = new CheckVocaDatabase();
  }
  return dbInstance;
}
