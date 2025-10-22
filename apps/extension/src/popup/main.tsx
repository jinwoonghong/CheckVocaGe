/// <reference types="chrome" />
import { render } from 'preact';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getDatabase, exportSnapshot, subscribeCacheEvent } from '@core';

const ENV_BASE = (import.meta as ImportMeta & { env?: { VITE_WEB_BASE?: string } }).env?.VITE_WEB_BASE as
  | string
  | undefined;

type WordEntry = { id: string; word: string; context?: string };
type ActivationModifier = 'any'|'ctrl'|'alt'|'shift'|'ctrl_shift'|'alt_shift';

function getStorage(): chrome.storage.StorageArea | undefined {
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function extractFirstEnglishWord(input: string): string | null {
  const m = String(input || '').trim().match(/[A-Za-z][A-Za-z'-]*/);
  return m ? m[0] : null;
}

type LookupResult = { definitions: string[]; phonetic?: string; audioUrl?: string };

type BgLookupResponse = { status?: 'ok' | 'error'; message?: string; definitions?: string[]; phonetic?: string; audioUrl?: string };
async function lookupInBackground(word: string): Promise<LookupResult> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime?.sendMessage?.({ type: 'CHECKVOCA_LOOKUP', word }, (resp?: BgLookupResponse) => {
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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [activation, setActivation] = useState<ActivationModifier>('any');
  const [webEmail, setWebEmail] = useState<string | undefined>();
  const [webUid, setWebUid] = useState<string | undefined>();
  const [webBaseUrlInput, setWebBaseUrlInput] = useState<string>('');
  const [webBaseUrlError, setWebBaseUrlError] = useState<string | undefined>();

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const db = getDatabase();
        const rows = (await db.wordEntries
          .orderBy('createdAt')
          .reverse()
          .limit(300)
          .toArray()) as Array<{ id: string; word: string; context?: string; updatedAt?: number }>;
        rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
        const filtered = rows.filter((r) => /^[A-Za-z]/.test(String((r as { word?: string })?.word || '')));
        setWords(filtered.slice(0, 5) as WordEntry[]);
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

  // Observe web auth status
  useEffect(() => {
    try {
      chrome.storage?.local?.get?.({ webAuthStatus: false, webAuthEmail: '', webAuthUid: '' }, (items) => {
        setIsLoggedIn(Boolean(items?.webAuthStatus));
        const email = String(items?.webAuthEmail || '').trim();
        const uid = String(items?.webAuthUid || '').trim();
        setWebEmail(email || undefined);
        setWebUid(uid || undefined);
      });
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area !== 'local') return;
        if (Object.prototype.hasOwnProperty.call(changes, 'webAuthStatus')) {
          setIsLoggedIn(Boolean(changes.webAuthStatus.newValue));
        }
        if (Object.prototype.hasOwnProperty.call(changes, 'webAuthEmail')) {
          const v = String(changes.webAuthEmail.newValue || '').trim();
          setWebEmail(v || undefined);
        }
        if (Object.prototype.hasOwnProperty.call(changes, 'webAuthUid')) {
          const v = String(changes.webAuthUid.newValue || '').trim();
          setWebUid(v || undefined);
        }
      };
      chrome.storage?.onChanged?.addListener(listener);
      return () => chrome.storage?.onChanged?.removeListener?.(listener);
    } catch {
      return () => undefined;
    }
  }, []);

  // Load current activation modifier for inline settings
  useEffect(() => {
    try {
      const storage = getStorage();
      storage?.get?.({ activationModifier: 'any' }, (items) => {
        const v = String(items?.activationModifier || 'any');
        if (['any','ctrl','alt','shift','ctrl_shift','alt_shift'].includes(v)) {
          setActivation(v as typeof activation);
        }
      });
    } catch { /* ignore */ }
  }, []);

  function saveSettings() {
    try {
      const storage = getStorage();
      storage?.set?.({ activationModifier: activation }, () => void 0);
    } catch { /* ignore */ }
  }

  // Load current Web Base URL into settings input
  useEffect(() => {
    (async () => {
      try {
        const storage = getStorage();
        storage?.get?.({ webBaseUrl: '' }, (items) => {
          const v = String(items?.webBaseUrl || '').trim();
          setWebBaseUrlInput(v || ENV_BASE || 'http://localhost:5173');
        });
      } catch {
        setWebBaseUrlInput(ENV_BASE || 'http://localhost:5173');
      }
    })();
  }, []);

  function validateAndSaveWebBaseUrl() {
    const raw = String(webBaseUrlInput || '').trim();
    setWebBaseUrlError(undefined);
    if (!raw) {
      setWebBaseUrlError('빈 URL 입니다.');
      return;
    }
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        setWebBaseUrlError('http(s) URL 만 지원합니다.');
        return;
      }
      const storage = getStorage();
      storage?.set?.({ webBaseUrl: u.toString() }, () => void 0);
    } catch {
      setWebBaseUrlError('유효한 URL 이 아닙니다.');
    }
  }

  return (
    <div class="wrap" style="padding:10px; width:320px; color:#e5e7eb; background:#0b1220;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <h1 style={{ margin: 0, fontSize: 16 }}>WebVoca</h1>
        <button
          class="secondary"
          style="background:#374151;"
          onClick={() => setShowSettings((v) => !v)}
        >환경설정</button>
      </div>
      {showSettings && (
        <div style="margin:8px 0 12px; padding:12px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; background:#0b1220; color:#e5e7eb;">
          <div style="display:flex; gap:8px; align-items:center;">
            <label for="activation" style="font-size:13px; color:#9ca3af; min-width:120px;">단어 툴팁 활성화 키</label>
            <select
              id="activation"
              value={activation}
              onChange={(e: JSX.TargetedEvent<HTMLSelectElement, Event>) => setActivation(e.currentTarget.value as ActivationModifier)}
              style="flex:1; height:36px; padding:6px 8px; border-radius:8px; background:#0b1220; color:#e5e7eb; border:1px solid rgba(255,255,255,0.15);"
            >
              <option value="any">항상(기본)</option>
              <option value="ctrl">Ctrl 누른 상태</option>
              <option value="alt">Alt 누른 상태</option>
              <option value="shift">Shift 누른 상태</option>
              <option value="ctrl_shift">Ctrl + Shift</option>
              <option value="alt_shift">Alt + Shift</option>
            </select>
            <button
              class="secondary"
              onClick={saveSettings}
              style="white-space:nowrap; min-width:64px; height:36px; padding:6px 10px; border-radius:8px;"
            >
              저장
            </button>
          </div>
          <div style="display:flex; gap:8px; align-items:center; margin-top:10px;">
            <label for="webBaseUrl" style="font-size:13px; color:#9ca3af; min-width:120px;">Web Base URL</label>
            <input
              id="webBaseUrl"
              type="text"
              value={webBaseUrlInput}
              onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setWebBaseUrlInput(e.currentTarget.value)}
              placeholder="https://checkvocage.web.app"
              style="flex:1; height:36px; padding:6px 8px; border-radius:8px; background:#0b1220; color:#e5e7eb; border:1px solid rgba(255,255,255,0.15);"
            />
            <button
              class="secondary"
              onClick={validateAndSaveWebBaseUrl}
              style="white-space:nowrap; min-width:64px; height:36px; padding:6px 10px; border-radius:8px;"
            >저장</button>
            <button
              class="secondary"
              onClick={async () => { const base = await getWebBaseUrl(); chrome.tabs?.create?.({ url: base }); }}
              style="white-space:nowrap; min-width:64px; height:36px; padding:6px 10px; border-radius:8px;"
            >열기</button>
          </div>
          {webBaseUrlError && (
            <div style="margin-top:6px; font-size:12px; color:#f87171;">{webBaseUrlError}</div>
          )}
        </div>
      )}

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
                .catch(() => setError('정의를 가져오지 못했습니다.'))
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
            .catch(() => setError('정의를 가져오지 못했습니다.'))
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
              const payload: {
                word: string; context: string; url: string; selectionRange: { startContainerPath: string; startOffset: number; endContainerPath: string; endOffset: number };
                timestamp: number; clientMeta: { title: string; language: string };
                definitions: string[]; phonetic?: string; audioUrl?: string;
              } = {
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
                chrome.runtime?.sendMessage?.({ type: 'CHECKVOCA_SELECTION', payload }, (resp?: { status?: string; message?: string }) => {
                  if (chrome.runtime.lastError || resp?.status === 'error') reject(new Error(chrome.runtime.lastError?.message || resp?.message || 'save failed'));
                  else resolve();
                });
              });
              setLastSavedWord(word);
            } catch { /* ignore */ }
            // 2) Optional handoff to web
            try {
              const key = `CHECKVOCA_SELECTION_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              await new Promise<void>((resolve) => {
                try { chrome.storage?.local?.set({ [key]: { word, context: '', url: location.origin, selectionRange: { startContainerPath: 'body[0]', startOffset: 0, endContainerPath: 'body[0]', endOffset: 0 }, timestamp: Date.now(), clientMeta: { title: document.title, language: navigator.language }, definitions: defs, phonetic, audioUrl } }, () => resolve()); } catch { resolve(); }
              });
              try { chrome.storage?.local?.set({ CHECKVOCA_PENDING_SELECTION_KEY: key }, () => void 0); } catch { /* ignore */ }
              const base = await getWebBaseUrl();
              if (isLoggedIn) {
                chrome.tabs?.create?.({ url: `${base}/quiz?action=importSelection&selectionKey=${encodeURIComponent(key)}` });
              }
            } catch { /* ignore */ }
          }}>단어 저장</button>
          {lastSavedWord && <small style="color:#9ca3af; align-self:center;">마지막: {lastSavedWord}</small>}
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
            >재생</button>
          </div>
          {loading && <div style="color:#93a1ff;">로딩 중...</div>}
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

      <div class="auth" style="display:flex; gap:8px; margin: 6px 0 10px; align-items:center;">
        {isLoggedIn ? (
          <>
            <span style="font-size:13px; color:#9ca3af;">{webEmail || (webUid ? `UID:${webUid.slice(0,6)}…` : '로그인됨')}</span>
            <button class="secondary" onClick={async () => { const base = await getWebBaseUrl(); chrome.tabs?.create?.({ url: `${base}/quiz?logout=1` }); }}>로그아웃</button>
          </>
        ) : (
          <button class="secondary" onClick={async () => { const base = await getWebBaseUrl(); chrome.tabs?.create?.({ url: `${base}/quiz` }); }}>로그인하기</button>
        )}
      </div>

      <div style="margin: 0 0 8px;">
        <button class="secondary" onClick={async () => { const base = await getWebBaseUrl(); chrome.tabs?.create?.({ url: `${base}/words` }); }}>단어장 관리</button>
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
