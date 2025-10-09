import type { SelectionPayload } from '@core';

export type SelectionStatus = 'idle' | 'ready' | 'saving' | 'success' | 'error';

export interface TooltipPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionUiState {
  status: SelectionStatus;
  visible: boolean;
  payload?: SelectionPayload;
  position?: TooltipPosition;
  message?: string;
  error?: string;
  definitions: string[];
  definitionError?: string;
  isDefinitionLoading: boolean;
  phonetic?: string;
  audioUrl?: string;
}

type Listener = (state: SelectionUiState) => void;

let state: SelectionUiState = {
  status: 'idle',
  visible: false,
  definitions: [],
  isDefinitionLoading: false,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function setState(update: Partial<SelectionUiState>): void {
  state = { ...state, ...update };
  notify();
}

export function updatePayload(payload: SelectionPayload): void {
  setState({ payload });
}

export function resetState(): void {
  state = {
    status: 'idle',
    visible: false,
    definitions: [],
    isDefinitionLoading: false,
    phonetic: undefined,
    audioUrl: undefined,
  };
  notify();
}

export function setReady(payload: SelectionPayload, rect: DOMRect | null): void {
  const position: TooltipPosition | undefined = rect
    ? { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height }
    : undefined;
  setState({
    status: 'ready',
    visible: true,
    payload,
    position,
    message: undefined,
    error: undefined,
    definitions: [],
    definitionError: undefined,
    isDefinitionLoading: true,
    phonetic: undefined,
    audioUrl: undefined,
  });
}

export function setDefinitions(definitions: string[]): void {
  setState({
    definitions,
    definitionError: undefined,
    isDefinitionLoading: false,
  });
}

export function setDefinitionError(message: string): void {
  setState({
    definitions: [],
    definitionError: message,
    isDefinitionLoading: false,
  });
}

export function setSaving(): void {
  setState({ status: 'saving', message: 'Saving...', error: undefined });
}

export function setSuccess(): void {
  setState({ status: 'success', message: 'Saved!', error: undefined });
  window.setTimeout(() => {
    resetState();
  }, 1500);
}

export function setError(message: string): void {
  setState({ status: 'error', error: message, message: undefined, visible: true });
}

export function setPhonetic(phonetic?: string): void {
  setState({ phonetic });
}

export function setAudioUrl(audioUrl?: string): void {
  setState({ audioUrl });
}
