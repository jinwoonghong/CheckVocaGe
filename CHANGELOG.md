# Changelog

## 1.2.3
- Web: 단어장(/words) 로그인 필수로 변경, Firestore 기준으로만 목록 표시.
- Web: 단어 삭제는 즉시 Firestore에서 제거(오프라인 삭제 큐 제거).
- Web: /quiz 동기화 완료 시 배너와 "단어장 보기" 링크를 노출해 흐름 분명화.
- Web: /words 한글 UI 텍스트 정리(깨짐 해결, 라벨/문구 자연스럽게 수정).
- Extension: 환경설정을 팝업 내부 인라인 패널로 이동. Web Base URL 항목 UI 제거.
- Extension: manifest의 `options_page` 및 options 빌드 스텝 제거.
- CI: web Vitest 설정 간소화(플러그인 제거), package.json의 BOM 제거로 PostCSS 로더 오류 해결.
- Lint/Typecheck: no-empty, 불필요 이스케이프, 훅 의존성 등 경미한 이슈 정리.

## 1.2.2
- 확장 팝업: 검색 결과 표시(의미/IPA/발음), 로딩/오류 UI 추가.
- 확장 팝업: 저장(로컬 DB) + importSelection 핸드오프.
- selectionKey 핸드오프 처리, postMessage 경로 추가.
- Web(/words) 병합 로딩: 로컬 + 클라우드 병합(삭제 항목 복원 방지 보정 포함).
- 삭제 UX 개선: 선택 N개/필터 M개 삭제.
- 오프라인 삭제 유지 로직 보완.
- 빌드 정리: Vite CJS/ESM import 정리, BOM 제거.
- Firebase Hosting 기본 배포 파이프라인 구성.

## 1.2.1
- 팝업/검색: 입력/버튼 추가, 현재 탭에 결과 노출.
- 결과를 현재 뷰에 잘 맞게 표시(선택 결과 우선 노출).
- CHANGELOG/TODO를 UTF‑8로 정리 시작.

## 1.2.0
- 로그인 상태 구분(로딩/미로그인/로그인), /quiz 진입 시 팝업 동작 보정.
- /words 추가: 퀴즈 포함 토글, 표시 모드(전체/포함만), 로컬/클라우드 병합 로딩(초기).
- 문서/ID 정리, undefined 핸들링, Firestore Rules 배포.
- 국어사전 옵션 + VITE_ENABLE_KO_DICT 토글.
- 단어 목록 화면에서 상세 화면 이동 버튼 추가.

