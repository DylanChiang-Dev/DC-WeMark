// localStorage 草稿與偏好（全本地，符合隱私承諾）。

import type { BackgroundStyle, FontFamily, FontSize } from './engine.js';

const DRAFT_KEY = 'wemark:draft:v1';
const THEME_KEY = 'wemark:theme:v1';
const ACCENT_KEY = 'wemark:accent:v1';
const BACKGROUND_KEY = 'wemark:background:v1';
const FONT_SIZE_KEY = 'wemark:font-size:v1';
const FONT_FAMILY_KEY = 'wemark:font-family:v1';
const SCROLL_SYNC_KEY = 'wemark:scroll-sync:v1';

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
    return value === 'warm' || value === 'none' ? value : 'grid';
  } catch {
    return 'grid';
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

/** 回傳一個 debounce 後的存草稿函式。 */
export function debouncedSaveDraft(delayMs: number): (text: string) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (text: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveDraft(text), delayMs);
  };
}
