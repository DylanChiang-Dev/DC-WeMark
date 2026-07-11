// 應用入口：載入 wasm，串起編輯器、預覽、複製、主題、草稿。

import { copyHtml } from './clipboard.js';
import { createTextareaEditor } from './editor.js';
import { initEngine, listThemes, render, type RenderOptions } from './engine.js';
import { SAMPLE_MARKDOWN } from './sample.js';
import { renderThemeSwitcher } from './themes.js';
import {
  clearDraft,
  debouncedSaveDraft,
  loadDraft,
  loadTheme,
  saveTheme,
} from './storage.js';
import { countWords, debounce, downloadText } from './util.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const editorEl = $<HTMLTextAreaElement>('editor');
const previewEl = $('preview');
const phoneEl = $('phone');
const themesEl = $('themes');
const statusEl = $('status');
const wordcountEl = $('wordcount');
const toastEl = $('toast');
const fileInput = $<HTMLInputElement>('fileInput');
const appEl = document.querySelector<HTMLElement>('.app')!;

let currentTheme = loadTheme() ?? 'default';
let currentAccent = ''; // 空 = 用主題預設
let lastHtml = '';
const themeAccents = new Map<string, string>();

const editor = createTextareaEditor(editorEl);
const persistDraft = debouncedSaveDraft(1000);

function renderPreview(): void {
  const md = editor.getValue();
  const opts: RenderOptions = { externalFootnotes: true, accent: currentAccent };
  try {
    const result = render(md, currentTheme, opts);
    lastHtml = result.html;
    previewEl.innerHTML = result.html;
    setStatus(result.footnotes > 0 ? `已整理 ${result.footnotes} 條外部連結` : '就緒');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : '渲染失敗');
  }
  wordcountEl.textContent = `${countWords(md)} 字`;
}

const debouncedRender = debounce(renderPreview, 200);

function setStatus(text: string): void {
  statusEl.textContent = text;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('is-show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2600);
}

async function onCopy(): Promise<void> {
  // 同步以當前編輯器內容重繪，避免用到 debounce 尚未刷新的舊 HTML。
  renderPreview();
  const plain = editor.getValue();
  try {
    const via = await copyHtml(lastHtml, plain);
    toast(
      via === 'clipboard-api'
        ? '已複製！到公眾號編輯器直接貼上（Cmd/Ctrl+V）即可'
        : '已複製（相容模式）！到公眾號直接貼上即可',
    );
  } catch {
    toast('複製失敗，請改用瀏覽器的全選並複製');
  }
}

function setupWidthToggle(): void {
  const group = $('widthToggle');
  for (const btn of group.querySelectorAll<HTMLButtonElement>('button')) {
    btn.addEventListener('click', () => {
      for (const b of group.querySelectorAll('button')) b.classList.remove('is-active');
      btn.classList.add('is-active');
      phoneEl.classList.toggle('is-wide', btn.dataset.w === 'wide');
    });
  }
}

function setupDivider(): void {
  const divider = $('divider');
  const panes = document.querySelector<HTMLElement>('.panes')!;
  let dragging = false;

  const onMove = (clientX: number) => {
    const rect = panes.getBoundingClientRect();
    const ratio = Math.min(0.8, Math.max(0.2, (clientX - rect.left) / rect.width));
    panes.style.gridTemplateColumns = `${ratio}fr 6px ${1 - ratio}fr`;
  };

  divider.addEventListener('pointerdown', (e) => {
    dragging = true;
    divider.classList.add('is-dragging');
    divider.setPointerCapture(e.pointerId);
  });
  divider.addEventListener('pointermove', (e) => {
    if (dragging) onMove(e.clientX);
  });
  divider.addEventListener('pointerup', (e) => {
    dragging = false;
    divider.classList.remove('is-dragging');
    divider.releasePointerCapture(e.pointerId);
  });
}

function setupFileIO(): void {
  $('importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      editor.setValue(text);
      fileInput.value = '';
    });
  });
  $('exportBtn').addEventListener('click', () => {
    downloadText('wemark.md', editor.getValue());
  });
}

function setupMobileToggle(): void {
  // 窄螢幕：複製鍵旁沒有預覽，改由點狀態列切換（簡易）
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      appEl.classList.toggle('show-preview');
    }
  });
}

async function boot(): Promise<void> {
  setupWidthToggle();
  setupDivider();
  setupFileIO();
  setupMobileToggle();
  $('copyBtn').addEventListener('click', () => void onCopy());

  const draft = loadDraft();
  editor.setValue(draft && draft.trim() ? draft : SAMPLE_MARKDOWN);
  editor.onChange((value) => {
    persistDraft(value);
    debouncedRender();
  });

  try {
    await initEngine();
  } catch {
    setStatus('引擎載入失敗，請重新整理頁面');
    return;
  }

  const themes = listThemes();
  for (const t of themes) themeAccents.set(t.id, t.accent);
  if (!themes.some((t) => t.id === currentTheme)) {
    currentTheme = themes[0]?.id ?? 'default';
  }

  const accentInput = $<HTMLInputElement>('accent');
  const syncAccentSwatch = () => {
    accentInput.value = themeAccents.get(currentTheme) ?? '#4c5bd4';
  };
  accentInput.addEventListener('input', () => {
    currentAccent = accentInput.value;
    renderPreview();
  });

  renderThemeSwitcher(themesEl, themes, currentTheme, (id) => {
    currentTheme = id;
    currentAccent = ''; // 切換主題時重置為主題預設強調色
    saveTheme(id);
    syncAccentSwatch();
    renderPreview();
  });

  syncAccentSwatch();
  renderPreview();
  editor.focus();

  // 提供「清空草稿」的隱藏入口：雙擊字數
  wordcountEl.addEventListener('dblclick', () => {
    clearDraft();
    editor.setValue(SAMPLE_MARKDOWN);
    toast('已清空草稿');
  });
}

void boot();
