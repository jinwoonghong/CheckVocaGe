# 데이터 모델(로컬 우선)

## WordEntry
- `id: string` — 고유ID(`normalizedWord::url`)
- `word: string`
- `normalizedWord: string`
- `context: string`
- `contextSnapshot: { sentences: string[]; selectedSentenceIndex: number; rawText: string } | null`
- `url: string`
- `selectionRange: SelectionRangeSnapshot`
- `createdAt: number` — 최초 확인 날짜
- `updatedAt: number`
- `viewCount?: number` — 조회한 횟수
- `lastViewedAt?: number` — 마지막 조회 시각
- `sourceTitle: string`
- `language: string`
- `tags: string[]`
- `isFavorite: boolean`
- `manuallyEdited: boolean`
- `note?: string`
- `definitions?: string[]` — 단어의 뜻(여러 개)
- `phonetic?: string` — 발음기호
- `audioUrl?: string`
- `deletedAt?: number`(선택) — tombstone(소프트 삭제)

## ReviewState
- `id, wordId, nextReviewAt, interval, easeFactor, repetitions, history[]`

## 인덱스(Dexie)
- `word_entries`: `&id, normalizedWord, url, createdAt, updatedAt, lastViewedAt`
- `review_states`: `&id, wordId, nextReviewAt`

## 스냅샷
- `{ snapshotVersion: 2, wordEntries: WordEntry[], reviewStates: ReviewState[], ... }`

