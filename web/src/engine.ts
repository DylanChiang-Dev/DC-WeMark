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
}

export interface RenderOptions {
  externalFootnotes: boolean;
  /** 覆寫強調色；空字串表示用主題預設。 */
  accent: string;
}

interface RawRender {
  ok: boolean;
  html?: string;
  footnotes?: number;
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
  const raw = wm_render(markdown, themeId, opts.externalFootnotes, opts.accent);
  const parsed = JSON.parse(raw) as RawRender;
  if (!parsed.ok) {
    throw new Error(parsed.error ?? 'render failed');
  }
  return { html: parsed.html ?? '', footnotes: parsed.footnotes ?? 0 };
}
