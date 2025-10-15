# TODO

## 완료 (v1.2.3)
- /words 로그인 필수 전환, Firestore 기준 목록 표시로 단순화
- /words 삭제 즉시 Firestore 반영, 오프라인 삭제 큐 제거
- /quiz 동기화 완료 배너 + "단어장 보기" 링크 노출
- 확장 팝업 내 인라인 설정(활성화 키) 추가, Web Base URL 항목 UI 제거
- manifest의 `options_page`/options 빌드 제거(탭형 옵션 완전 제거)
- /words 한글 텍스트 깨짐 정리 및 라벨/문구 개선
- Lint/Typecheck 정리(no-empty, 이스케이프, 훅 의존성 정리)
- CI 안정화: web Vitest 플러그인 제거, package.json BOM 제거

## 다음 (v1.2.4)
- 번들 최적화: /web 청크 분할로 500 kB 경고 해소
- ESLint 경고 제거(남아있는 any 타입 점진적 제거)
- /quiz 동기화 배너 스타일 및 위치 개선
- 삭제 Undo(되돌리기) 옵션 검토
- 확장 옵션 소스 정리(미사용 options/* 폴더 제거 여부 결정)
- i18n/문구 다듬기(영문/국문 병기 정리)

## 인프라/CI
- CI(Node 20.19+ 고정, Corepack pnpm 사용) 유지
- Firebase Hosting 프로덕션 배포 워크플로 유지
- .firebaserc 프로젝트/대상 점검 및 문서화

## 참고 플로우
- 동기화: 확장 로그인 → 팝업 "퀴즈 시작(모바일웹)" → /quiz 진입 시 로컬→클라우드 동기화
- 단어장: /words는 로그인 후 클라우드 목록 표시, 삭제 즉시 반영

