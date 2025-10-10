# TODO (UTF-8 정리본)

## 완료 (v1.1.0)
- 팝업: 최근 단어 목록, 퀴즈 시작, 퀴즈 링크 복사, CSV 다운로드(UTF-8 BOM)
- 학습/퀴즈: SM-2 스케줄링·채점(Again/Good/Easy), Due 리뷰 우선 출제
- 옵션 페이지: 모바일웹 기본 URL(Web Base) 설정 추가 및 팝업 연동
- 웹앱: 모바일 스타일의 `/quiz`, Google 로그인 가드, 스냅샷 가져오기(해시/postMessage), Firestore 동기화 유틸
- 안정화: IndexedDB 저장 플로우 + 10분 TTL 캐시, 매니페스트/경로 정리
- 로그인/URL 이슈 해결: 팝업 차단 시 리다이렉트 로그인 폴백, URL-too-long 제거(스냅샷 키 핸드오프)
- 최근 단어 목록 필터: 숫자/한글 제외, 영문 단어만 표시

## 진행 중 (웹/클라우드)
- [ ] 클라우드 동기화 안정화(베타)
  - [x] 로그인 직후 1회 자동 업로드(토스트 알림)
  - [ ] 실패 로깅/재시도(지수 백오프) 추가
  - [ ] 수동 동기화 버튼 토스트화(기존 alert 제거)
  - [x] 스냅샷 임포트 후 목록 자동 리로드 및 병합
- [ ] Firestore 보안 규칙 강화 및 배포
  - [ ] 최소권한: users/{uid}/words,reviews는 uid 본인만 R/W
  - [ ] writesAllowed()에서 usage 문서 미존재 시 기본 허용 처리
  - [ ] 인덱스/쿼리 점검(최신순 createdAt 정렬)
- [ ] App Check 검토(선택)
  - [ ] reCAPTCHA v3 키 발급 및 초기화 코드 추가
  - [ ] Enforcement 단계적 적용(개발→프로덕션)

## 다음 단계 (v1.2.0 후보)
- [ ] /quiz UX 개선: 키보드 단축키, 세션 요약, 오답 재복습
- [ ] 팝업 고도화: '아는 단어' 하이라이트, 추천 단어 표시
- [ ] CSV 내보내기 옵션: 기간/필터/즐겨찾기만
- [ ] 에러/사용 로그: 기본 breadcrumb + 실패 지표 수집
- [ ] E2E 테스트(확장+웹): 선택→툴팁→저장→퀴즈 시나리오 자동화(Playwright)

## 운영/배포
- [x] CI: lint/typecheck/test 워크플로우 추가(.github/workflows/ci.yml)
- [x] Hosting 배포 워크플로우 초안 추가(.github/workflows/hosting.yml)
- [ ] 프로젝트 시크릿 설정: FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID
- [ ] .firebaserc 실제 프로젝트로 갱신 및 rules 배포
- [ ] 스테이징 채널 도입(Preview URL) + 태그 배포(v*)

## 개발 명세(요약)
- 동기화 정책
  - 업로드: 로그인 직후 1회 자동 업로드 + 수동 트리거 버튼
  - 다운로드: 로그인 시 클라우드 단어 취합, 로컬과 id 기준 병합(중복 제거)
  - 스냅샷: 확장→웹은 storage 키 + postMessage로 전달, 임포트 후 재로딩
- 보안/안정성
  - Firestore Rules 최소권한, usage.stopWrites로 서버측 쓰기 차단 가능
  - API Key 제한: Identity Toolkit, Firestore API 허용 + 허용 도메인 등록
  - App Check 적용 시 초기화 코드와 콘솔 Enforcement 정합성 유지
