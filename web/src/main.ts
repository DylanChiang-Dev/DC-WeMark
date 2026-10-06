// 應用入口：載入 wasm，串起編輯器、預覽、複製、主題、草稿。

import { copyHtml } from './clipboard.js';
import { createTextareaEditor } from './editor.js';
import {
  initEngine,
  isHighlightReady,
  listThemes,
  loadHighlighter,
  render,
  wantsHighlight,
  type BackgroundStyle,
  type FontFamily,
  type FontSize,
  type RenderOptions,
  type RenderResult,
} from './engine.js';
import { SAMPLE_MARKDOWN } from './sample.js';
import { createSettingsPanel, type SettingsController } from './settings.js';
import { renderThemeSwitcher } from './themes.js';
import {
  getThemePreset,
  QUICK_THEME_PRESETS,
  type ThemePreset,
} from './theme-presets.js';
import {
  debouncedSaveDraft,
  loadAccent,
  loadBackground,
  loadDraft,
  loadFontFamily,
  loadFontSize,
  loadLocale,
  loadScrollSync,
  loadTheme,
  migrateAppearancePreferences,
  saveAccent,
  saveBackground,
  saveFontFamily,
  saveFontSize,
  saveLocale,
  saveScrollSync,
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

migrateAppearancePreferences();

let currentPreset = getThemePreset(loadTheme());
let currentAccent = loadAccent(); // 空 = 用主題預設
let currentBackground = loadBackground();
let currentFontSize = loadFontSize();
let currentFontFamily = loadFontFamily();
let currentLocale = loadLocale();
let scrollSyncEnabled = loadScrollSync();
let lastHtml = '';
let settingsController: SettingsController | undefined;

const editor = createTextareaEditor(editorEl);
const draftSaver = debouncedSaveDraft(1000);
const UNDO_HINT = '可按 Cmd/Ctrl+Z 復原';
let highlightState: 'idle' | 'loading' | 'failed' = 'idle';

function maybeLoadHighlighter(markdown: string): void {
  if (highlightState !== 'idle' || isHighlightReady() || !wantsHighlight(markdown)) return;
  highlightState = 'loading';
  loadHighlighter().then(
    () => {
      highlightState = 'idle';
      renderPreview();
    },
    () => {
      highlightState = 'failed';
      renderPreview();
    },
  );
}

function renderPreview(): void {
  const md = editor.getValue();
  const opts: RenderOptions = {
    externalFootnotes: true,
    accent: currentAccent || currentPreset.accent,
    background: currentBackground,
    fontSize: currentFontSize,
    fontFamily: currentFontFamily,
    locale: currentLocale,
  };
  try {
    const result = render(md, currentPreset.engineTheme, opts);
    lastHtml = result.html;
    previewEl.innerHTML = result.html;
    maybeLoadHighlighter(md);
    showResultStatus(result);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : '渲染失敗', true);
  }
  wordcountEl.textContent = `${countWords(md)} 字`;
}

const debouncedRender = debounce(renderPreview, 200);

function setStatus(text: string, warning = false, detail = text): void {
  statusEl.textContent = text;
  statusEl.title = detail;
  statusEl.classList.toggle('is-warning', warning);
}

function showResultStatus(result: RenderResult): void {
  const { warnings } = result;
  if (warnings.length > 0) {
    const extra = warnings.length > 1 ? `（另有 ${warnings.length - 1} 項提醒）` : '';
    setStatus(`${warnings[0]}${extra}`, true, warnings.join('\n'));
    return;
  }
  if (highlightState === 'failed') {
    setStatus('程式碼高亮載入失敗，程式碼區塊以純文字輸出；重新整理頁面可再試', true);
    return;
  }
  const notes: string[] = [];
  if (highlightState === 'loading') notes.push('程式碼高亮載入中…');
  if (result.footnotes > 0) notes.push(`已整理 ${result.footnotes} 條外部連結`);
  if (result.remoteImages > 0) {
    notes.push(`${result.remoteImages} 張網路圖片會由公眾號轉存，若顯示失敗請改在公眾號內上傳`);
  }
  setStatus(notes.length > 0 ? notes.join('；') : '就緒');
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
    void file.text().then((text) => {
      editor.replaceAll(text);
      fileInput.value = '';
      toast(`已匯入 ${file.name}，${UNDO_HINT}`);
    });
  });
  $('exportBtn').addEventListener('click', () => {
    downloadText('wemark.md', editor.getValue());
  });
}

function setupMobileToggle(): void {
  const toggle = () => appEl.classList.toggle('show-preview');
  // 窄螢幕可見按鈕
  $('mobileToggle').addEventListener('click', toggle);
  // 桌面快捷鍵
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });
}

