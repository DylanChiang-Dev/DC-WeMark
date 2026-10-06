// localStorage 草稿與偏好（全本地，符合隱私承諾）。

import type { BackgroundStyle, FontFamily, FontSize, OutputLocale } from './engine.js';

const DRAFT_KEY = 'wemark:draft:v1';
const THEME_KEY = 'wemark:theme:v1';
const ACCENT_KEY = 'wemark:accent:v1';
const BACKGROUND_KEY = 'wemark:background:v1';
const FONT_SIZE_KEY = 'wemark:font-size:v1';
const FONT_FAMILY_KEY = 'wemark:font-family:v1';
const SCROLL_SYNC_KEY = 'wemark:scroll-sync:v1';
const LOCALE_KEY = 'wemark:output-locale:v1';
const APPEARANCE_MIGRATION_KEY = 'wemark:appearance-migration:v2';

/**
 * v2 只清理外觀偏好，保留草稿與同步捲動，並以版本鍵確保只執行一次。
 * 舊主題識別字由 theme-presets 做相容導向；清理偏好可避免舊色彩污染新主題。
 */
export function migrateAppearancePreferences(): void {
  try {
    if (localStorage.getItem(APPEARANCE_MIGRATION_KEY) === 'v2') return;
    for (const key of [
      THEME_KEY,
      ACCENT_KEY,
      BACKGROUND_KEY,
      FONT_SIZE_KEY,
      FONT_FAMILY_KEY,
    ]) {
      localStorage.removeItem(key);
    }
    localStorage.setItem(APPEARANCE_MIGRATION_KEY, 'v2');
  } catch {
    // 忽略（隱私模式 / 配額）；下次載入仍會嘗試遷移。
  }
}

export function loadDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

export function saveDraft(text: string): void {
  try {
    localStorage.setItem(DRAFT_KEY, text);
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略
  }
}

export function loadTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function saveTheme(id: string): void {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    // 忽略
  }
}

/** 自訂強調色覆寫；空字串表示用主題預設。 */
export function loadAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAccent(accent: string): void {
  try {
    if (accent) localStorage.setItem(ACCENT_KEY, accent);
    else localStorage.removeItem(ACCENT_KEY);
  } catch {
    // 忽略
  }
}

export function loadBackground(): BackgroundStyle {
  try {
    const value = localStorage.getItem(BACKGROUND_KEY);
    return value === 'warm' || value === 'grid' || value === 'none' ? value : 'warm';
  } catch {
    return 'warm';
  }
}

export function saveBackground(background: BackgroundStyle): void {
  try {
    localStorage.setItem(BACKGROUND_KEY, background);
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export function loadFontSize(): FontSize {
  try {
    const value = localStorage.getItem(FONT_SIZE_KEY);
    return value === 'small' || value === 'large' ? value : 'medium';
  } catch {
    return 'medium';
  }
}

export function saveFontSize(fontSize: FontSize): void {
  try {
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export function loadFontFamily(): FontFamily {
  try {
    const value = localStorage.getItem(FONT_FAMILY_KEY);
    return value === 'sans' || value === 'serif' || value === 'kai' ? value : 'theme';
  } catch {
    return 'theme';
  }
}

export function saveFontFamily(fontFamily: FontFamily): void {
  try {
    localStorage.setItem(FONT_FAMILY_KEY, fontFamily);
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export function loadScrollSync(): boolean {
  try {
    return localStorage.getItem(SCROLL_SYNC_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveScrollSync(enabled: boolean): void {
  try {
    localStorage.setItem(SCROLL_SYNC_KEY, String(enabled));
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export function loadLocale(): OutputLocale {
  try {
    return localStorage.getItem(LOCALE_KEY) === 'hans' ? 'hans' : 'hant';
  } catch {
    return 'hant';
  }
}

export function saveLocale(locale: OutputLocale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // 忽略（隱私模式 / 配額）
  }
}

export interface DraftSaver {
  /** 延遲存檔（連續輸入只存最後一次）。 */
  save(text: string): void;
  /** 立即寫入尚未存檔的內容；用於分頁隱藏或關閉前。 */
  flush(): void;
}

/** 回傳一個 debounce 後的存草稿器，可在離開頁面前 flush。 */
export function debouncedSaveDraft(delayMs: number): DraftSaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending === undefined) return;
    saveDraft(pending);
    pending = undefined;
  };
  return {
    save(text: string) {
      pending = text;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
