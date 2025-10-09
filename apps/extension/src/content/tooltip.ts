import type { SelectionPayload } from '@core';
import {
  subscribe,
  SelectionUiState,
  setSaving,
  setSuccess,
  setError,
  resetState,
  updatePayload,
} from './state';

interface TooltipCallbacks {
  onSave: (payload: SelectionPayload) => Promise<void>;
  onFavoriteToggle?: (payload: SelectionPayload) => void;
}

export class SelectionTooltip {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private wordContainerEl: HTMLDivElement;
  private definitionEl: HTMLDivElement;
  private contextEl: HTMLDivElement;
  private saveButton: HTMLButtonElement;
  private cancelButton: HTMLButtonElement;
  private favoriteButton: HTMLButtonElement;
  private closeButton: HTMLButtonElement;
  private playButton: HTMLButtonElement;
  private phoneticEl: HTMLSpanElement;
  private messageEl: HTMLParagraphElement;
  private callbacks: TooltipCallbacks;
  private currentState?: SelectionUiState;
  private audio?: HTMLAudioElement;

  constructor(callbacks: TooltipCallbacks) {
    this.callbacks = callbacks;
    this.host = document.createElement('div');
    this.host.setAttribute('data-webvoca-tooltip', '');
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }
      .container {
        position: absolute;
        inset: 0;
        font-family: 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #f5f5f5;
        pointer-events: none;
      }
      .card {
        min-width: 240px;
        max-width: 360px;
        background: rgba(29, 31, 33, 0.97);
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        padding: 14px 18px;
        display: none;
        pointer-events: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
        position: relative;
      }
      .card[data-visible="true"] {
        display: block;
      }
      .word {
        font-weight: 700;
        margin-bottom: 6px;
      }
      .definition {
        font-size: 13px;
        margin-bottom: 8px;
      }
      .definition ul {
        margin: 6px 0;
        padding-left: 16px;
      }
      .definition li {
        margin: 2px 0;
        white-space: normal;
      }
      .definition.loading {
        color: #93a1ff;
      }
      .definition.error {
        color: #f87171;
      }
      .context {
        font-size: 12px;
        color: #cbd5f5;
        margin-bottom: 10px;
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      button {
        border: none;
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        background: #3745ff;
        color: white;
        transition: background 0.2s ease;
      }
      button[disabled] {
        opacity: 0.6;
        cursor: progress;
      }
      button.cancel {
        background: transparent;
        color: #d1d5db;
      }
      button.favorite {
        background: transparent;
        color: #fcd34d;
      }
      button.favorite[aria-pressed="true"] {
        color: #f59e0b;
      }
      .status {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.4;
      }
      .close-btn {
        position: absolute;
        top: 6px;
        right: 8px;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #a3a3a3;
        cursor: pointer;
      }
      .close-btn:hover { color: #fff }
      :host-context(body[data-theme="dark"]) .card {
        background: rgba(36, 39, 43, 0.98);
      }
    `;

    this.container = document.createElement('div');
    this.container.className = 'container';

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.visible = 'false';

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'close-btn';
    this.closeButton.setAttribute('aria-label', 'Close');
    this.closeButton.textContent = '✕';
    this.closeButton.addEventListener('click', () => {
      resetState();
    });

    this.wordContainerEl = document.createElement('div');
    this.wordContainerEl.className = 'word';
    const wordEl = document.createElement('span');
    wordEl.className = 'word-text';
    this.phoneticEl = document.createElement('span');
    this.phoneticEl.className = 'phonetic';
    this.phoneticEl.style.marginLeft = '8px';
    this.phoneticEl.style.color = '#9CA3AF';
    this.playButton = document.createElement('button');
    this.playButton.type = 'button';
    this.playButton.textContent = '▶';
    this.playButton.style.marginLeft = '8px';
    this.playButton.style.padding = '2px 6px';
    this.playButton.style.fontSize = '12px';
    this.playButton.addEventListener('click', () => this.handlePlay());
    this.wordContainerEl.append(wordEl, this.phoneticEl, this.playButton);

    this.definitionEl = document.createElement('div');
    this.definitionEl.className = 'definition';

    this.contextEl = document.createElement('div');
    this.contextEl.className = 'context';

    const actions = document.createElement('div');
    actions.className = 'actions';

    this.favoriteButton = document.createElement('button');
    this.favoriteButton.type = 'button';
    this.favoriteButton.className = 'favorite';
    this.favoriteButton.textContent = 'Off';
    this.favoriteButton.setAttribute('aria-pressed', 'false');
    this.favoriteButton.addEventListener('click', () => this.handleFavorite());

    this.cancelButton = document.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'cancel';
    this.cancelButton.textContent = 'Cancel';
    this.cancelButton.addEventListener('click', () => {
      resetState();
    });

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'save';
    this.saveButton.textContent = 'Save';
    this.saveButton.addEventListener('click', () => this.handleSave());

    actions.append(this.favoriteButton, this.cancelButton, this.saveButton);

    this.messageEl = document.createElement('p');
    this.messageEl.className = 'status';

    card.append(this.closeButton, this.wordContainerEl, this.definitionEl, this.contextEl, actions, this.messageEl);
    this.container.append(card);
    this.shadow.append(style, this.container);

    document.body.appendChild(this.host);

    subscribe((next) => this.render(next));

    // 바깥 클릭 시 닫기
    document.addEventListener('mousedown', (ev) => {
      const path = (ev.composedPath?.() as EventTarget[]) ?? [];
      const inside = path.includes(this.host) || this.host.contains(ev.target as Node);
      if (!inside) {
        resetState();
      }
    });
  }

  private get card(): HTMLDivElement {
    return this.shadow.querySelector('.card') as HTMLDivElement;
  }

  private get wordEl(): HTMLDivElement {
    return this.shadow.querySelector('.word-text') as HTMLDivElement;
  }

  private async handleSave(): Promise<void> {
    const state = this.currentState;
    if (!state?.payload || state.status === 'saving') return;
    setSaving();
    try {
      await this.callbacks.onSave(state.payload);
      setSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save word.';
      setError(message);
    }
  }

  private handleFavorite(): void {
    const state = this.currentState;
    if (!state?.payload) return;
    const toggled = { ...state.payload, isFavorite: !state.payload.isFavorite };
    this.callbacks.onFavoriteToggle?.(toggled);
    updatePayload(toggled);
  }

  private setPosition(position?: SelectionUiState['position']): void {
    const card = this.card;
    if (!position) {
      card.style.top = '-9999px';
      card.style.left = '-9999px';
      return;
    }
    const top = position.y + position.height + 12;
    const left = position.x;
    card.style.position = 'absolute';
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  private render(state: SelectionUiState): void {
    this.currentState = state;
    const card = this.card;
    card.dataset.visible = state.visible ? 'true' : 'false';
    if (!state.visible || !state.payload) {
      this.messageEl.textContent = '';
      return;
    }

    this.wordEl.textContent = state.payload.word;
    this.phoneticEl.textContent = state.phonetic ? `/${state.phonetic}/` : '';
    this.playButton.disabled = !state.audioUrl;

    // Clear previous content
    this.definitionEl.textContent = '';
    this.definitionEl.classList.remove('loading', 'error');
    if (state.isDefinitionLoading) {
      this.definitionEl.textContent = 'Loading definitions...';
      this.definitionEl.classList.add('loading');
    } else if (state.definitionError) {
      this.definitionEl.textContent = state.definitionError;
      this.definitionEl.classList.add('error');
    } else if (state.definitions.length) {
      const ul = document.createElement('ul');
      for (const def of state.definitions) {
        const li = document.createElement('li');
        li.textContent = def;
        ul.appendChild(li);
      }
      this.definitionEl.appendChild(ul);
    } else {
      this.definitionEl.textContent = 'No definition found.';
      this.definitionEl.classList.add('error');
    }

    // 컨텍스트는 한 문장만 표시하며 길면 줄임표 처리
    const ctx = state.payload.context || '';
    const maxLen = 180;
    this.contextEl.textContent = ctx.length > maxLen ? ctx.slice(0, maxLen - 1) + '…' : ctx;
    this.setPosition(state.position);

    this.saveButton.disabled = state.status === 'saving';
    this.messageEl.textContent = state.message ?? state.error ?? '';
    this.favoriteButton.setAttribute('aria-pressed', state.payload.isFavorite ? 'true' : 'false');
    this.favoriteButton.textContent = state.payload.isFavorite ? 'On' : 'Off';
  }

  private handlePlay(): void {
    const { audioUrl } = this.currentState ?? {};
    if (!audioUrl) return;
    try {
      if (!this.audio) this.audio = new Audio();
      this.audio.src = audioUrl;
      this.audio.play().catch(() => {});
    } catch {
      // ignore playback errors
      void 0;
    }
  }
}
