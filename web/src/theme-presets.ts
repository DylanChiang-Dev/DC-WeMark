export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  palette: readonly [string, string, string];
  engineTheme: string;
}

const APPLE_PRESET: ThemePreset = {
  id: 'apple',
  name: '苹果风',
  description: '净白留白、亮蓝重点与紫色章节标题，适合大多数文章。',
  accent: '#1677ff',
  palette: ['#1677ff', '#fafafa', '#2c2c2c'],
  engineTheme: 'default',
};

/** 唯一公開主題；後續主題須逐套完成並驗收後再加入。 */
export const THEME_PRESETS: ThemePreset[] = [APPLE_PRESET];

/** 舊版識別字一律導向現行蘋果風，避免舊草稿無法開啟。 */
const LEGACY_IDS = new Set([
  'default',
  'standard',
  'product-blue',
  'editorial',
  'notebook',
  'forest',
  'monochrome',
  'coral-brief',
  'harbor-blue',
  'amber-notes',
  'moss-journal',
  'ink-line',
  'wisteria',
  'terracotta',
  'mint-sheet',
  'cobalt-report',
  'graphite',
  'warm',
  'pine',
  'magazine',
  'mist',
  'mono',
  'pulse',
]);

export function getThemePreset(id: string | null): ThemePreset {
  if (!id || LEGACY_IDS.has(id)) return APPLE_PRESET;
  return THEME_PRESETS.find((preset) => preset.id === id) ?? APPLE_PRESET;
}
