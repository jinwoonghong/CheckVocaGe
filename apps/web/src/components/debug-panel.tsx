import { useEffect, useMemo, useState } from 'preact/hooks';
import { getDatabase, subscribeCacheEvent, exportSnapshot } from '@core';

type WordRow = { id: string; word: string; context?: string; createdAt?: number };

interface DebugPanelProps {
  onClose?: () => void;
}

export function DebugPanel({ onClose }: DebugPanelProps) {
  const [rows, setRows] = useState<WordRow[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRecent() {
    setLoading(true);
    try {
      const db = getDatabase();
      const recent = (await db.wordEntries
        .orderBy('createdAt')
        .reverse()
        .limit(10)
        .toArray()) as WordRow[];
      setRows(recent);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecent().catch(() => void 0);
    const off = subscribeCacheEvent((ev) => {
      const msg = typeof ev?.type === 'string' ? ev.type : 'unknown';
      setLogs((prev) => [
        `${new Date().toLocaleTimeString()} - ${msg}`,
        ...prev,
      ].slice(0, 20));
    });
    return () => {
      try { off?.(); } catch { /* ignore */ }
    };
  }, []);

  const items = useMemo(() => rows, [rows]);

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, width: 360, maxHeight: '70vh',
      background: '#0b1220', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.35)', overflow: 'hidden', zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <strong style={{ fontSize: 14 }}>디버그 패널</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => loadRecent()} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e5e7eb' }} disabled={loading}>새로고침</button>
          <button onClick={async () => { try { const s = await exportSnapshot(); console.info('[CheckVoca] snapshot', s); } catch {} }} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e5e7eb' }}>스냅샷 로그</button>
          <button onClick={() => { try { window.dispatchEvent(new CustomEvent('checkvoca:selection-imported')); } catch {} }} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e5e7eb' }}>수동 재로딩</button>
          <button onClick={onClose} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e5e7eb' }}>닫기</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, padding: 10 }}>
        <div>
          <div style={{ fontSize: 13, marginBottom: 6, color: '#9ca3af' }}>최근 로컬 단어 10개</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 180, overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            {items.length === 0 && <li style={{ padding: 8, color: '#94a3b8' }}>{loading ? '로딩 중…' : '내역 없음'}</li>}
            {items.map((r) => (
              <li key={r.id} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontWeight: 600 }}>{r.word}</div>
                {r.context && <div style={{ fontSize: 12, color: '#94a3b8' }} title={r.id}>{r.context}</div>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 13, marginBottom: 6, color: '#9ca3af' }}>이벤트 로그</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            {logs.length === 0 && <li style={{ padding: 8, color: '#94a3b8' }}>로그 없음</li>}
            {logs.map((l, i) => (
              <li key={i} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

