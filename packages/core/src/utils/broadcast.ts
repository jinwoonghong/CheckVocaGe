export type CacheEvent =
  | { type: 'word:updated'; id: string }
  | { type: 'word:created'; id: string }
  | { type: 'word:deleted'; id: string }
  | { type: 'pending:queued' }
  | { type: 'pending:drained' };

const CHANNEL_NAME = 'checkvoca-cache';
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function publishCacheEvent(event: CacheEvent): void {
  const bc = getChannel();
  if (!bc) return;
  bc.postMessage(event);
}

export function subscribeCacheEvent(listener: (event: CacheEvent) => void): () => void {
  const bc = getChannel();
  if (!bc) {
    return () => undefined;
  }
  const handler = (event: MessageEvent<CacheEvent>) => {
    if (event.data) {
      listener(event.data);
    }
  };
  bc.addEventListener('message', handler as EventListener);
  return () => {
    bc.removeEventListener('message', handler as EventListener);
  };
}
