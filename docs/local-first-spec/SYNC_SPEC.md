# 동기화 사양(Local‑first, 수동)

원칙
- 로컬이 SSOT
- 수동으로 `Pull`(클라우드→로컬), `Push`(로컬→클라우드)
- 정책: LWW(updatedAt) + tombstone(deletedAt)

상태 보관
- `syncState`: `{ backend: 'firestore'|'drive', lastPulledAt?: number, lastPushedAt?: number }`

프로토콜
- Pull: `updatedAt > lastPulledAt` 문서만 페이지네이션으로 수집 → 병합
- Push: 로컬에서 `updatedAt > lastPushedAt` 변경분을 업서트/삭제로 전파
- Summary: `{ pulled: { upserts, deletes }, pushed: { upserts, deletes } }`

병합 규칙
- `deletedAt` 존재: 로컬/원격 모두 삭제 처리
- 양쪽 변경: `updatedAt` 큰 쪽 선택(LWW), 태그 등 집합은 합집합 옵션(2단계)

백엔드
- Firestore: `users/{uid}/words`, `users/{uid}/reviews`에 `updatedAt`, `deletedAt` 필수
- Drive(Apps Script): 전체 스냅샷 JSON 저장/복원(1단계), 변경분은 2단계

