# 네이버 영한사전 파싱 기능 분석

## 1. 개요

이 문서는 크롬 확장 프로그램의 핵심 기능 중 하나인 '웹 페이지에서 선택한 영어 단어의 뜻을 네이버 영한사전 API를 통해 가져와 사용자에게 보여주는' 로직을 분석하고 설명합니다.

## 2. 동작 흐름

전체적인 동작은 아래와 같은 순서로 이루어집니다.

1.  **[Content Script]** 사용자가 웹 페이지에서 단어를 마우스로 드래그하여 선택합니다.
2.  **[Content Script]** `mouseup` 이벤트를 감지하여 선택된 텍스트를 추출합니다.
3.  **[Content Script]** 추출된 텍스트를 `background.js`로 전달하여 사전 검색을 요청합니다.
4.  **[Background Script]** `content.js`로부터 받은 단어를 사용하여 네이버 영한사전 API 요청 URL을 생성합니다.
5.  **[Browser API]** `declarativeNetRequest` 규칙에 따라, API 요청 시 `Referer` 헤더를 `https://en.dict.naver.com`으로 설정하여 차단을 우회합니다.
6.  **[Background Script]** `fetch` API를 통해 네이버 사전에 단어 뜻을 요청하고 JSON 형태로 응답을 받습니다.
7.  **[Background Script]** 응답받은 JSON 데이터를 `content.js`로 다시 전달합니다.
8.  **[Content Script]** 전달받은 데이터를 파싱하여 HTML로 가공한 후, 마우스 커서 주변에 팝업 형태로 단어의 뜻과 발음기호를 표시합니다.

## 3. 파일별 상세 분석

### 3.1. `manifest.json`

-   **역할**: 확장 프로그램의 기본 설정과 파일들의 역할을 정의합니다.
-   **주요 내용**:
    -   `background.js`: 서비스 워커로 등록되어 백그라운드에서 핵심 로직을 수행합니다.
    -   `contentWrapper.js`: 모든 웹 페이지에 삽입되어 `content.js`를 동적으로 로드하는 역할을 합니다.
    -   `rule_endic.json`: `declarativeNetRequest` API 규칙 파일로, 네이버 사전 API 요청 시 헤더를 수정하는 데 사용됩니다.
    -   `host_permissions`: `https://*.dict.naver.com/`에 대한 접근 권한을 명시하여 해당 도메인에 API 요청이 가능하도록 합니다.

### 3.2. `contentWrapper.js` & `content.js`

-   **역할**: 사용자의 웹 페이지 인터랙션(단어 선택)을 감지하고, 결과를 화면에 표시하는 역할을 담당합니다.
-   **상세 로직 (`content.js`)**:
    1.  `mouseup` 전역 이벤트를 리스닝합니다.
    2.  이벤트 발생 시 `window.getSelection().toString().trim()`을 통해 사용자가 선택한 문자열을 가져옵니다.
    3.  문자열이 비어있지 않으면 `chrome.runtime.sendMessage({ type: "search", word: selectedText })`를 통해 백그라운드 스크립트에 검색을 요청합니다.
    4.  백그라운드로부터 검색 결과를 콜백으로 수신합니다.
    5.  `I(e)` 함수에서 수신된 JSON 데이터를 HTML로 파싱하고, `w(e, n, t, s)` 함수에서 Shadow DOM을 사용하여 외부 CSS의 영향을 받지 않는 팝업을 생성하여 화면에 표시합니다.

### 3.3. `background.js`

-   **역할**: `content.js`의 요청을 받아 실제 네이버 사전에 네트워크 요청을 보내고, 그 결과를 다시 `content.js`에 반환하는 중간 다리 역할을 합니다.
-   **상세 로직**:
    1.  `chrome.runtime.onMessage.addListener`를 통해 메시지를 수신합니다.
    2.  메시지 `action`이 `endic`인 경우, 함께 전달된 `url`로 `fetch` 요청을 보냅니다.
    3.  네이버 사전 API로부터 받은 응답(JSON)을 파싱하여 메시지를 보낸 `content.js`의 콜백 함수로 반환합니다.

### 3.4. `rule_endic.json`

-   **역할**: 네이버 사전 API의 직접적인 외부 호출을 막는 보안 정책(Referer 체크)을 우회합니다.
-   **상세 규칙**:
    -   **조건 (`condition`)**: `urlFilter`가 `https://en.dict.naver.com/`인 모든 요청.
    -   **동작 (`action`)**: 요청 헤더(`requestHeaders`)의 `referer` 값을 `https://en.dict.naver.com`으로 강제 설정(`set`)합니다.
    -   **결과**: 이 규칙 덕분에 `background.js`의 `fetch` 요청이 마치 네이버 사전 공식 웹사이트에서 보낸 것처럼 인식되어 정상적으로 처리됩니다.

## 4. 결론

해당 기능은 콘텐츠 스크립트, 백그라운드 스크립트, 그리고 브라우저의 네트워크 요청 제어 API가 유기적으로 연동되어 구현되었습니다. 특히 `declarativeNetRequest` API를 사용하여 외부 사이트의 API 호출 제약을 효과적으로 우회하는 부분이 핵심적인 기술이라고 할 수 있습니다.
