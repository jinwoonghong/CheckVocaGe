/// <reference types="chrome" />

const input = document.getElementById('webBase') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function getStorage(): chrome.storage.StorageArea | undefined {
  // Prefer sync, fallback to local
  return chrome.storage?.sync ?? chrome.storage?.local;
}

function setStatus(text: string, ok = true) {
  statusEl.textContent = text;
  statusEl.style.color = ok ? '#10b981' : '#ef4444';
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.origin;
  } catch {
    return u.trim();
  }
}

async function load() {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.get({ webBaseUrl: '' }, (items) => {
      input.value = items.webBaseUrl ?? '';
    });
  } catch {
    setStatus('불러오기 실패', false);
  }
}

async function save() {
  try {
    const storage = getStorage();
    if (!storage) return;
    const value = normalizeUrl(input.value);
    storage.set({ webBaseUrl: value }, () => setStatus('저장 완료'));
  } catch {
    setStatus('저장 실패', false);
  }
}

saveBtn.addEventListener('click', save);
void load();
