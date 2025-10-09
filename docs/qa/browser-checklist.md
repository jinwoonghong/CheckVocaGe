# 브라우저 QA 체크리스트 (확장 프로그램)

- 설치/로딩
  - 개발자 모드에서 `apps/extension/dist` 로드 시 에러 없음.
  - Service Worker(Background) 활성화, 오류 로그 없음.

- 권한/규칙
  - manifest `host_permissions` 유효(`<all_urls>`). 필요시 `https://en.dict.naver.com/*` 좁히기 가능.
  - DNR 규칙(`rules/checkvoca_endic.json`) 로드됨, 네이버 요청에 referer 헤더 설정 확인.

- 콘텐츠 동작
  - 임의 웹페이지에서 단어 더블클릭/드래그 시 Tooltip 표시.
  - 단어, IPA(있으면 //로 표기), 재생 버튼(오디오 있으면 활성화) 노출.
  - 뜻(영→한) 표시. 실패 시 오류 메시지 처리.

- 메시지/저장
  - 저장 클릭 시 배경으로 `CHECKVOCA_SELECTION` 전송, 오류 없이 완료.
  - IndexedDB에 WordEntry 생성/업데이트 확인.

- 네트워크/캐시
  - 최초 조회 시 네이버/dictionaryapi.dev 요청 발생.
  - 동일 단어 재조회 시 캐시(10분 TTL)로 네트워크 감소.

- 예외/복구
  - 오프라인 시 정의 로딩 실패 메시지 표시.
  - Esc로 Tooltip 닫힘, 재선택 시 정상 복귀.

