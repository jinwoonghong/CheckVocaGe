import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { AuthContext } from '../auth/firebase';
import {
  fetchUserWords,
  subscribeUserWords,
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
import { exportSnapshot } from '@core';
import { upsertSnapshotToFirestore } from '../db/firestore';

type WordRow = { id: string; word: string; context?: string; includeInQuiz?: boolean; tags?: string[] };

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
  const [removeTagInput, setRemoveTagInput] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!auth?.user) return;
      try { setFilters(await getSavedFilters(auth.user.uid)); } catch { /* ignore */ }
    })();
  }, [auth?.user]);

  useEffect(() => {
    if (!auth?.user) return;
    const off = subscribeUserWords(auth.user.uid, 500, (rs) => setRows(rs as WordRow[]));
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, [auth?.user]);

  useEffect(() => {
    (async () => {
      if (!auth?.user) return;
      try { const pref = await getQuizPreference(auth.user.uid); if (pref) setMode(pref); } catch { /* ignore */ }
      try { const cloud = (await fetchUserWords(auth.user.uid, 500)) as WordRow[]; setRows(cloud); } catch { /* ignore */ }
    })();
  }, [auth?.user]);

  const saveCurrentFilter = async () => {
    if (!auth?.user) return;
    const name = prompt('현재 조건을 어떤 이름으로 저장할까요?');
    if (!name) return;
    const item: SavedFilter = { id: `${Date.now()}`, name, query, filter, mode, createdAt: Date.now() };
    const next = [...filters.filter((f) => f.name !== name), item];
    setFilters(next);
    try { await setSavedFilters(auth.user.uid, next); } catch { /* ignore */ }
  };

  const applyFilter = (f: SavedFilter) => {
    setQuery(f.query);
    setFilter(f.filter);
    setMode(f.mode);
  };

  const applyTags = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
    if (ids.length === 0) return;
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? ({ ...r, tags: Array.from(new Set([...(r.tags ?? []), tag])) }) : r)));
    try { if (!auth?.user) return; for (const id of ids) await setWordTags(auth.user.uid, id, [tag]); } catch { /* ignore */ }
    setTagInput('');
  };

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
    () => filtered.filter((r) => (mode === 'onlyIncluded' ? r.includeInQuiz === true : r.includeInQuiz !== false)).length,
    [filtered, mode],
  );

  const toggle = async (id: string, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, includeInQuiz: value } : r)));
    try { if (!auth?.user) return; await setWordIncludeInQuiz(auth.user.uid, id, value); } catch { /* ignore */ }
  };

  const saveMode = async (m: QuizMode) => {
    setMode(m);
    try { if (auth?.user) await setQuizPreference(auth.user.uid, m); } catch { /* ignore */ }
  };

  const setSelectionAll = (checked: boolean) => {
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
    try { if (!auth?.user) return; for (const id of ids) await setWordIncludeInQuiz(auth.user.uid, id, include); } catch { /* ignore */ }
  });

  function toCsvCell(value: unknown): string {
    const s = String(value ?? '');
    const needs = /[",\n]/.test(s);
    const esc = s.replace(/"/g, '""');
    return needs ? `"${esc}"` : esc;
  }

  const exportCsv = () => {
    const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
    const target = rows.filter((r) => ids.includes(r.id));
    const header = ['word','context','tags','includeInQuiz'];
    const lines = [header.join(',')];
    for (const r of target) {
      lines.push([
        toCsvCell(r.word),
        toCsvCell(r.context ?? ''),
        toCsvCell((r.tags ?? []).join(' ')),
        toCsvCell(r.includeInQuiz !== false ? '1' : '0'),
      ].join(','));
    }
    const csv = lines.join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `words_export_${Date.now()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const remove = async (id: string) => {
    if (!confirm('이 단어를 삭제할까요?')) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try { if (!auth?.user) return; await deleteWord(auth.user.uid, id); } catch { /* ignore */ }
  };

  if (!auth?.user) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h2>로그인 필요</h2>
        <p>웹 버전에서 로그인 후 단어장을 확인하세요.</p>
        <button onClick={() => auth?.signInWithGoogle()}>Google 로그인</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2 style={{ margin: 0, fontWeight: 700 }}>단어장 관리</h2>
      <div style={{ margin: '12px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={query}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setQuery(e.currentTarget.value)}
            placeholder='검색: 단어/문장'
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(249,249,250,0.8)' }}
          />
          <select
            value={filter}
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement, Event>) => setFilter(e.currentTarget.value as typeof filter)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          >
            <option value='all'>전체</option>
            <option value='included'>포함</option>
            <option value='excluded'>제외</option>
          </select>
          <div style={{ marginLeft: 8 }}>
            <label style={{ marginRight: 10, fontSize: 13 }}>표시 모드</label>
            <label style={{ marginRight: 6 }}>
              <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> 전체
            </label>
            <label>
              <input type='radio' name='mode' checked={mode === 'onlyIncluded'} onChange={() => saveMode('onlyIncluded')} /> 포함만
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <input
            value={tagInput}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setTagInput(e.currentTarget.value)}
            placeholder='태그 추가'
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          />
          <button onClick={applyTags} disabled={loading}>태그 적용</button>
          <input
            value={removeTagInput}
            onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setRemoveTagInput(e.currentTarget.value)}
            placeholder='태그 제거'
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          />
          <button onClick={async () => {
            const tag = removeTagInput.trim();
            if (!tag) return;
            const ids = selectedIds.length ? selectedIds : filtered.map((r) => r.id);
            if (ids.length === 0) return;
            setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, tags: (r.tags ?? []).filter((t) => t !== tag) } : r)));
            try { if (!auth?.user) return; for (const id of ids) {
              const current = rows.find((x) => x.id === id)?.tags ?? [];
              const next = current.filter((t) => t !== tag);
              await setWordTags(auth.user.uid, id, next);
            } } catch { /* ignore */ }
            setRemoveTagInput('');
          }} disabled={loading}>태그 제거</button>
          <select
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement, Event>) => {
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
          <button onClick={() => setSelectionAll(false)} disabled={loading}>전체해제</button>
          <button onClick={() => bulkInclude(true)} disabled={loading}>포함 설정</button>
          <button onClick={() => bulkInclude(false)} disabled={loading}>제외 설정</button>
          <button onClick={exportCsv} className='secondary' disabled={loading}>CSV 내보내기</button>
          <button
            className="secondary"
            disabled={loading || selectedIds.length === 0}
            onClick={async () => {
              if (!auth?.user) return;
              const ids = selectedIds;
              if (ids.length === 0) return;
              if (!confirm(`${ids.length}개 항목을 삭제할까요?`)) return;
              await withProgress(async () => {
                setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
                try { await deleteWords(auth.user!.uid, ids); } catch { /* ignore */ }
                setSelected({});
              });
            }}
          >선택 삭제</button>
          <button
            className="secondary"
            disabled={loading || !auth?.user}
            onClick={async () => {
              if (!auth?.user) return;
              await withProgress(async () => {
                const snapshot = await exportSnapshot();
                await upsertSnapshotToFirestore(auth.user!.uid, snapshot as any);
                try { const cloud = (await fetchUserWords(auth.user!.uid, 500)) as WordRow[]; setRows(cloud); } catch { /* ignore */ }
              });
            }}
          >동기화(로컬→클라우드)</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>표시 기준</strong>
        <label>
          <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> 전체(포함/제외 모두 표시)
        </label>
        <label>
          <input type='radio' name='mode' checked={mode === 'onlyIncluded'} onChange={() => saveMode('onlyIncluded')} /> 포함 항목만(퀴즈)
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>현재 포함 수 {includedCount}개</span>
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
                  onChange={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setSelected((prev) => ({ ...prev, [r.id]: e.currentTarget.checked }))}
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
                  onChange={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => toggle(r.id, e.currentTarget.checked)}
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
