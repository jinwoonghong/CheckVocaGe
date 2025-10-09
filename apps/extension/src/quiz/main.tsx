import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getDatabase, fetchDueReviews, applySm2Review } from '@core';
type WordEntry = any;

function useWords(): WordEntry[] {
  const [words, setWords] = useState<WordEntry[]>([]);
  useEffect(() => {
    (async () => {
      const due = await fetchDueReviews();
      if (due.length > 0) {
        setWords(due);
        return;
      }
      // Fallback: 최근 등록 단어 20개
      const db = getDatabase();
      const arr = (await db.wordEntries.orderBy('createdAt').reverse().limit(20).toArray()) as WordEntry[];
      setWords(arr);
    })().catch(() => setWords([]));
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

  const grade = async (g: 2 | 4 | 5) => {
    try {
      await applySm2Review(card.id, g);
    } catch {}
    next();
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
          <button class="secondary" onClick={() => grade(2)}>Again</button>
          <button class="secondary" onClick={() => grade(4)}>Good</button>
          <button class="primary" onClick={() => grade(5)}>Easy</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return <Quiz />;
}

render(<App />, document.getElementById('root')!);

