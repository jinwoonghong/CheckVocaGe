# TODO (요약)

## 완료 (v1.2.2)
- 팝업 내부 결과 표시(정의/IPA/발음), 로딩/오류 UI 추가
- 팝업 ‘단어 저장’ 버튼: 확장 DB 저장 + 웹 importSelection 핸드오프
- 콘텐츠 스크립트의 `selectionKey` 처리로 선택 전달(postMessage)
- 단어장 병합 로딩: 로그인 시 클라우드 + 로컬 동시 반영(삭제 후 재추가 즉시 표시)
- 단어장 일괄 삭제 UX 분리: 삭제(선택 N), 삭제(필터 M)
- 삭제 동기화: 미로그인 삭제분을 로그인 시 클라우드에서도 일괄 삭제
- Vite 프리셋 동적 import로 CJS/ESM 충돌 해결, BOM 제거
- Firebase Hosting 배포 완료

## 완료 (v1.2.1)
- 팝업 ‘단어검색’ 입력/버튼 추가, 현재 탭에 툴팁 표시
- 문서 인코딩(UTF-8) 정리: CHANGELOG/TODO

## 진행 중 (v1.2.x)
- [ ] 웹 타입체크/빌드 정리(Quiz.tsx 잔여 경고/중복 변수 제거)
- [ ] 단어 저장 시(웹 importSelection) 로그인 상태면 클라우드에도 즉시 upsert
- [ ] 삭제 Undo(되돌리기) 토스트 + 작업 로그
- [ ] 단어장 성능: 페이징/가상 스크롤, 선택 반전
- [ ] 확장 팝업: 최근 검색 기록/재조회, 즐겨찾기 토글
- [ ] GH Actions 배포 워크플로우 개선(프리뷰 채널, 태그 자동 배포)

## 운영/배포
- [x] CI: lint/typecheck/test 워크플로우(.github/workflows/ci.yml)
- [x] Hosting 배포 워크플로우 초안(.github/workflows/hosting.yml)
- [x] Firestore Rules 배포(최소권한)
- [ ] .firebaserc 프로젝트 갱신 및 스크립트 정리
- [ ] 릴리즈 채널(Preview URL) + 태그 배포(v*)

## 개발 메모
- 동기화 정책
  - 로그인 직후 1회 자동 동기화 + 수동 동기화 버튼
  - 미로그인 삭제는 큐에 기록, 로그인 시 클라우드 일괄 삭제
  - 선택 핸드오프: storage 키 + postMessage로 안전 전달 후 즉시 삭제
- 보안/설정
  - Firestore Rules 최소권한 적용, 문서 ID 표준화, undefined 필드 정리
  - API Key 제한 및 Authorized domains 최적화

