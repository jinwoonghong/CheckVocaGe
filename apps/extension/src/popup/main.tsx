/// <reference types="chrome" />
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getDatabase, exportSnapshot, subscribeCacheEvent } from '@core';

const ENV_BASE = (import.meta as any).env?.VITE_WEB_BASE as string | undefined;

type WordEntry = { id: string; word: string; context?: string };

function getStorage(): chrome.storage.StorageArea | undefined {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function isEnglishWord(s: string | undefined | null): boolean {
  if (!s) return false;
  const word = String(s).trim();
  if (word.length === 0 || word.length > 50) return false;
  return /^[A-Za-z](?:[A-Za-z'\-]*[A-Za-z])?$/.test(word);
}

async function getWebBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const storage = getStorage();
      storage?.get({ webBaseUrl: '' }, (items) => {
        const v = String(items?.webBaseUrl || '').trim();
        resolve(v || ENV_BASE || 'http://localhost:5173');
      });
    } catch {
      resolve(ENV_BASE || 'http://localhost:5173');
    }
  });
}

async function openQuiz(): Promise<void> {
  const webBase = await getWebBaseUrl();
  chrome.tabs?.create?.({ url: `${webBase}/quiz?action=open` });
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

async function copyLink(): Promise<void> {
  const webBase = await getWebBaseUrl();
  chrome.tabs?.create?.({ url: `${webBase}/quiz?action=copyLink` });
}

async function sendSnapshotToWeb(): Promise<void> {
  try {
    const snapshot = await exportSnapshot();
    const key = `CHECKVOCA_SNAPSHOT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await new Promise<void>((resolve) => {
      try {
        chrome.storage?.local?.set({ [key]: snapshot }, () => resolve());
      } catch {
        resolve();
      }
    });
    const webBase = await getWebBaseUrl();
    const url = `${webBase}/quiz?action=importSnapshot&snapshotKey=${encodeURIComponent(key)}`;
    chrome.tabs?.create?.({ url });
  } catch {}
}

async function openLogin(): Promise<void> {
  const webBase = await getWebBaseUrl();
  chrome.tabs?.create?.({ url: `${webBase}/quiz` });
}

async function openLogout(): Promise<void> {
  const webBase = await getWebBaseUrl();
  chrome.tabs?.create?.({ url: `${webBase}/quiz?logout=1` });
}

function App() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [adLeft, setAdLeft] = useState<number>(0);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const db = getDatabase();
        const rows = (await db.wordEntries.orderBy('createdAt').reverse().limit(300).toArray()) as any[];
        rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        const filtered = rows.filter((r) => isEnglishWord(r?.word));
        setWords(filtered.slice(0, 20) as WordEntry[]);
      } catch {
        setWords([]);
      }
    };
    loadRecent();
    const off = subscribeCacheEvent((ev) => {
      if (ev.type === 'word:updated' || ev.type === 'word:created' || ev.type === 'word:deleted') {
        loadRecent();
      }
    });
    return () => off();
  }, []);

  return (
    <div class="wrap">
      <h1>WebVoca</h1>
      <div class="auth" style="display:flex; gap:8px; margin: 6px 0 10px;">
        <button class="secondary" onClick={openLogin}>로그인(모바일웹)</button>
        <button class="secondary" onClick={openLogout}>로그아웃(모바일웹)</button>
      </div>
      <div style="margin-bottom:10px;">
        <small>최근 조회 단어</small>
        <ul style="maxHeight:180px;overflow:auto;margin:6px 0;padding-left:16px;">
          {words.length === 0 && <li>표시할 단어가 없습니다.</li>}
          {words.map((w) => (
            <li key={w.id} title={w.context}>{w.word}</li>
          ))}
        </ul>
      </div>
      <div class="actions" style="display:grid;gap:8px;">
        <button onClick={openQuiz}>퀴즈 시작(모바일웹)</button>
        <button class="secondary" onClick={copyLink}>퀴즈 링크 복사</button>
        <button class="secondary" onClick={sendSnapshotToWeb}>모바일로 보내기(스냅샷)</button>
        <button class="secondary" onClick={() => {
          if (adLeft > 0) return;
          setAdLeft(5);
          const id = setInterval(() => {
            setAdLeft((n) => {
              if (n <= 1) {
                clearInterval(id);
                setTimeout(() => downloadCsv(), 100);
                return 0;
              }
              return n - 1;
            });
            return undefined as any;
          }, 1000);
        }}>CSV 다운로드</button>
        <small>단어장(IndexedDB) 기반 기능</small>
        {adLeft > 0 && (
          <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);">
            <div style="background:#111827;color:#e5e7eb;padding:16px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);text-align:center;">
              <div style="margin-bottom:8px;font-weight:600;">광고 시청 중...</div>
              <div style="font-size:13px;">{adLeft}초 후 다운로드 시작</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);

