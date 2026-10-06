// wemark-core wasm 的載入與型別安全封裝。

import init, { wm_render, wm_themes, wm_version } from './wasm/wemark_core.js';

export interface ThemeMeta {
  id: string;
  name: string;
  description: string;
  accent: string;
}

export interface RenderResult {
  html: string;
  footnotes: number;
  /** 網路圖片數：貼進公眾號時由編輯器轉存，遇到防盜鏈可能失敗。 */
  remoteImages: number;
  /** 排版警告（不安全連結、本機圖片等）。 */
  warnings: string[];
}

export type BackgroundStyle = 'warm' | 'grid' | 'none';
export type FontSize = 'small' | 'medium' | 'large';
export type FontFamily = 'theme' | 'sans' | 'serif' | 'kai';
/** 腳註與參考連結標題的字形：繁體／簡體。 */
export type OutputLocale = 'hant' | 'hans';

export interface RenderOptions {
  externalFootnotes: boolean;
  /** 覆寫強調色；空字串表示用主題預設。 */
  accent: string;
  background: BackgroundStyle;
  fontSize: FontSize;
  fontFamily: FontFamily;
  locale: OutputLocale;
}

interface RawRender {
  ok: boolean;
  html?: string;
  footnotes?: number;
  remoteImages?: number;
  warnings?: string[];
  error?: string;
}

let ready = false;

export async function initEngine(): Promise<void> {
  if (ready) return;
  await init();
  ready = true;
}

export function isReady(): boolean {
  return ready;
}

export function listThemes(): ThemeMeta[] {
  return JSON.parse(wm_themes()) as ThemeMeta[];
}

export function version(): string {
  return wm_version();
}

export function render(markdown: string, themeId: string, opts: RenderOptions): RenderResult {
  const raw = wm_render(
    markdown,
    themeId,
    opts.externalFootnotes,
    opts.accent,
    opts.background,
    opts.fontSize,
    opts.fontFamily,
    opts.locale,
  );
  const parsed = JSON.parse(raw) as RawRender;
  if (!parsed.ok) {
    throw new Error(parsed.error ?? 'render failed');
  }
  return {
    html: parsed.html ?? '',
    footnotes: parsed.footnotes ?? 0,
    remoteImages: parsed.remoteImages ?? 0,
    warnings: parsed.warnings ?? [],
  };
}
