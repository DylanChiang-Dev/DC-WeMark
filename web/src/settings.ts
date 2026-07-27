import type { BackgroundStyle, FontFamily, FontSize } from './engine.js';
import {
  getThemePreset,
  THEME_PRESETS,
  themesInGroup,
  type ThemeGroup,
  type ThemePreset,
} from './theme-presets.js';

interface SettingsState {
  themeId: string;
  accent: string;
  background: BackgroundStyle;
  fontSize: FontSize;
  fontFamily: FontFamily;
  scrollSync: boolean;
}

interface SettingsHandlers {
  onTheme(theme: ThemePreset): void;
  onAccent(accent: string): void;
  onBackground(background: BackgroundStyle): void;
  onFontSize(fontSize: FontSize): void;
  onFontFamily(fontFamily: FontFamily): void;
  onScrollSync(enabled: boolean): void;
}

export interface SettingsController {
  setTheme(themeId: string): void;
  setAccent(accent: string): void;
  setBackground(background: BackgroundStyle): void;
  setFontSize(fontSize: FontSize): void;
  setFontFamily(fontFamily: FontFamily): void;
  setScrollSync(enabled: boolean): void;
}

const ACCENT_PRESETS = [
  { name: '主題色', value: '' },
  { name: '霧銀', value: '#49647a' },
  { name: '躍藍', value: '#1673d1' },
  { name: '墨黑', value: '#20242b' },
  { name: '松青', value: '#0f766e' },
  { name: '珊瑚', value: '#c2414d' },
  { name: '琥珀', value: '#9a5a12' },
  { name: '葡萄', value: '#6f4a91' },
] as const;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
};

