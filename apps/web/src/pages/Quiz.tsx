import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchDueReviews, applySm2Review, getDatabase, exportSnapshot } from '@core';
import { useContext } from 'preact/hooks';
import { AuthContext } from '../auth/firebase';
import { fetchUserWords, upsertSnapshotToFirestore, upsertReviewState } from '../db/firestore';

type WordEntry = any;

function useBootstrapFromSnapshot(): void {
  useEffect(() => {
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const m = hash.match(/snapshot=([^&]+)/);
    if (!m) return;
    try {
      const json = decodeURIComponent(m[1]);
      const data = JSON.parse(json);
      // dynamic import to avoid ESM circulars
      import('@core').then(({ importSnapshot }) => importSnapshot(data)).catch(() => void 0);
    } catch {
      // ignore parse errors
    }
  }, []);
}

export function QuizPage() {
  const auth = useContext(AuthContext);
  useBootstrapFromSnapshot();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    (async () => {
      // If logged in, prefer cloud words
      if (auth?.user) {
        const cloudWords = await fetchUserWords(auth.user.uid, 100);
        if (cloudWords.length) {
          setWords(cloudWords);
          return;
        }
      }
      const due = await fetchDueReviews();
      if (due.length) setWords(due);
      else {
        const db = getDatabase();
        const recent = (await db.wordEntries.orderBy('createdAt').reverse().limit(20).toArray()) as WordEntry[];
        setWords(recent);
      }
    })();
  }, [auth?.user?.uid]);

  const card = useMemo(() => words[index], [words, index]);
  const next = () => {
    setShowContext(false);
    setIndex((i) => (words.length ? (i + 1) % words.length : 0));
  };

  const grade = async (g: 2 | 4 | 5) => {
    try {
      if (card?.id) {
        const updated = await applySm2Review(card.id, g);
        if (auth?.user) await upsertReviewState(auth.user.uid, updated);
      }
    } catch {
      // ignore
    }
    next();
  };

  if (!auth?.user) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h2>로그인이 필요합니다</h2>
        <p>구글 계정으로 로그인 후 퀴즈를 진행하세요.</p>
        <button onClick={() => auth?.signInWithGoogle()}>Google 로그인</button>
      </div>
    );
  }

  if (!words.length) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h2>퀴즈</h2>
        <p>단어장이 비어 있습니다. 스냅샷을 전달하거나, 확장에서 데이터를 가져오세요.</p>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => auth?.signOut()}>로그아웃</button>
        </div>
      </div>
    );
  }

  const syncToCloud = async () => {
    if (!auth?.user) return;
    try {
      const snapshot = await exportSnapshot();
      await upsertSnapshotToFirestore(auth.user.uid, snapshot);
      alert('클라우드 동기화 완료');
    } catch {
      alert('동기화 실패');
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong>
            진행 {index + 1} / {words.length}
          </strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>{auth.user?.displayName}</span>
            <button onClick={() => auth?.signOut()}>로그아웃</button>
            <button onClick={() => location.reload()}>새로고침</button>
            <button onClick={syncToCloud}>클라우드 동기화</button>
          </div>
        </div>
        <div style={{ background: '#111827', color: '#e5e7eb', padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{card?.word}</div>
          <div style={{ color: '#9ca3af', margin: '8px 0 12px' }}>{showContext ? card?.context : '정답 보기 눌러 확인'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowContext((v) => !v)}>{showContext ? '숨기기' : '정답 보기'}</button>
            <button onClick={() => grade(2)}>Again</button>
            <button onClick={() => grade(4)}>Good</button>
            <button onClick={() => grade(5)}>Easy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
