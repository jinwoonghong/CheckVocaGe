/// <reference types="chrome" />
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getDatabase, exportSnapshot, subscribeCacheEvent } from '@core';

const ENV_BASE = (import.meta as ImportMeta & { env?: { VITE_WEB_BASE?: string } }).env?.VITE_WEB_BASE as
  | string
  | undefined;

type WordEntry = { id: string; word: string; context?: string };

function getStorage(): chrome.storage.StorageArea | undefined {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function extractFirstEnglishWord(input: string): string | null {
  const m = String(input || '').trim().match(/[A-Za-z][A-Za-z'\-]*/);
  return m ? m[0] : null;
}

function sendSearchToActiveTab(raw: string): void {
  const word = extractFirstEnglishWord(raw);
  if (!word) return;
  try {
    chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (typeof tabId !== 'number') return;
      const message = { type: 'CHECKVOCA_SEARCH_WORD', word } as const;
      let responded = false;
      try {
        chrome.tabs?.sendMessage?.(tabId, message, (resp?: { status?: string }) => {
          responded = true;
          if (chrome.runtime.lastError || resp?.status !== 'ok') {
            try {
              chrome.scripting?.executeScript?.(
                { target: { tabId }, files: ['content.js'] },
                () => { try { chrome.tabs?.sendMessage?.(tabId, message, () => void 0); } catch {} },
              );
            } catch {}
          }
        });
      } catch {
        try {
          chrome.scripting?.executeScript?.(
            { target: { tabId }, files: ['content.js'] },
            () => { try { chrome.tabs?.sendMessage?.(tabId, message, () => void 0); } catch {} },
          );
        } catch {}
      }
      setTimeout(() => {
        if (!responded) {
          try {
            chrome.scripting?.executeScript?.(
              { target: { tabId }, files: ['content.js'] },
              () => { try { chrome.tabs?.sendMessage?.(tabId, message, () => void 0); } catch {} },
            );
          } catch {}
        }
      }, 250);
    });
  } catch {}
}

type LookupResult = { definitions: string[]; phonetic?: string; audioUrl?: string };

async function lookupInBackground(word: string): Promise<LookupResult> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime?.sendMessage?.({ type: 'CHECKVOCA_LOOKUP', word }, (resp?: any) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!resp || resp.status === 'error') {
          reject(new Error(resp?.message || 'Lookup failed'));
          return;
        }
        resolve({ definitions: resp.definitions || [], phonetic: resp.phonetic, audioUrl: resp.audioUrl });
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Lookup failed'));
    }
  });
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
  chrome.runtime.sendMessage(
    { type: 'CHECKVOCA_EXPORT_CSV' },
    (response?: { status?: string; message?: string }) => {
      if (chrome.runtime.lastError) {
        console.error('CSV export failed:', chrome.runtime.lastError.message);
        return;
      }
      if (response?.status === 'error') {
        console.error('CSV export failed:', response.message);
      }
    },
  );
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
  } catch (err) {
    console.debug('[WebVoca] Failed to send snapshot to web:', err);
  }
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
  const [query, setQuery] = useState<string>('');
  const [defs, setDefs] = useState<string[]>([]);
  const [phonetic, setPhonetic] = useState<string | undefined>();
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [lastSavedWord, setLastSavedWord] = useState<string | undefined>();

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const db = getDatabase();
        const rows = (await db.wordEntries
          .orderBy('createdAt')
          .reverse()
          .limit(300)
          .toArray()) as any[];
        rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        setWords(rows.slice(0, 20) as WordEntry[]);
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
      <div style="margin:8px 0 12px; display:grid; grid-template-columns:1fr auto; gap:8px;">
        <input
          type="text"
          placeholder="영어단어 입력"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const word = extractFirstEnglishWord(query);
              if (!word) return;
              setLoading(true); setError(undefined); setDefs([]); setPhonetic(undefined); setAudioUrl(undefined);
              lookupInBackground(word)
                .then((r) => { setDefs(r.definitions || []); setPhonetic(r.phonetic); setAudioUrl(r.audioUrl); })
                .catch(() => setError('정의를 불러오지 못했습니다.'))
                .finally(() => setLoading(false));
            }
          }}
          style="box-sizing:border-box; width:100%; padding:8px 10px; border-radius:8px; border:1px solid #374151; background:#0b1220; color:#e5e7eb;"
        />
        <button onClick={() => {
          const word = extractFirstEnglishWord(query);
          if (!word) return;
          setLoading(true); setError(undefined); setDefs([]); setPhonetic(undefined); setAudioUrl(undefined);
          lookupInBackground(word)
            .then((r) => { setDefs(r.definitions || []); setPhonetic(r.phonetic); setAudioUrl(r.audioUrl); })
            .catch(() => setError('정의를 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
        }}>단어검색</button>
      </div>
      {(defs.length > 0 || phonetic || audioUrl) && (
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <button class="secondary" onClick={async () => {
            const word = extractFirstEnglishWord(query);
            if (!word) return;
            setLastSavedWord(undefined);
            // 1) Save locally via background (extension DB)
            try {
              const payload: any = {
                word,
                context: '',
                url: 'chrome-extension://popup',
                selectionRange: { startContainerPath: 'body[0]', startOffset: 0, endContainerPath: 'body[0]', endOffset: 0 },
                timestamp: Date.now(),
                clientMeta: { title: 'Popup', language: navigator.language },
                definitions: defs,
                phonetic,
                audioUrl,
              };
              await new Promise<void>((resolve, reject) => {
                chrome.runtime?.sendMessage?.({ type: 'CHECKVOCA_SELECTION', payload }, (resp?: any) => {
                  if (chrome.runtime.lastError || resp?.status === 'error') reject(new Error(chrome.runtime.lastError?.message || resp?.message || 'save failed'));
                  else resolve();
                });
              });
              setLastSavedWord(word);
            } catch {}
            // 2) Hand off to web to appear on words page (merge shows local as well)
            try {
              const key = `CHECKVOCA_SELECTION_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              await new Promise<void>((resolve) => {
                try { chrome.storage?.local?.set({ [key]: { word, context: '', url: location.origin, selectionRange: { startContainerPath: 'body[0]', startOffset: 0, endContainerPath: 'body[0]', endOffset: 0 }, timestamp: Date.now(), clientMeta: { title: document.title, language: navigator.language }, definitions: defs, phonetic, audioUrl } }, () => resolve()); } catch { resolve(); }
              });
              const base = await getWebBaseUrl();
              chrome.tabs?.create?.({ url: `${base}/quiz?action=importSelection&selectionKey=${encodeURIComponent(key)}` });
            } catch {}
          }}>단어 저장</button>
          {lastSavedWord && <small style="color:#9ca3af; align-self:center;">저장됨: {lastSavedWord}</small>}
        </div>
      )}
      {(loading || error || defs.length > 0) && (
        <div style="margin: 10px 0 14px; padding:12px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; background:#0b1220;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <strong style="font-size:14px;">검색 결과</strong>
            {phonetic && <span style="color:#9ca3af;">/{phonetic}/</span>}
            <button
              style="margin-left:auto; padding:4px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:transparent; color:#e5e7eb;"
              disabled={!audioUrl}
              onClick={() => { if (audioUrl) new Audio(audioUrl).play().catch(() => {}); }}
            >발음</button>
          </div>
          {loading && <div style="color:#93a1ff;">불러오는 중...</div>}
          {error && <div style="color:#f87171;">{error}</div>}
          {!loading && !error && defs.length > 0 && (
            <ul style="margin:6px 0; padding-left:16px;">
              {defs.map((d, i) => (<li key={i}>{d}</li>))}
            </ul>
          )}
          {!loading && !error && defs.length === 0 && (
            <div style="color:#f87171;">정의를 찾지 못했습니다.</div>
          )}
        </div>
      )}
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
        <button
          class="secondary"
          onClick={() => {
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
          }}
        >
          CSV 다운로드
        </button>
        <small>단어장(IndexedDB) 기반 기능</small>
        {adLeft > 0 && (
          <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);">
            <div style="background:#111827;color:#e5e7eb;padding:16px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);text-align:center;">
              <div style="margin-bottom:8px;font-weight:600;">광고 요청 중...</div>
              <div style="font-size:13px;">{adLeft}초 후 다운로드 시작</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root')!);
