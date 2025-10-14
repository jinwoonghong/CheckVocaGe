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
    const name = prompt('������ ���� �̸�');
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
      if (!confirm(`${ids.length}�� �׸��� �����ұ��?`)) return;
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
      if (!confirm(`���� ������ ${ids.length}�� �׸��� �����ұ��?`)) return;
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      try {
        if (!auth?.user) return;
        await deleteWords(auth.user.uid, ids);
      } catch { /* ignore */ }
      setSelected({});
    });

  const remove = async (id: string) => {
    if (!confirm('�� �ܾ �����ұ��?')) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    try {
      if (!auth?.user) return;
      await deleteWord(auth.user.uid, id);
    } catch { /* ignore */ }
  };

  if (!auth?.user) {
    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h2>�α��� �ʿ�</h2>
        <p>���� �������� �α��� �� �ܾ����� Ȯ���ϼ���.</p>
        <button onClick={() => auth?.signInWithGoogle()}>Google �α���</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2 style={{ margin: 0, fontWeight: 700 }}>�ܾ��� ����</h2>
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
            placeholder='�˻�: �ܾ�/����'
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
            <option value='all'>��ü</option>
            <option value='included'>���Ը�</option>
            <option value='excluded'>���ܸ�</option>
          </select>
          <div style={{ marginLeft: 8 }}>
            <label style={{ marginRight: 10, fontSize: 13 }}>ǥ�� ���</label>
            <label style={{ marginRight: 6 }}>
              <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> ?�체
            </label>
            <label>
              <input
                type='radio'
                name='mode'
                checked={mode === 'onlyIncluded'}
                onChange={() => saveMode('onlyIncluded')}
              />
              ���Ը�
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <input
            value={tagInput}
            onInput={(e: any) => setTagInput(e.currentTarget.value)}
            placeholder='�±� �߰�'
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          />
          <button onClick={applyTags} disabled={loading}>�±� ����</button>
          <select
            onChange={(e: any) => {
              const f = filters.find((x) => x.id === e.currentTarget.value);
              if (f) applyFilter(f);
            }}
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
          >
            <option value=''>����� ����</option>
            {filters.map((f) => (
              <option value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={saveCurrentFilter} disabled={!auth?.user}>���� ���� ����</button>
          <button onClick={() => setSelectionAll(true)} disabled={loading}>��ü����</button>
          <button onClick={() => setSelectionAll(false)} disabled={loading}>��������</button>
          <button onClick={() => bulkInclude(true)} disabled={loading}>���� ����</button>
          <button onClick={() => bulkInclude(false)} disabled={loading}>���� ����</button>
          <button
            onClick={bulkDeleteSelected}
            disabled={loading || selectedIds.length === 0}
            style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px' }}
            title={'������ �׸� �����մϴ�'}
          >����(���� {selectedIds.length})</button>
          <button
            onClick={bulkDeleteFiltered}
            disabled={loading || filtered.length === 0}
            style={{ background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px' }}
            title={'���� ������ ��ü�� �����մϴ�'}
          >����(���� {filtered.length})</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>���� �׸��� ������ ���� ������ ��ü�� �����մϴ�.</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>���� ����</strong>
        <label>
          <input type='radio' name='mode' checked={mode === 'all'} onChange={() => saveMode('all')} /> ��ü(���� ǥ��/����)
        </label>
        <label>
          <input
            type='radio'
            name='mode'
            checked={mode === 'onlyIncluded'}
            onChange={() => saveMode('onlyIncluded')}
          />
          ���� ǥ�ø�(����)
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>���� ���Լ� {includedCount}��</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', width: 36 }}>����</th>
            <th style={{ textAlign: 'left' }}>�ܾ�</th>
            <th style={{ textAlign: 'left' }}>����</th>
            <th>���� ����</th>
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
                <button onClick={() => remove(r.id)}>����</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a href='/quiz'>����� �̵�</a>
      </div>
    </div>
  );
}



