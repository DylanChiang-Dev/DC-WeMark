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
import { getThemePreset, type ThemePreset } from './theme-presets.js';
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
const statusEl = $('status');
const wordcountEl = $('wordcount');
const toastEl = $('toast');
const stampEl = $('stamp');
const draftStateEl = $('draftState');
const draftLabelEl = $('draftLabel');
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

const DRAFT_DELAY_MS = 1000;
const editor = createTextareaEditor(editorEl);
const draftSaver = debouncedSaveDraft(DRAFT_DELAY_MS);
const UNDO_HINT = '可按 Cmd/Ctrl+Z 撤销';
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
    setStatus(err instanceof Error ? err.message : '渲染失败', true);
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
    const extra = warnings.length > 1 ? `（另有 ${warnings.length - 1} 项提醒）` : '';
    setStatus(`${warnings[0]}${extra}`, true, warnings.join('\n'));
    return;
  }
  if (highlightState === 'failed') {
    setStatus('代码高亮加载失败，代码块以纯文本输出；刷新页面可重试', true);
    return;
  }
  const notes: string[] = [];
  if (highlightState === 'loading') notes.push('代码高亮加载中…');
  if (result.footnotes > 0) notes.push(`已整理 ${result.footnotes} 条外部链接`);
  if (result.remoteImages > 0) {
    notes.push(`${result.remoteImages} 张网络图片会由公众号转存，若显示失败请改在公众号内上传`);
  }
  setStatus(notes.length > 0 ? notes.join('；') : '就绪');
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('is-show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2600);
}

let stampTimer: ReturnType<typeof setTimeout> | undefined;
/** 複製成功的落款鈐印：重新觸發動畫後自動淡出。 */
function stamp(): void {
  stampEl.classList.remove('is-stamped');
  void stampEl.offsetWidth;
  stampEl.classList.add('is-stamped');
  if (stampTimer) clearTimeout(stampTimer);
  stampTimer = setTimeout(() => stampEl.classList.remove('is-stamped'), 2200);
}

function setDraftState(state: 'saved' | 'pending'): void {
  draftStateEl.dataset.state = state;
  draftLabelEl.textContent = state === 'saved' ? '草稿已存本机' : '编辑中';
}

async function onCopy(): Promise<void> {
  // 同步以當前編輯器內容重繪，避免用到 debounce 尚未刷新的舊 HTML。
  renderPreview();
  const plain = editor.getValue();
  try {
    const via = await copyHtml(lastHtml, plain);
    stamp();
    toast(
      via === 'clipboard-api'
        ? '已复制，到公众号编辑器直接粘贴（Cmd/Ctrl+V）即可'
        : '已复制（兼容模式），到公众号编辑器直接粘贴即可',
    );
  } catch {
    toast('复制失败，请在预览区全选后手动复制');
  }
}

function setupWidthToggle(): void {
  const group = $('widthToggle');
  for (const btn of group.querySelectorAll<HTMLButtonElement>('button')) {
    btn.addEventListener('click', () => {
      setPressed(group, btn);
      phoneEl.classList.toggle('is-wide', btn.dataset.w === 'wide');
    });
  }
}

function setPressed(group: HTMLElement, active: HTMLButtonElement): void {
  for (const b of group.querySelectorAll<HTMLButtonElement>('button')) {
    const on = b === active;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

function setupDivider(): void {
  const divider = $('divider');
  const panes = document.querySelector<HTMLElement>('.panes')!;
  let dragging = false;
  let ratio = 0.5;

  const applyRatio = (next: number) => {
    ratio = Math.min(0.8, Math.max(0.2, next));
    panes.style.gridTemplateColumns = `${ratio}fr 10px ${1 - ratio}fr`;
    divider.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  };

  const onMove = (clientX: number) => {
    const rect = panes.getBoundingClientRect();
    applyRatio((clientX - rect.left) / rect.width);
  };

  divider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') applyRatio(ratio - 0.05);
    else if (e.key === 'ArrowRight') applyRatio(ratio + 0.05);
    else return;
    e.preventDefault();
  });

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
      toast(`已导入 ${file.name}，${UNDO_HINT}`);
    });
  });
  $('exportBtn').addEventListener('click', () => {
    downloadText('wemark.md', editor.getValue());
  });
}

function setupMobileToggle(): void {
  const group = $('mobileToggle');
  const buttons = group.querySelectorAll<HTMLButtonElement>('button');
  const show = (preview: boolean) => {
    appEl.classList.toggle('show-preview', preview);
    for (const b of buttons) {
      if ((b.dataset.view === 'preview') === preview) setPressed(group, b);
    }
  };
  const toggle = () => show(!appEl.classList.contains('show-preview'));
  // 窄螢幕可見的編輯／預覽切換
  for (const b of buttons) {
    b.addEventListener('click', () => show(b.dataset.view === 'preview'));
  }
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
  // 記錄程式設定的捲動位置；對應的 scroll 事件只要停在該位置就略過，
  // 不靠時間鎖，避免慢速影格下把使用者的捲動誤判為回饋而吞掉。
  const programmatic = new WeakMap<HTMLElement, number>();

  const sync = (source: HTMLElement, target: HTMLElement) => {
    if (!scrollSyncEnabled) return;
    const expected = programmatic.get(source);
    if (expected !== undefined) {
      programmatic.delete(source);
      if (Math.abs(source.scrollTop - expected) <= 1) return;
    }
    const sourceMax = source.scrollHeight - source.clientHeight;
    const targetMax = target.scrollHeight - target.clientHeight;
    if (sourceMax <= 0 || targetMax <= 0) return;
    const before = target.scrollTop;
    target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
    // 位置沒變就不會觸發 scroll 事件，不能留下記錄。
    if (Math.abs(target.scrollTop - before) > 1) programmatic.set(target, target.scrollTop);
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
  const markSaved = debounce(() => setDraftState('saved'), DRAFT_DELAY_MS + 50);
  editor.onChange((value) => {
    draftSaver.save(value);
    setDraftState('pending');
    markSaved();
    debouncedRender();
  });
  editor.onFileDrop((name) => toast(`已载入 ${name}，${UNDO_HINT}`));
  // 關閉或切走分頁前立即寫入，避免遺失 debounce 期間的最後修改。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') draftSaver.flush();
  });
  window.addEventListener('pagehide', () => draftSaver.flush());

  try {
    await initEngine();
  } catch {
    setStatus('引擎加载失败，请刷新页面', true);
    return;
  }

  const engineThemeIds = new Set(listThemes().map((theme) => theme.id));
  if (!engineThemeIds.has(currentPreset.engineTheme)) {
    currentPreset = getThemePreset(null);
  }

  const selectTheme = (preset: ThemePreset) => {
    currentPreset = preset;
    currentAccent = ''; // 切換主題時重置為主題預設強調色
    saveAccent('');
    saveTheme(preset.id);
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

  renderPreview();
  editor.focus();

  // 提供「清空草稿」的隱藏入口：雙擊字數
  wordcountEl.addEventListener('dblclick', () => {
    editor.replaceAll(SAMPLE_MARKDOWN);
    toast(`已清空草稿，${UNDO_HINT}`);
  });
}

void boot();
