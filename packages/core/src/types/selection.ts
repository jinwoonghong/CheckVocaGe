export interface SelectionRangeSnapshot {
  startContainerPath: string;
  startOffset: number;
  endContainerPath: string;
  endOffset: number;
}

export interface ClientMeta {
  title: string;
  language: string;
  userAgent?: string;
}

export interface SelectionPayload {
  word: string;
  context: string;
  url: string;
  selectionRange: SelectionRangeSnapshot;
  timestamp: number;
  clientMeta: ClientMeta;
  isFavorite?: boolean;
  tags?: string[];
  note?: string;
  // Optional enrichments from dictionary lookup
  definitions?: string[];
  phonetic?: string;
  audioUrl?: string;
}
