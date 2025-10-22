# TODO

## 진행중/완료 예정 (v1.2.3)
- /words: Firestore 목록 최신순 표시, 토글 즉시 반영(스낵바 제거)
- /quiz: 초기 안내 배너 + “단어장 보기” 링크 노출
- 확장 팝업: 환경설정 UI 정리(활성화 키만 유지), Web Base URL UI 제거
- 확장: manifest의 options 제거 및 options 소스/빌드 제거 (완료)
- /words: 한글 깨짐 해결 및 레이블/문구 정리 (완료)
- Lint/Typecheck 정리(no-empty, 불필요한 스코프, 존재 여부 체크 등)
- CI 정리(web Vitest 플러그인 제거, package.json BOM 제거)

## 다음 (v1.2.4)
- 번들 최적화: /web 코드 분할로 500 kB 경고 해소
- ESLint 경고 정리(남아있는 any, 훅 의존성 등)
- /quiz: 초기 배너/토스트 위치 및 동선 개선
- 삭제 Undo(되돌리기) 옵션 검토
- i18n/문구 다듬기(한/영 병기 검토)

## 배포/CI
- CI(Node 20.19+ 고정, Corepack pnpm 사용) 구성
- Firebase Hosting 프로덕션 배포 체크리스트 도입
- .firebaserc 프로젝트/타겟 문서화

## 참고 메모
- 확장 팝업: “퀴즈 시작(모바일웹)”은 /quiz 진입, 로컬→클라우드 싱크 트리거
- 웹 /words: 로그인 후 클라우드 목록 표시, 토글 즉시 반영
