# Changelog

## 테스트 방법
- npx -y pnpm@9 --filter @checkvocage/web build
- npx -y pnpm@9 --filter @checkvocage/extension build
- npx firebase-tools deploy --only hosting   

## 1.1.0
- 확장 팝업 기능 강화: 최근 단어 목록 표시, 모바일웹 퀴즈 열기, 퀴즈 링크 복사, CSV 다운로드(UTF-8 BOM) 지원
- 퀴즈/학습: SM-2 기반 스케줄링과 퀴즈 채점(Again/Good/Easy), Due 리뷰 우선 출제
- 옵션 페이지 추가: 모바일웹 기본 URL 설정 지원(팝업에서 사용), `.env`의 `VITE_WEB_BASE`도 지원
- 웹앱: 모바일 스타일의 `/quiz` 페이지 추가, Google 로그인 가드, 스냅샷 해시 임포트, Firestore 동기화 유틸 및 리뷰 상태 반영
- 기타: 매니페스트/경로 정리 및 빌드 구성 개선

사용 방법(확장 프로그램 + 퀴즈)
- 빌드/설치
  - 루트에서 `pnpm install` 후 `pnpm build` 실행 (or `cd apps/extension && pnpm build`)
  - Chrome `chrome://extensions` → 개발자 모드 → `apps/extension/dist` 폴더를 "압축해제된 확장 프로그램을 로드"로 추가
  - 모바일웹 주소 설정: 확장 옵션 페이지에서 Web Base URL을 설정하거나 `apps/extension/.env`의 `VITE_WEB_BASE` 값을 설정
- 사용
  - 임의 웹페이지에서 영어 단어를 더블클릭/드래그하면 Tooltip이 표시됩니다(영→한 뜻, IPA, 발음 재생, 즐겨찾기).
  - 선택된 단어와 문맥은 IndexedDB에 자동 저장되며, 동일 단어 재조회는 10분 TTL 캐시를 사용합니다.
  - 확장 팝업에서 최근 단어를 확인하고, "퀴즈 시작(모바일웹)"으로 `/quiz`에 접속하거나, "CSV 다운로드"로 단어장을 내보낼 수 있습니다.
  - 웹앱 `/quiz`는 Google 로그인 후 이용 가능하며, SM-2 기반으로 Due 리뷰가 우선 출제됩니다.

## 1.0.0
- 콘텐츠에서 단어 선택/드래그 감지 및 Tooltip 표시
- 영→한 뜻 조회(네이버 enko) + IPA/오디오 보강(dictionaryapi.dev)
- 발음 재생 버튼, IPA 표기
- 정의 목록 불릿 렌더링, HTML 태그 제거/엔티티 디코드
- 문맥 스니펫 추출(과다 노출 방지), 외부클릭/X 버튼으로 닫기
- IndexedDB 저장(선택 저장), 대기열 FIFO 안정화
- 배경 조회 10분 TTL 캐시
- 타입/테스트/빌드/린트 통과

