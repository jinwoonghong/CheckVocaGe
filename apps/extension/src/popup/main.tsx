/// <reference types="chrome" />
import { render } from 'preact';

function openQuiz(): void {
  const url = chrome.runtime.getURL('quiz.html');
  chrome.tabs?.create?.({ url });
}

function downloadCsv(): void {
  chrome.runtime.sendMessage({ type: 'CHECKVOCA_EXPORT_CSV' }, (response?: { status?: string; message?: string }) => {
    if (chrome.runtime.lastError) {
      console.error('CSV export failed:', chrome.runtime.lastError.message);
      return;
    }
    if (response?.status === 'error') {
      console.error('CSV export failed:', response.message);
    }
  });
}

function App() {
  return (
    <div class="wrap">
      <h1>WebVoca</h1>
      <div class="actions">
        <button onClick={openQuiz}>모바일 퀴즈 열기</button>
        <button class="secondary" onClick={downloadCsv}>CSV 다운로드</button>
        <small>단어장(IndexedDB) 기반 기능</small>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);

