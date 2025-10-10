import { useEffect, useMemo, useState, useContext, useRef } from "preact/hooks";
            <a href='/words'><button>단어장 관리</button></a>
import { fetchDueReviews, applySm2Review, getDatabase, exportSnapshot } from "@core";
import { AuthContext } from "../auth/firebase";
import { fetchUserWords, upsertSnapshotToFirestore, upsertReviewState } from "../db/firestore";

type WordEntry = {
  id: string;
  word: string;
  context?: string;
  definitions?: string[];
  phonetic?: string;
  audioUrl?: string;
};

const isKorean = (s: string) => /[\uAC00-\uD7A3]/.test(s);

const ENABLE_KO_DICT = (import.meta as any).env?.VITE_ENABLE_KO_DICT !== "0";

async function fetchFromKoDict(word: string): Promise<{ definitions: string[]; phonetic?: string; audioUrl?: string } | null> {
  if (!ENABLE_KO_DICT) return null;
  try {
    const res = await fetch(`/api/ko-dict?word=${encodeURIComponent(word)}`, { credentials: "omit" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.definitions)) return null;
    return { definitions: data.definitions, phonetic: data.phonetic };
  } catch { return null; }
}

async function fetchFromDictionaryApi(
  word: string
): Promise<{ definitions: string[]; phonetic?: string; audioUrl?: string } | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || !arr[0]) return null;
    const entry = arr[0];
    const phonetic: string | undefined = entry.phonetics?.find((p: any) => p?.text)?.text || entry.phonetic;
    const audioUrl: string | undefined = entry.phonetics?.find((p: any) => p?.audio)?.audio;
    const defs: string[] = [];
    for (const m of entry.meanings ?? []) {
      for (const d of m.definitions ?? []) {
        if (d?.definition) defs.push(String(d.definition));
      }
    }
    return { definitions: defs, phonetic, audioUrl };
  } catch {
    return null;
  }
}

