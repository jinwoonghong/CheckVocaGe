import type { SelectionRangeSnapshot, SelectionPayload } from '../types/selection';

export interface ContextSnapshot {
  sentences: string[];
  selectedSentenceIndex: number;
  rawText: string;
}

export interface WordEntry {
  id: string;
  word: string;
  normalizedWord: string;
  context: string;
  contextSnapshot: ContextSnapshot | null;
  url: string;
  selectionRange: SelectionRangeSnapshot;
  createdAt: number;
  updatedAt: number;
  sourceTitle: string;
  language: string;
  tags: string[];
  isFavorite: boolean;
  manuallyEdited: boolean;
  note?: string;
}

export interface ReviewHistoryItem {
  reviewedAt: number;
  grade: number;
}

export interface ReviewState {
  id: string;
  wordId: string;
  nextReviewAt: number;
  interval: number;
  easeFactor: number;
  repetitions: number;
  history: ReviewHistoryItem[];
}

export interface QuizSession {
  id: string;
  wordIds: string[];
  startedAt: number;
  completedAt?: number;
  correctCount: number;
  incorrectCount: number;
}

export type PendingStatus = 'pending' | 'retrying' | 'failed';

export interface PendingRequest {
  id: string;
  payload: SelectionPayload;
  status: PendingStatus;
  attemptCount: number;
  lastAttemptedAt?: number;
  createdAt: number;
}

export interface SettingsRecord {
  id: string;
  key: string;
  value: unknown;
  updatedAt: number;
}
