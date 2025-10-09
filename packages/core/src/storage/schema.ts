export const DB_NAME = 'checkvoca';
export const DB_VERSION = 1;

export const STORE_WORD_ENTRIES = 'word_entries';
export const STORE_REVIEW_STATES = 'review_states';
export const STORE_PENDING_REQUESTS = 'pending_requests';
export const STORE_QUIZ_SESSIONS = 'quiz_sessions';
export const STORE_SETTINGS = 'settings';

export type StoreName =
  | typeof STORE_WORD_ENTRIES
  | typeof STORE_REVIEW_STATES
  | typeof STORE_PENDING_REQUESTS
  | typeof STORE_QUIZ_SESSIONS
  | typeof STORE_SETTINGS;
