import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { AuthContext } from "../auth/firebase";
import { getDatabase } from "@core";
import { fetchUserWords, setWordIncludeInQuiz, getQuizPreference, setQuizPreference, deleteWord, type QuizMode } from "../db/firestore";

type WordRow = { id: string; word: string; context?: string; includeInQuiz?: boolean };

export function WordsPage() {
  const auth = useContext(AuthContext);
  const [rows, setRows] = useState<WordRow[]>([]);
  const [mode, setMode] = useState<QuizMode>('all');

  useEffect(() => {
    (async () => {
      if (auth?.user) {
        try {
          const cloud = (await fetchUserWords(auth.user.uid, 500)) as WordRow[];
          setRows(cloud);
          const pref = await getQuizPreference(auth.user.uid);
          if (pref) setMode(pref);
          return;
        } catch {}
      }
      const db = getDatabase();
      const local = (await db.wordEntries.orderBy('createdAt').reverse().toArray()) as any[];
      setRows(local as WordRow[]);
    })();
  }, [auth?.user?.uid]);

  const includedCount = useMemo(
    () => rows.filter((r) => (mode === 'onlyIncluded' ? r.includeInQuiz === true : r.includeInQuiz !== false)).length,
    [rows, mode]
  );

  const toggle = async (id: string, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, includeInQuiz: value } : r)));
    try {
      if (auth?.user) await setWordIncludeInQuiz(auth.user.uid, id, value);
      else {
        const db = getDatabase();
        await db.wordEntries.update(id, { includeInQuiz: value } as any);
      }
    } catch {}
  };

  const saveMode = async (m: QuizMode) => {
    setMode(m);
    try {
      if (auth?.user) await setQuizPreference(auth.user.uid, m);
    } catch {}
  };

  const remove = async (id: string) => {
    if (!confirm('이 단어를 삭제할까요?')) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      if (auth?.user) {
        await deleteWord(auth.user.uid, id);
      } else {
        const db = getDatabase();
        await db.wordEntries.delete(id);
        await db.reviewStates.delete(id);
      }
    } catch {}
  };  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2>단어장 관리</h2>
      <div style={{ margin: '8px 0 12px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>퀴즈 대상</strong>
        <label>
          <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> 전체(제외 표시만 제외)
        </label>
        <label>
          <input type='radio' name='mode' checked={mode === 'onlyIncluded'} onChange={() => saveMode('onlyIncluded')} /> 포함 표시만 출제
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>선택 대상: {includedCount}개</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>단어</th>
            <th style={{ textAlign: 'left' }}>문맥</th>
            <th>퀴즈 포함</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: '6px 8px' }}>{r.word}</td>
              <td style={{ padding: '6px 8px', color: '#9ca3af' }} title={r.context}>
                {r.context?.slice(0, 80)}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <input
                  type='checkbox'
                  checked={mode === 'onlyIncluded' ? r.includeInQuiz === true : r.includeInQuiz !== false}
                  onChange={(e: any) => toggle(r.id, e.currentTarget.checked)}
                />
              </td>\n              <td style={{ padding: '6px 8px', textAlign: 'center' }}><button onClick={() => remove(r.id)}>삭제</button></td>\n            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a href='/quiz'>← 퀴즈로 돌아가기</a>
      </div>
    </div>
  );
}




