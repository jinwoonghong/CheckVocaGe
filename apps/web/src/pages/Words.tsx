import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { AuthContext } from '../auth/firebase';

import {
  fetchUserWords,
  setWordIncludeInQuiz,
  getQuizPreference,
  setQuizPreference,
  deleteWord,
  deleteWords,
  setWordTags,
  getSavedFilters,
  setSavedFilters,
  type SavedFilter,
  type QuizMode,
} from '../db/firestore';

type WordRow = { id: string; word: string; context?: string; includeInQuiz?: boolean };

export function WordsPage() {
  const auth = useContext(AuthContext);
  const [rows, setRows] = useState<WordRow[]>([]);
  const [mode, setMode] = useState<QuizMode>('all');
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'included' | 'excluded'>('all');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [tagInput, setTagInput] = useState<string>('');
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  useEffect(() => {
    (async () => {
      if (!auth?.user) return;
      try {
        setFilters(await getSavedFilters(auth.user.uid));
      } catch { /* ignore */ }
    })();
  }, [auth?.user?.uid]);

  // Refresh list when selection/snapshot is imported on /quiz (cloud only)
  useEffect(() => {
    const reload = async () => {
      if (!auth?.user) return;
      try {
        const cloud = (await fetchUserWords(auth.user.uid, 500)) as WordRow[];
        setRows(cloud);
      } catch { /* ignore */ }
    };
    const handler = () => { void reload(); };
    window.addEventListener('checkvoca:selection-imported', handler);
    window.addEventListener('checkvoca:snapshot-imported', handler);
    return () => {
      window.removeEventListener('checkvoca:selection-imported', handler);
      window.removeEventListener('checkvoca:snapshot-imported', handler);
    };
  }, [auth?.user?.uid]);
  

  const saveCurrentFilter = async () => {
    if (!auth?.user) return;
    const name = prompt('저장할 필터 이름');
    if (!name) return;
    const item: SavedFilter = {
      id: `${Date.now()}`,
      name,
      query,
      filter,
      mode,
      createdAt: Date.now(),
    };
    const next = [...filters.filter((f) => f.name !== name), item];
    setFilters(next);
    try {
      await setSavedFilters(auth.user.uid, next);
    } catch { /* ignore */ }
  };

  const applyFilter = (f: SavedFilter) => {
    setQuery(f.query);
    setFilter(f.filter as any);
    setMode(f.mode);
  };

  const applyTags = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? ({ ...r, tags: Array.from(new Set([...(r as any).tags ?? [], tag])) } as any)
          : r,
      ),
    );
    try {
      if (!auth?.user) return;
      for (const id of ids) await setWordTags(auth.user.uid, id, [tag]);
    } catch { /* ignore */ }
    setTagInput('');
  };

  useEffect(() => {
    (async () => {
      if (!auth?.user) return;
      try {
        const cloud = (await fetchUserWords(auth.user.uid, 500)) as WordRow[];
        setRows(cloud);
        const pref = await getQuizPreference(auth.user.uid);
        if (pref) setMode(pref);
      } catch { /* ignore */ }
    })();
  }, [auth?.user?.uid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'included' && r.includeInQuiz === false) return false;
      if (filter === 'excluded' && r.includeInQuiz !== false) return false;
      if (!q) return true;
      const hay = `${r.word} ${r.context ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, filter]);

  const includedCount = useMemo(
    () =>
      filtered.filter((r) => (mode === 'onlyIncluded' ? r.includeInQuiz === true : r.includeInQuiz !== false)).length,
    [filtered, mode],
  );

  const toggle = async (id: string, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, includeInQuiz: value } : r)));
    try {
      if (!auth?.user) return;
      await setWordIncludeInQuiz(auth.user.uid, id, value);
    } catch { /* ignore */ }
  };

  const saveMode = async (m: QuizMode) => {
    setMode(m);
    try {
      if (auth?.user) await setQuizPreference(auth.user.uid, m);
    } catch { /* ignore */ }
  };

  const setSelectionAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const r of filtered) next[r.id] = checked;
    setSelected(next);
  };

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  async function withProgress<T>(fn: () => Promise<T>) {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }

  const bulkInclude = async (include: boolean) =>
    withProgress(async () => {
      const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
      if (ids.length === 0) return;
      setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, includeInQuiz: include } : r)));
      try {
        if (!auth?.user) return;
        for (const id of ids) await setWordIncludeInQuiz(auth.user.uid, id, include);
      } catch { /* ignore */ }
    });

  const bulkDeleteSelected = async () =>
    withProgress(async () => {
      const ids = selectedIds;
      if (ids.length === 0) return;
      if (!confirm(`${ids.length}개 항목을 삭제할까요?`)) return;
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      try {
        if (!auth?.user) return;
        await deleteWords(auth.user.uid, ids);
      } catch { /* ignore */ }
      setSelected({});
    });

  const bulkDeleteFiltered = async () =>
    withProgress(async () => {
      const ids = filtered.map((r) => r.id);
      if (ids.length === 0) return;
      if (!confirm(`현재 필터의 ${ids.length}개 항목을 삭제할까요?`)) return;
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      try {
        if (!auth?.user) return;
        await deleteWords(auth.user.uid, ids);
      } catch { /* ignore */ }
      setSelected({});
    });

  const remove = async (id: string) => {
    if (!confirm('이 단어를 삭제할까요?')) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      if (!auth?.user) return;
      await deleteWord(auth.user.uid, id);
    } catch { /* ignore */ }
  };

  if (!auth?.user) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h2>로그인 필요</h2>
        <p>구글 계정으로 로그인 후 단어장을 확인하세요.</p>
        <button onClick={() => auth?.signInWithGoogle()}>Google 로그인</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2 style={{ margin: 0, fontWeight: 700 }}>단어장 관리</h2>
      <div
        style={{
          margin: '12px 0',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={query}
            onInput={(e: any) => setQuery(e.currentTarget.value)}
            placeholder='검색: 단어/문맥'
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'rgba(249,249,250,0.8)',
            }}
          />
          <select
            value={filter}
            onChange={(e: any) => setFilter(e.currentTarget.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          >
            <option value='all'>전체</option>
            <option value='included'>포함만</option>
            <option value='excluded'>제외만</option>
          </select>
          <div style={{ marginLeft: 8 }}>
            <label style={{ marginRight: 10, fontSize: 13 }}>표시 모드</label>
            <label style={{ marginRight: 6 }}>
              <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> ?꾩껜
            </label>
            <label>
              <input
                type='radio'
                name='mode'
                checked={mode === 'onlyIncluded'}
                onChange={() => saveMode('onlyIncluded')}
              />
              포함만
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <input
            value={tagInput}
            onInput={(e: any) => setTagInput(e.currentTarget.value)}
            placeholder='태그 추가'
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          />
          <button onClick={applyTags} disabled={loading}>태그 적용</button>
          <select
            onChange={(e: any) => {
              const f = filters.find((x) => x.id === e.currentTarget.value);
              if (f) applyFilter(f);
            }}
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          >
            <option value=''>저장된 필터</option>
            {filters.map((f) => (
              <option value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={saveCurrentFilter} disabled={!auth?.user}>현재 필터 저장</button>
          <button onClick={() => setSelectionAll(true)} disabled={loading}>전체선택</button>
          <button onClick={() => setSelectionAll(false)} disabled={loading}>선택해제</button>
          <button onClick={() => bulkInclude(true)} disabled={loading}>퀴즈 포함</button>
          <button onClick={() => bulkInclude(false)} disabled={loading}>퀴즈 제외</button>
          <button
            onClick={bulkDeleteSelected}
            disabled={loading || selectedIds.length === 0}
            style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px' }}
            title={'선택한 항목만 삭제합니다'}
          >삭제(선택 {selectedIds.length})</button>
          <button
            onClick={bulkDeleteFiltered}
            disabled={loading || filtered.length === 0}
            style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px' }}
            title={'현재 필터의 전체를 삭제합니다'}
          >삭제(필터 {filtered.length})</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>선택 항목이 없으면 현재 필터의 전체를 삭제합니다.</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>퀴즈 설정</strong>
        <label>
          <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> 전체(제외 표시/제외)
        </label>
        <label>
          <input
            type='radio'
            name='mode'
            checked={mode === 'onlyIncluded'}
            onChange={() => saveMode('onlyIncluded')}
          />
          포함 표시만(제외)
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>선택 포함수 {includedCount}개</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', width: 36 }}>선택</th>
            <th style={{ textAlign: 'left' }}>단어</th>
            <th style={{ textAlign: 'left' }}>문맥</th>
            <th>퀴즈 포함</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <input
                  type='checkbox'
                  checked={!!selected[r.id]}
                  onChange={(e: any) => setSelected((prev) => ({ ...prev, [r.id]: e.currentTarget.checked }))}
                />
              </td>
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
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <button onClick={() => remove(r.id)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a href='/quiz'>퀴즈로 이동</a>
      </div>
    </div>
  );
}



