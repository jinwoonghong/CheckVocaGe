# TODO (UTF-8 정리본)

## 완료 (v1.0.0)
- 콘텐츠 선택/드래그 감지, Tooltip UI(IPA/발음/정의 불릿/바깥 클릭·X 닫기)
- 영→한 뜻(네이버) + IPA/오디오(dictionaryapi.dev) + 10분 캐시, 태그/엔티티 정리
- IndexedDB 저장, FIFO 대기열 안정화, 테스트/타입체크/빌드/린트 통과
- 확장 팝업: 최근 단어 목록, 모바일웹 퀴즈 열기, 퀴즈 링크 복사, CSV 다운로드(UTF-8 BOM)
- 모바일웹 /quiz: Due 우선 출제, SM-2 평가(Again/Good/Easy), 스냅샷 해시 import

## 진행 중 (모바일웹 + 클라우드)
- [x] Google 로그인(Auth) 가드 도입, 사용자명/로그아웃 노출
- [x] Firestore 동기화 유틸: 스냅샷 업로드, 리뷰 상태 반영
- [x] 확장→웹 스냅샷 전달(해시) 연동
- [ ] Firebase Hosting 배포 파이프라인 구성 및 프로젝트 연결

## 다음 단계
- [ ] Firestore 보안 규칙 점검·강화(users/{uid}/words,reviews 권한)
- [ ] /quiz UX 고도화(진행률·목표·섞기·필터)
- [ ] 팝업: ‘모바일로 보내기’ 스냅샷 링크 복사 고도화(웹 배포 URL 적용)
- [ ] CSV 내보내기 옵션(필터/기간/즐겨찾기만)

## 운영/배포
- [x] CI: lint/typecheck/test 워크플로 추가(.github/workflows/ci.yml)
- [x] Hosting 배포 워크플로 초안 추가(.github/workflows/hosting.yml)
- [ ] Firebase 프로젝트 연결(FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID 시크릿 설정)
- [ ] firebase.json/.firebaserc 프로젝트 값 확정 및 rules 배포

## 참고
- 웹 환경변수 예시: apps/web/.env.example (Firebase 설정 필요)
- Hosting 설정: firebase.json(리라이트 → SPA), firestore.rules(권한), firestore.indexes.json
