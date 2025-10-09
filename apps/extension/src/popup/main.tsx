/// <reference types="chrome" />
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getDatabase } from '@core';

type WordEntry = any;

function openQuiz(): void {
  const url = chrome.runtime.getURL('src/quiz/index.html');
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
  const [words, setWords] = useState<WordEntry[]>([]);

  useEffect(() => {
    const db = getDatabase();
    db.wordEntries
      .orderBy('createdAt')
      .reverse()
      .limit(20)
      .toArray()
      .then((arr) => setWords(arr as WordEntry[]))
      .catch(() => setWords([]));
  }, []);

  const copyLink = async () => {
    const url = chrome.runtime.getURL('src/quiz/index.html');
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  return (
    <div class="wrap">
      <h1>WebVoca</h1>
      <div style="margin-bottom:10px;">
        <small>최근 조회 단어</small>
        <ul style="max-height:180px;overflow:auto;margin:6px 0;padding-left:16px;">
          {words.length === 0 && <li>표시할 단어가 없습니다.</li>}
          {words.map((w) => (
            <li key={w.id} title={w.context}>
              {w.word}
            </li>
          ))}
        </ul>
      </div>
      <div class="actions">
        <button onClick={openQuiz}>퀴즈 시작(모바일웹)</button>
        <button class="secondary" onClick={copyLink}>퀴즈 링크 복사</button>
        <button class="secondary" onClick={downloadCsv}>CSV 다운로드</button>
        <small>단어장(IndexedDB) 기반 기능</small>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
