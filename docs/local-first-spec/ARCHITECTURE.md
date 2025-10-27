# 아키텍처

구성요소
- Core(`packages/core`): 데이터 모델, Dexie 저장소, 스냅샷, SM‑2, 로컬 이벤트 브로드캐스트
- Web(`apps/web`): 관리/퀴즈 SPA, 동기화 UI(수동)
- Extension(`apps/extension`): 선택/정의 조회/로컬 저장 + 웹 핸드오프
- GAS Mobile(옵션): 모바일 친화 퀴즈(Web App)

의존 흐름
- 확장 → Core(로컬 저장) → 웹 핸드오프 → 웹에서 목록/퀴즈 표시
- 동기화 버튼 → Backend(Firestore/Drive) Push/Pull

로컬 이벤트
- BroadcastChannel `checkvoca-cache`로 `word:updated` 등 송신 → 웹 UI 즉시 갱신

환경 변수
- `VITE_AUTO_CLOUD_SYNC=0|1`(기본 0)
- `VITE_SYNC_BACKEND=firestore|drive`(기본 firestore)