// 依比例把左欄捲動同步到右欄預覽（單向，避免回饋迴圈）。
function setupScrollSync(): void {
  const previewPane = document.querySelector<HTMLElement>('.pane--preview')!;
  let lockedTarget: HTMLElement | null = null;

  const sync = (source: HTMLElement, target: HTMLElement) => {
    if (!scrollSyncEnabled || lockedTarget === source) return;
    const sourceMax = source.scrollHeight - source.clientHeight;
    const targetMax = target.scrollHeight - target.clientHeight;
    if (sourceMax <= 0 || targetMax <= 0) return;
    lockedTarget = target;
    target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
    requestAnimationFrame(() => {
      lockedTarget = null;
    });
  };

  editorEl.addEventListener('scroll', () => sync(editorEl, previewPane));
  previewPane.addEventListener('scroll', () => sync(previewPane, editorEl));
}

async function boot(): Promise<void> {
  setupWidthToggle();
  setupDivider();
  setupFileIO();
  setupMobileToggle();
  setupScrollSync();
  $('copyBtn').addEventListener('click', () => void onCopy());

  const draft = loadDraft();
  editor.setValue(draft && draft.trim() ? draft : SAMPLE_MARKDOWN);
  editor.onChange((value) => {
    draftSaver.save(value);
    debouncedRender();
  });
  editor.onFileDrop((name) => toast(`已載入 ${name}，${UNDO_HINT}`));
  // 關閉或切走分頁前立即寫入，避免遺失 debounce 期間的最後修改。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') draftSaver.flush();
  });
  window.addEventListener('pagehide', () => draftSaver.flush());

  try {
    await initEngine();
  } catch {
    setStatus('引擎載入失敗，請重新整理頁面');
    return;
  }

  const engineThemeIds = new Set(listThemes().map((theme) => theme.id));
  if (!engineThemeIds.has(currentPreset.engineTheme)) {
    currentPreset = getThemePreset(null);
  }

  const renderQuickThemes = () => {
    renderThemeSwitcher(themesEl, QUICK_THEME_PRESETS, currentPreset.id, (id) => {
      selectTheme(getThemePreset(id));
    });
  };

  const selectTheme = (preset: ThemePreset) => {
    currentPreset = preset;
    currentAccent = ''; // 切換主題時重置為主題預設強調色
    saveAccent('');
    saveTheme(preset.id);
    renderQuickThemes();
    settingsController?.setTheme(preset.id);
    settingsController?.setAccent('');
    renderPreview();
  };

  const setAccent = (accent: string) => {
    currentAccent = accent;
    saveAccent(accent);
    renderPreview();
  };

  const setBackground = (background: BackgroundStyle) => {
    currentBackground = background;
    saveBackground(background);
    backgroundQuick.value = background;
    settingsController?.setBackground(background);
    renderPreview();
  };

  const setFontSize = (fontSize: FontSize) => {
    currentFontSize = fontSize;
    saveFontSize(fontSize);
    settingsController?.setFontSize(fontSize);
    renderPreview();
  };

  const setFontFamily = (fontFamily: FontFamily) => {
    currentFontFamily = fontFamily;
    saveFontFamily(fontFamily);
    settingsController?.setFontFamily(fontFamily);
    renderPreview();
  };

  const backgroundQuick = $<HTMLSelectElement>('backgroundQuick');
  backgroundQuick.value = currentBackground;
  backgroundQuick.addEventListener('change', () => {
    setBackground(backgroundQuick.value as BackgroundStyle);
  });

  settingsController = createSettingsPanel(
    {
      themeId: currentPreset.id,
      background: currentBackground,
      fontSize: currentFontSize,
      fontFamily: currentFontFamily,
      locale: currentLocale,
      accent: currentAccent,
      scrollSync: scrollSyncEnabled,
    },
    {
      onTheme: selectTheme,
      onAccent: setAccent,
      onBackground: setBackground,
      onFontSize: setFontSize,
      onFontFamily: setFontFamily,
      onLocale(locale) {
        currentLocale = locale;
        saveLocale(locale);
        renderPreview();
      },
      onScrollSync(enabled) {
        scrollSyncEnabled = enabled;
        saveScrollSync(enabled);
      },
    },
  );

  renderQuickThemes();
  renderPreview();
  editor.focus();

  // 提供「清空草稿」的隱藏入口：雙擊字數
  wordcountEl.addEventListener('dblclick', () => {
    editor.replaceAll(SAMPLE_MARKDOWN);
    toast(`已清空草稿，${UNDO_HINT}`);
  });
}

void boot();
