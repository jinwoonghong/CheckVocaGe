# Changelog

## 1.2.2
- 팝업 내부 결과 표시: 정의/IPA/발음, 로딩/오류 UI 추가
- 팝업 ‘단어 저장’ 버튼 추가: 확장 DB 저장 + 웹으로 핸드오프(importSelection)
- 콘텐츠 스크립트가 `selectionKey` 처리 → 웹에 선택 전달(postMessage)
- 단어장(/words) 병합 로딩: 클라우드 + 로컬 동시 반영(삭제 후 재추가 즉시 표시)
- 단어장 일괄 삭제 UX 분리: 삭제(선택 N), 삭제(필터 M)
- 삭제 동기화: 미로그인 삭제를 로그인 시 클라우드에서도 일괄 삭제
- 빌드 안정화: Vite 프리셋 동적 import(CJS/ESM 충돌 해결), BOM 제거
- Firebase Hosting로 최신 웹 배포 완료

## 1.2.1
- 확장 팝업에 ‘단어검색’ 입력/버튼 추가
- 입력한 영어 단어를 현재 탭에 툴팁으로 표시(선택과 동일한 결과)
- CHANGELOG/TODO 한글 인코딩(UTF-8) 정리

## 1.2.0
- 로그인 상태 구분(로딩/미로그인/로그인) 개선, /quiz 진입 시 팝업 오동작 수정
- 단어장(/words) 추가: 퀴즈 포함 여부, 출제 모드(전체/즐겨찾기), 저장(클라우드/로컬)
- 안정화: 문서 ID 표준화(금칙문자 치환+길이 축약), undefined 필드 정리
- Firestore Rules 배포: users/{uid}/words|reviews|settings 본인만 R/W(배포)
- Ko-dict 사전 조회(무료 플랜) + VITE_ENABLE_KO_DICT 플래그로 보강 조회 비활성화
- 단어 목록 화면에 단어장 이동 버튼 추가

## 배포 방법
- npx -y pnpm@9 --filter @checkvocage/web build
- npx -y pnpm@9 --filter @checkvocage/extension build
- npx firebase-tools deploy --only hosting

## 1.1.0
- 팝업 기능 강화: 최근 단어, 모바일웹 사이즈, 퀴즈 링크 복사, CSV 다운로드(UTF-8 BOM)
- 퀴즈/학습: SM-2 스케줄링·채점(Again/Good/Easy), Due 리뷰 우선 출제
- 옵션 페이지: 모바일웹 기본 URL(Web Base) 설정, `.env`의 `VITE_WEB_BASE` 지원
- 웹앱: 모바일 `/quiz` 추가, Google 로그인, 스냅샷 내보내기/가져오기, Firestore R/W 반영
- 기타: 매니페스트 경로 정리 및 빌드 구성 개선

