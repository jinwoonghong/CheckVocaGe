# E2E 테스트 계획 (개요)

- 목표
  - 단어 선택 → Tooltip 노출 → 영한 뜻/IPA/오디오 → 저장 흐름이 브라우저에서 정상 동작하는지 검증.

- 환경
  - Chromium 기반 브라우저(Chrome/Edge).
  - 확장 로드: `apps/extension/dist`.

- 시나리오
  - 콘텐츠 로딩: 테스트 페이지 열기 → content.js 주입 확인.
  - 선택 트리거: 텍스트 더블클릭/드래그 → Tooltip 표시 위치/내용 검증.
  - 정의 조회: 영→한 뜻 문자열 포함 여부 검증(네트워크 mocking 또는 고정 단어 활용).
  - IPA/오디오: IPA 표기 렌더링/오디오 재생 가능 상태 확인.
  - 저장: Save 클릭 → IndexedDB에 신규 항목 존재 확인.
  - 에러: 오프라인 모드/차단 상황에서 오류 표시 확인.

- 구현 가이드(추후)
  - Playwright + Chrome userDataDir로 확장 로드.
  - 네트워크 라우트(mock)로 사전 API 응답 고정.
  - DOM Query로 Tooltip 상태/텍스트/버튼 상태 검증.

