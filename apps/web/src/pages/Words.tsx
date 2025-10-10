import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { AuthContext } from "../auth/firebase";
import { getDatabase } from "@core";
import { fetchUserWords, setWordIncludeInQuiz, getQuizPreference, setQuizPreference, deleteWord, type QuizMode } from "../db/firestore";

type WordRow = { id: string; word: string; context?: string; includeInQuiz?: boolean };

export function WordsPage() {
  const auth = useContext(AuthContext);
  const [rows, setRows] = useState<WordRow[]>([]);
  const [mode, setMode] = useState<QuizMode>('all');\n  const [query, setQuery] = useState<string>('');\n  const [filter, setFilter] = useState<'all'|'included'|'excluded'>('all');\n  const [loading, setLoading] = useState(false);\n  const [selected, setSelected] = useState<Record<string, boolean>>({});

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
    })();\n  }, [auth?.user?.uid]);\n\n  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'included' && r.includeInQuiz === false) return false;
      if (filter === 'excluded' && r.includeInQuiz !== false) return false;
      if (!q) return true;
      const hay = `${r.word} ${r.context ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, filter]);


  const includedCount = useMemo(() => filtered.filter((r) => (mode === "onlyIncluded" ? r.includeInQuiz === true : r.includeInQuiz !== false)).length, [filtered, mode]);

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
  };\n  const setSelectionAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const r of filtered) next[r.id] = checked;
    setSelected(next);
  };

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  async function withProgress<T>(fn: () => Promise<T>) {
    setLoading(true);
    try { return await fn(); } finally { setLoading(false); }
  }

  const bulkInclude = async (include: boolean) => withProgress(async () => {
    const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
    if (ids.length === 0) return;
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, includeInQuiz: include } : r)));
    try {
      if (auth?.user) {
        for (const id of ids) {
          await setWordIncludeInQuiz(auth.user.uid, id, include);
        }
      } else {
        const db = getDatabase();
        for (const id of ids) await db.wordEntries.update(id, { includeInQuiz: include } as any);
      }
    } catch {}
  });

  const bulkDelete = async () => withProgress(async () => {
    const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}개 항목을 삭제할까요?`)) return;
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    try {
      if (auth?.user) {
        for (const id of ids) await deleteWord(auth.user.uid, id);
      } else {
        const db = getDatabase();
        for (const id of ids) { await db.wordEntries.delete(id); await db.reviewStates.delete(id); }
      }
    } catch {}
    setSelected({});
  });  const remove = async (id: string) => {
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
      <h2 style={{ margin: 0, fontWeight: 700 }}>단어장 관리</h2>  <div style={{ margin: '12px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input value={query} onInput={(e: any) => setQuery(e.currentTarget.value)} placeholder="검색: 단어/문맥" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(249,249,250,0.8)' }} />
      <select value={filter} onChange={(e: any) => setFilter(e.currentTarget.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}>
        <option value="all">전체</option>
        <option value="included">포함만</option>
        <option value="excluded">제외만</option>
      </select>
      <div style={{ marginLeft: 8 }}>
        <label style={{ marginRight: 10, fontSize: 13 }}>출제 모드</label>
        <label style={{ marginRight: 6 }}><input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> 전체</label>
        <label><input type='radio' name='mode' checked={mode === 'onlyIncluded'} onChange={() => saveMode('onlyIncluded')} /> 포함만</label>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
      <button onClick={() => setSelectionAll(true)} disabled={loading}>전체선택</button>
      <button onClick={() => setSelectionAll(false)} disabled={loading}>선택해제</button>
      <button onClick={() => bulkInclude(true)} disabled={loading}>퀴즈 포함</button>
      <button onClick={() => bulkInclude(false)} disabled={loading}>퀴즈 제외</button>
      <button onClick={bulkDelete} disabled={loading} style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px' }}>삭제</button>
    </div>
  </div>
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










