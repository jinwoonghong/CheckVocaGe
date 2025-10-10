# TODO (정리본)

## 완료 (v1.1.0)
- 팝업: 최근 단어 목록, 퀴즈 시작, 퀴즈 링크 복사, CSV 다운로드(UTF-8 BOM)
- 학습/퀴즈: SM-2 스케줄링·채점(Again/Good/Easy), Due 리뷰 우선 출제
- 옵션 페이지: 모바일웹 기본 URL(Web Base) 설정 + 팝업 연동
- 웹앱: `/quiz` 추가, Google 로그인 가드, 스냅샷(해시/postMessage) 임포트, Firestore 동기화 유틸
- 안정화: IndexedDB 저장 + 10분 TTL 캐시, 매니페스트/경로 정리
- 로그인/URL 이슈 해결: 팝업 차단 시 리다이렉트 로그인 폴백, URL-too-long 제거(스냅샷 키 핸드오프)
- 최근 단어 목록 필터: 숫자/한글 제외, 영문 단어만 표시

## 진행 중 (웹/클라우드) — v1.2.0
- [x] 로그인 상태 구분(로딩/미로그인/로그인)으로 팝업 재등장 방지
- [x] 단어장 관리(/words): 퀴즈 포함 토글, 출제 모드(전체/포함만)
- [x] 단어 삭제: 클라우드/로컬 모두 지원
- [x] 동기화 안정화: 문서 ID 안전화(금지문자 치환+해시 축약), undefined 필드 제거
- [x] Firestore Rules 정리: users/{uid}/words|reviews|settings 본인만 R/W
- [ ] 단어장 관리 고도화 1차(우선 5가지)
  - [ ] 검색/필터/일괄 작업(포함/제외/삭제/태그)
  - [ ] 태그 + 저장된 필터(로그인 시 settings 동기화)
  - [ ] 휴지통(소프트 삭제/복원/영구삭제)
  - [ ] 미니 대시보드 + 단어 상세 패널
  - [ ] CSV 가져오기 마법사(중복 병합 미리보기)
- [ ] /quiz UX 개선: 단축키, 세션 요약, 오답 재복습
- [ ] 동기화 실패 로깅/재시도(지수 백오프), 수동 동기화 토스트화

## 운영/배포
- [x] CI: lint/typecheck/test 워크플로우(.github/workflows/ci.yml)
- [x] Hosting 배포 워크플로우 초안(.github/workflows/hosting.yml)
- [x] Firestore Rules 배포(최소권한)
- [ ] .firebaserc 실제 프로젝트로 갱신 및 시크릿 정리
- [ ] 프리뷰 채널 도입(Preview URL) + 태그 배포(v*)

## 개발 명세(요약)
- 동기화 정책
  - 업로드: 로그인 직후 1회 자동 업로드 + 수동 동기화 버튼
  - 다운로드: 로그인 시 클라우드 단어 우선, 없으면 로컬 due→recent 폴백
  - 스냅샷: 확장→웹은 storage 키 + postMessage 전달, 임포트 후 재로딩
- 보안/안정성
  - Firestore Rules 최소권한 유지
  - 문서 ID 안전화(금지문자 치환+길이 축약), undefined 필드 제거
  - API Key 제한 및 Authorized domains 정합성 유지
