export type ThemeGroup = 'native' | 'featured' | 'template';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  engineTheme: string;
  group: ThemeGroup;
}

const native: ThemePreset[] = [
  {
    id: 'standard',
    name: '簡明',
    description: '清楚穩定，適合從第一篇文章直接開始。',
    accent: '#4c5bd4',
    engineTheme: 'default',
    group: 'native',
  },
  {
    id: 'product-blue',
    name: '產品藍',
    description: '俐落清晰，適合產品更新與功能說明。',
    accent: '#2563eb',
    engineTheme: 'pine',
    group: 'native',
  },
  {
    id: 'editorial',
    name: '刊物',
    description: '有編輯感的層次，適合專題與深度文章。',
    accent: '#a4343a',
    engineTheme: 'magazine',
    group: 'native',
  },
  {
    id: 'notebook',
    name: '手帳',
    description: '溫暖親切，適合生活記錄與經驗分享。',
    accent: '#e0743c',
    engineTheme: 'warm',
    group: 'native',
  },
  {
    id: 'forest',
    name: '松林',
    description: '安靜自然，適合知識整理與長文閱讀。',
    accent: '#0d9488',
    engineTheme: 'pine',
    group: 'native',
  },
  {
    id: 'monochrome',
    name: '黑白',
    description: '低干擾、高對比，適合技術與觀點內容。',
    accent: '#111111',
    engineTheme: 'mono',
    group: 'native',
  },
];

const featured: ThemePreset[] = [
  ['coral-brief', '珊瑚簡報', '醒目但不張揚，適合清單與重點整理。', '#e11d48', 'default'],
  ['harbor-blue', '海港藍', '沉穩清爽，適合商業觀察與案例文章。', '#1d4ed8', 'magazine'],
  ['amber-notes', '琥珀札記', '帶有暖光感，適合遊記與敘事內容。', '#d97706', 'warm'],
  ['moss-journal', '苔原綠', '柔和自然，適合健康與生活方式主題。', '#15803d', 'pine'],
  ['ink-line', '墨線', '純粹黑白，讓文字本身成為視覺主體。', '#111827', 'mono'],
  ['wisteria', '紫藤', '柔和有氣質，適合文化與靈感內容。', '#7c3aed', 'warm'],
  ['terracotta', '赤陶', '厚實溫潤，適合人文與品牌故事。', '#c2410c', 'magazine'],
  ['mint-sheet', '薄荷頁', '明亮透氣，適合教程與輕量知識。', '#0f766e', 'pine'],
  ['cobalt-report', '鈷藍報告', '理性可靠，適合數據與研究整理。', '#2563eb', 'default'],
  ['graphite', '石墨', '克制專業，適合技術文件與工作復盤。', '#4b5563', 'mono'],
].map(
  ([id, name, description, accent, engineTheme]): ThemePreset => ({
    id,
    name,
    description,
    accent,
    engineTheme,
    group: 'featured',
  }),
);

const colors = [
  ['gold', '金', '#b7791f'],
  ['green', '綠', '#15803d'],
  ['blue', '藍', '#2563eb'],
  ['orange', '橙', '#ea580c'],
  ['red', '紅', '#dc2626'],
  ['navy', '靛', '#1e3a8a'],
  ['gray', '灰', '#4b5563'],
  ['sky', '天青', '#0284c7'],
] as const;

const families = [
  ['airy', '留白', 'mono', '減少裝飾，保留清楚節奏與充足留白。'],
  ['focus', '聚焦', 'pine', '強化標題與段落焦點，適合結論先行。'],
  ['layered', '層次', 'magazine', '拉開章節層級，適合長篇與專題內容。'],
  ['impact', '標題塊', 'warm', '放大標題存在感，適合活動與宣傳內容。'],
] as const;

const templates: ThemePreset[] = families.flatMap(
  ([familyId, familyName, engineTheme, description]) =>
    colors.map(
      ([colorId, colorName, accent]): ThemePreset => ({
        id: `${familyId}-${colorId}`,
        name: `${familyName}${colorName}`,
        description,
        accent,
        engineTheme,
        group: 'template',
      }),
    ),
);

export const THEME_PRESETS: ThemePreset[] = [...native, ...featured, ...templates];
export const QUICK_THEME_PRESETS = native;

const aliases: Record<string, string> = {
  default: 'standard',
  warm: 'notebook',
  pine: 'forest',
  magazine: 'editorial',
  mono: 'monochrome',
};

export function getThemePreset(id: string | null): ThemePreset {
  const normalized = id ? (aliases[id] ?? id) : 'standard';
  return THEME_PRESETS.find((preset) => preset.id === normalized) ?? native[0];
}

export function themesInGroup(group: ThemeGroup): ThemePreset[] {
  return THEME_PRESETS.filter((preset) => preset.group === group);
}