function useBootstrapFromSnapshot(): void {
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    const hash = typeof location !== "undefined" ? location.hash : "";
    const m = hash.match(/snapshot=([^&]+)/);
    if (m) {
      try {
        const json = decodeURIComponent(m[1]);
        const data = JSON.parse(json);
        storePending(data);
      } catch { /* ignore */ }
    }

    // Also support extension handoff via postMessage
    function onMessage(ev: MessageEvent) {
      try {
        if (ev.source !== window) return;
        const d: any = ev.data;
        if (!d || d.type !== 'CHECKVOCA_SNAPSHOT' || !d.payload) return;
        storePending(d.payload);
      } catch { /* ignore */ }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
}

export function QuizPage() {
  const auth = useContext(AuthContext);
  useBootstrapFromSnapshot();
  const [words, setWords] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const didSyncRef = useRef(false);

  function showToast(message: string, durationMs = 2200) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), durationMs);
  }

  // Support sign-out via query param (?logout=1) for extension quick action
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    try {
      const q = typeof location !== 'undefined' ? location.search : '';
      if (q && new URLSearchParams(q).get('logout') === '1') {
        auth?.signOut?.().finally(() => {
          const clean = location.pathname + (location.hash || '');
          history.replaceState({}, '', clean);
        });
      }
    } catch {}
  }, [auth?.user]);

  // Handle action from extension: login gate → sync → action
  useEffect(() => {
    (async () => {
      const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
      const q = typeof location !== 'undefined' ? location.search : '';
      const params = new URLSearchParams(q);
      const action = params.get('action');
      if (!action) return;

      if (auth?.user === undefined) {
        // Auth state still loading; wait for next run
        return;
      }
      if (auth?.user === null) {
        try {
          await auth?.signInWithGoogle?.();
        } catch {
          // user canceled
        }
        return; // re-run on auth change
      }

      // Pre-sync local → cloud (best-effort)
      try {
        const snapshot = await exportSnapshot();
        await upsertSnapshotToFirestore(auth.user.uid, snapshot);
      } catch {}

      if (action === 'copyLink') {
        try {
          await navigator.clipboard.writeText(`${location.origin}/quiz`);
          showToast('퀴즈 링크를 복사했어요');
        } catch {}
      } else if (action === 'importSnapshot') {
        try {
          const raw = localStorage.getItem(PENDING_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            const mod = await import('@core');
            await mod.importSnapshot(data);
            localStorage.removeItem(PENDING_KEY);
            window.dispatchEvent(new CustomEvent('checkvoca:snapshot-imported'));
            showToast('단어장을 가져와 동기화했습니다');
          }
        } catch {}
      }

      // Clean query
      const clean = location.pathname + (location.hash || '');
      history.replaceState({}, '', clean);
    })();
  }, [auth?.user?.uid]);

  // Load words with merge: local(due->recent) + cloud(unique)
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    (async () => {
      const due = (await fetchDueReviews()) as WordEntry[];
      let local = due;
      if (!local.length) {
        const db = getDatabase();
        local = (await db.wordEntries.orderBy("createdAt").reverse().limit(50).toArray()) as WordEntry[];
      }
      let merged = local;
      if (auth?.user) {
        try {
          const cloudWords = (await fetchUserWords(auth.user.uid, 200)) as WordEntry[];
          const seen = new Set(local.map((w) => w.id));
          const append = cloudWords.filter((w) => !seen.has(w.id));
          merged = [...local, ...append];
        } catch {}
      }
      setWords(merged);
    })();
  }, [auth?.user?.uid]);

  // Reload list after snapshot import
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    const handler = () => {
      (async () => {
        const due = (await fetchDueReviews()) as WordEntry[];
        let local = due;
        if (!local.length) {
          const db = getDatabase();
          local = (await db.wordEntries.orderBy("createdAt").reverse().limit(50).toArray()) as WordEntry[];
        }
        let merged = local;
        if (auth?.user) {
          try {
            const cloudWords = (await fetchUserWords(auth.user.uid, 200)) as WordEntry[];
            const seen = new Set(local.map((w) => w.id));
            const append = cloudWords.filter((w) => !seen.has(w.id));
            merged = [...local, ...append];
          } catch {}
        }
        setWords(merged);
      })();
    };
      showToast("단어장을 가져와 동기화했어요");
    window.addEventListener('checkvoca:snapshot-imported', handler);
    return () => window.removeEventListener('checkvoca:snapshot-imported', handler);
  }, [auth?.user?.uid]);

  // Auto cloud sync once after login (best-effort)
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    (async () => {
      if (!auth?.user || didSyncRef.current) return;
      try {
        didSyncRef.current = true;
        const snapshot = await exportSnapshot();
        await upsertSnapshotToFirestore(auth.user.uid, snapshot);
        showToast("Cloud sync completed");
      } catch {
        showToast("Cloud sync failed", 2600);
      }
    })();
  }, [auth?.user?.uid]);
  // Best-effort enrichment for items without definitions
  useEffect(() => {
    const PENDING_KEY = 'CHECKVOCA_PENDING_SNAPSHOT';
    const storePending = (data: any) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(data)); } catch {} };
    (async () => {
      const need = words.filter((w) => !w.definitions || w.definitions.length === 0).slice(0, 10);
      if (!need.length) return;
      const updates: Record<string, Partial<WordEntry>> = {};
      await Promise.all(
        need.map(async (w) => {
          const r = (await fetchFromKoDict(w.word)) || (await fetchFromDictionaryApi(w.word));
          if (r && r.definitions.length) {
            const kr = r.definitions.filter((d) => isKorean(String(d)));
            if (kr.length) {
              updates[w.id] = { definitions: kr, phonetic: r.phonetic, audioUrl: r.audioUrl };
            }
          }
        })
      );
      if (Object.keys(updates).length) {
        setWords((prev) => prev.map((w) => ({ ...w, ...(updates[w.id] || {}) })));
      }
    })();
  }, [words]);

  const card = useMemo(() => words[index], [words, index]);
  const next = () => {
    setShowAnswer(false);
    setIndex((i) => (words.length ? (i + 1) % words.length : 0));
  };

  const grade = async (g: 2 | 4 | 5) => {
    try {
      if (card?.id) {
        const updated = await applySm2Review(card.id, g);
        if (auth?.user) await upsertReviewState(auth.user.uid, updated as any);
      }
    } catch {}
    next();
  };

  if (!auth?.user) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <h2>로그인 필요</h2>
        <p>구글 계정으로 로그인 후 퀴즈를 진행하세요.</p>
        <button onClick={() => auth?.signInWithGoogle()}>Google 로그인</button>
      </div>
    );
  }

  if (!words.length) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
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
      alert("클라우드 동기화 완료");
    } catch {
      alert("동기화 실패");
    }
  };

  const defs = (card?.definitions || []).filter((d) => isKorean(String(d)));
  const answer = defs.length ? (
    <ul style={{ paddingLeft: 16, margin: "6px 0" }}>
      {defs.map((d, i) => (
        <li key={i}>{d}</li>
      ))}
    </ul>
  ) : (
    card?.context || "정의가 없어 문맥을 표시합니다."
  );

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {toast && (

          <div

            style={{

              position: "fixed",

              top: 12,

              left: "50%",

              transform: "translateX(-50%)",

              background: "rgba(17,24,39,0.95)",

              color: "#e5e7eb",

              border: "1px solid rgba(255,255,255,0.12)",

              borderRadius: 8,

              padding: "8px 12px",

              zIndex: 1000,

              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",

              fontSize: 13,

            }}

          >

            {toast}

          </div>

        )}
          <strong>
            진행 {index + 1} / {words.length}
          </strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href='/words'><button>단어장 관리</button></a>
            <span style={{ fontSize: 13 }}>{auth.user?.displayName}</span>
            <button onClick={() => auth?.signOut()}>로그아웃</button>
            <button onClick={() => location.reload()}>새로고침</button>
            <button onClick={syncToCloud}>클라우드 동기화</button>
          </div>
        </div>
        <div style={{ background: "#111827", color: "#e5e7eb", padding: 16, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{card?.word}</div>
            {showAnswer && card?.phonetic && (
              <div style={{ color: "#9ca3af" }}>/ {card.phonetic} /</div>
            )}
            {showAnswer && (
              <button
                style={{
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: "#e5e7eb",
                }}
                disabled={!card?.audioUrl}
                onClick={() => {
                  if (card?.audioUrl) new Audio(card.audioUrl).play().catch(() => {});
                }}
                aria-label="발음 재생"
              >
                Play
              </button>
            )}
          </div>
          <div style={{ color: "#9ca3af", margin: "8px 0 12px" }}>{showAnswer ? answer : "정답 보기 눌러 확인"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAnswer((v) => !v)}>{showAnswer ? "숨기기" : "정답 보기"}</button>
            <button onClick={() => grade(2)}>Again</button>
            <button onClick={() => grade(4)}>Good</button>
            <button onClick={() => grade(5)}>Easy</button>
          </div>
        </div>
      </div>
    </div>
  );
}






// DUPLICATE REMOVED
