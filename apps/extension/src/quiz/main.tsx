import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getDatabase } from '@core';
import type { WordEntry } from '@core/src/models';

function useWords(): WordEntry[] {
  const [words, setWords] = useState<WordEntry[]>([]);
  useEffect(() => {
    const db = getDatabase();
    db.wordEntries
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then((arr) => setWords(arr as WordEntry[]))
      .catch(() => setWords([]));
  }, []);
  return words;
}

function Quiz() {
  const words = useWords();
  const [index, setIndex] = useState(0);
  const [showContext, setShowContext] = useState(false);

  const card = useMemo(() => words[index], [words, index]);

  if (!words.length) {
    return (
      <div class="container">
        <div class="card">
          <div>단어장이 비어 있습니다.</div>
        </div>
      </div>
    );
  }

  const next = () => {
    setShowContext(false);
    setIndex((prev) => (prev + 1) % words.length);
  };

  return (
    <div class="container">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>진행: {index + 1} / {words.length}</div>
          <button class="secondary" onClick={() => location.reload()}>새로고침</button>
        </div>
        <div class="word">{card.word}</div>
        {showContext ? <div class="context">{card.context}</div> : <div class="context">뜻/문맥 숨김</div>}
        <div class="actions">
          <button class="secondary" onClick={() => setShowContext((v) => !v)}>{showContext ? '숨기기' : '정답 보기'}</button>
          <button class="primary" onClick={next}>다음</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return <Quiz />;
}

render(<App />, document.getElementById('root')!);

