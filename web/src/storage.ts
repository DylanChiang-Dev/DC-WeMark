// localStorage 草稿與偏好（全本地，符合隱私承諾）。

const DRAFT_KEY = 'wemark:draft:v1';
const THEME_KEY = 'wemark:theme:v1';
const ACCENT_KEY = 'wemark:accent:v1';

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

/** 回傳一個 debounce 後的存草稿函式。 */
export function debouncedSaveDraft(delayMs: number): (text: string) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (text: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveDraft(text), delayMs);
  };
}
