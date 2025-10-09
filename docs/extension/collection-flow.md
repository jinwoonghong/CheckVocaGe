# 브라우저 확장 단어 수집 플로우 설계

## 1. 사용자 상호작용 단계
- **선택 감지**: 더블클릭, 드래그 후 마우스 업, 키보드 선택(Shift+화살표) 등을 통해 텍스트 범위가 변경되면 `content.js`가 Selection API를 확인.
- **문맥 추출**: 선택된 문장 주변 최대 2개 문장을 포함하도록 DOM 탐색 → 불필요한 공백/HTML 태그 제거.
- **툴팁 표시 조건**: 선택 길이 1~120자, 이미 최근 5초 내 동일 범위를 처리한 경우 재요청 방지.

## 2. 메시지 파이프라인
1. `content.js`가 `chrome.runtime.sendMessage`로 `background.js`에게 수집 요청 전송.
2. 메시지 페이로드는 `{ word, context, url, selectionRange, timestamp, clientMeta }` 형식.
3. `background.js`는 요청 큐에 enqueue 후 네트워크/캐시 쓰기 작업을 비동기로 실행.
4. 응답은 성공/실패 상태와 캐시 저장 ID를 포함해 다시 `content.js`로 전달.

## 3. 캐시 저장 및 오프라인 처리
- 온라인: IndexedDB `word_entries` 스토어에 즉시 upsert.
- 오프라인/네트워크 오류: `pending_requests` 스토어에 enqueue → 백그라운드 재시도 스케줄러가 주기적으로 처리.
- 저장 후 브로드캐스트 채널을 통해 웹 앱에 변경 사항 알림.

## 4. 오류/예외 시나리오
- **선택 텍스트 없음**: UI 표시는 하지 않고 로그만 남김.
- **중복 선택**: 동일 URL+문자열 조합이 최근 5분 내 저장된 경우 사용자에게 중복 알림.
- **API 호출 실패**: 재시도(지수 백오프 최대 3회) 후 `pending` 상태로 사용자가 확인하도록 토스트 알림.

## 5. 이벤트/로그 추적
- 주요 사용자 이벤트(Sentry breadcrumb): `selection_detected`, `tooltip_shown`, `save_requested`, `save_success`, `save_failed`.
- 성능 모니터링: 선택 후 툴팁 표시까지 지연(ms), 저장 완료까지 지연(ms).

## 6. 추후 확장 고려 사항
- 추천 단어/하이라이트 연동 시 선택된 문장의 토큰 목록 캐싱.
- Pro Plan 진입 시 Firebase 동기화 레이어 추가를 위한 `syncState` 필드 예약.