export function createSettingsPanel(
  initial: SettingsState,
  handlers: SettingsHandlers,
): SettingsController {
  const panel = byId<HTMLElement>('settingsPanel');
  const overlay = byId<HTMLElement>('settingsOverlay');
  const gallery = byId<HTMLElement>('themeGallery');
  const currentName = byId<HTMLElement>('currentThemeName');
  const currentDescription = byId<HTMLElement>('currentThemeDescription');
  const currentSwatch = byId<HTMLElement>('currentThemeSwatch');
  const themeTotal = byId<HTMLElement>('themeTotal');
  const accentOptions = byId<HTMLElement>('accentOptions');
  const scrollSync = byId<HTMLInputElement>('scrollSync');
  const fontSizeGroup = byId<HTMLElement>('fontSizeGroup');
  const fontFamilyGroup = byId<HTMLElement>('fontFamilyGroup');
  let activeGroup: ThemeGroup = 'native';
  let state = { ...initial };

  const close = () => {
    panel.hidden = true;
    overlay.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('settings-open');
    byId<HTMLButtonElement>('settingsBtn').focus();
  };

  const open = () => {
    panel.hidden = false;
    overlay.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('settings-open');
    byId<HTMLButtonElement>('settingsClose').focus();
  };

  const renderCurrentTheme = () => {
    const preset = getThemePreset(state.themeId);
    currentName.textContent = preset.name;
    currentDescription.textContent = preset.description;
    currentSwatch.replaceChildren();
    for (const color of preset.palette) {
      const swatch = document.createElement('span');
      swatch.style.background = color;
      currentSwatch.append(swatch);
    }
  };

  const renderGallery = () => {
    gallery.replaceChildren();
    for (const preset of themesInGroup(activeGroup)) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'theme-option';
      option.dataset.themeId = preset.id;
      option.classList.toggle('is-active', preset.id === state.themeId);
      option.setAttribute('aria-pressed', String(preset.id === state.themeId));

      const palette = document.createElement('span');
      palette.className = 'theme-option__palette';
      palette.setAttribute('aria-hidden', 'true');
      for (const color of preset.palette) {
        const swatch = document.createElement('span');
        swatch.style.background = color;
        palette.append(swatch);
      }

      const copy = document.createElement('span');
      copy.className = 'theme-option__copy';
      const name = document.createElement('strong');
      name.textContent = preset.name;
      const description = document.createElement('small');
      description.textContent = preset.description;
      copy.append(name, description);

      option.append(palette, copy);
      option.addEventListener('click', () => {
        state.themeId = preset.id;
        renderCurrentTheme();
        renderGallery();
        handlers.onTheme(preset);
      });
      gallery.append(option);
    }
  };

  const renderAccentOptions = () => {
    accentOptions.replaceChildren();
    const theme = getThemePreset(state.themeId);
    const isNamedAccent = ACCENT_PRESETS.some(
      (preset) => preset.value !== '' && preset.value === state.accent,
    );

    for (const preset of ACCENT_PRESETS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'accent-option';
      button.dataset.accent = preset.value;
      button.setAttribute('aria-label', preset.name);
      const selected = state.accent === preset.value;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));

      const swatch = document.createElement('span');
      swatch.className = 'accent-option__swatch';
      swatch.style.background = preset.value || theme.accent;
      const name = document.createElement('strong');
      name.textContent = preset.name;
      button.append(swatch, name);
      button.addEventListener('click', () => {
        state.accent = preset.value;
        renderAccentOptions();
        handlers.onAccent(state.accent);
      });
      accentOptions.append(button);
    }

    const custom = document.createElement('label');
    custom.className = 'accent-option accent-option--custom';
    custom.classList.toggle('is-active', state.accent !== '' && !isNamedAccent);
    const input = document.createElement('input');
    input.id = 'accent';
    input.type = 'color';
    input.value = state.accent || theme.accent;
    input.setAttribute('aria-label', '自訂強調色');
    const name = document.createElement('strong');
    name.textContent = '自訂';
    custom.append(input, name);
    input.addEventListener('input', () => {
      state.accent = input.value;
      for (const option of accentOptions.querySelectorAll<HTMLElement>('[data-accent]')) {
        option.classList.remove('is-active');
        option.setAttribute('aria-pressed', 'false');
      }
      custom.classList.add('is-active');
      handlers.onAccent(state.accent);
    });
    accentOptions.append(custom);
  };

  for (const tab of panel.querySelectorAll<HTMLButtonElement>('[data-theme-group]')) {
    tab.addEventListener('click', () => {
      activeGroup = tab.dataset.themeGroup as ThemeGroup;
      for (const item of panel.querySelectorAll<HTMLElement>('[data-theme-group]')) {
        const selected = item === tab;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
      }
      renderGallery();
    });
  }

  for (const input of panel.querySelectorAll<HTMLInputElement>('input[name="backgroundStyle"]')) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.background = input.value as BackgroundStyle;
      handlers.onBackground(state.background);
    });
  }

  for (const button of fontSizeGroup.querySelectorAll<HTMLButtonElement>('[data-font-size]')) {
    button.addEventListener('click', () => {
      state.fontSize = button.dataset.fontSize as FontSize;
      syncFontSize();
      handlers.onFontSize(state.fontSize);
    });
  }

  for (const button of fontFamilyGroup.querySelectorAll<HTMLButtonElement>(
    '[data-font-family]',
  )) {
    button.addEventListener('click', () => {
      state.fontFamily = button.dataset.fontFamily as FontFamily;
      syncFontFamily();
      handlers.onFontFamily(state.fontFamily);
    });
  }

  scrollSync.addEventListener('change', () => {
    state.scrollSync = scrollSync.checked;
    handlers.onScrollSync(state.scrollSync);
  });

  byId<HTMLButtonElement>('settingsBtn').addEventListener('click', open);
  byId<HTMLButtonElement>('settingsClose').addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  const syncBackground = () => {
    for (const input of panel.querySelectorAll<HTMLInputElement>(
      'input[name="backgroundStyle"]',
    )) {
      input.checked = input.value === state.background;
    }
  };

  const syncFontSize = () => {
    for (const button of fontSizeGroup.querySelectorAll<HTMLButtonElement>('[data-font-size]')) {
      const selected = button.dataset.fontSize === state.fontSize;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  };

  const syncFontFamily = () => {
    for (const button of fontFamilyGroup.querySelectorAll<HTMLButtonElement>(
      '[data-font-family]',
    )) {
      const selected = button.dataset.fontFamily === state.fontFamily;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  };

  renderCurrentTheme();
  renderGallery();
  renderAccentOptions();
  themeTotal.textContent = String(THEME_PRESETS.length);
  syncBackground();
  syncFontSize();
  syncFontFamily();
  scrollSync.checked = state.scrollSync;

  return {
    setTheme(themeId) {
      state.themeId = themeId;
      renderCurrentTheme();
      renderGallery();
      renderAccentOptions();
    },
    setAccent(accent) {
      state.accent = accent;
      renderAccentOptions();
    },
    setBackground(background) {
      state.background = background;
      syncBackground();
    },
    setFontSize(fontSize) {
      state.fontSize = fontSize;
      syncFontSize();
    },
    setFontFamily(fontFamily) {
      state.fontFamily = fontFamily;
      syncFontFamily();
    },
    setScrollSync(enabled) {
      state.scrollSync = enabled;
      scrollSync.checked = enabled;
    },
  };
}
