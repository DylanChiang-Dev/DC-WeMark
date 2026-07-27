import type { BackgroundStyle, FontSize } from './engine.js';
import {
  getThemePreset,
  THEME_PRESETS,
  themesInGroup,
  type ThemeGroup,
  type ThemePreset,
} from './theme-presets.js';

interface SettingsState {
  themeId: string;
  background: BackgroundStyle;
  fontSize: FontSize;
  scrollSync: boolean;
}

interface SettingsHandlers {
  onTheme(theme: ThemePreset): void;
  onBackground(background: BackgroundStyle): void;
  onFontSize(fontSize: FontSize): void;
  onScrollSync(enabled: boolean): void;
}

export interface SettingsController {
  setTheme(themeId: string): void;
  setBackground(background: BackgroundStyle): void;
  setFontSize(fontSize: FontSize): void;
  setScrollSync(enabled: boolean): void;
}

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
  const scrollSync = byId<HTMLInputElement>('scrollSync');
  const fontGroup = byId<HTMLElement>('fontSizeGroup');
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
    currentSwatch.style.background = preset.accent;
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

      const swatch = document.createElement('span');
      swatch.className = 'theme-option__swatch';
      swatch.style.background = preset.accent;

      const copy = document.createElement('span');
      copy.className = 'theme-option__copy';
      const name = document.createElement('strong');
      name.textContent = preset.name;
      const description = document.createElement('small');
      description.textContent = preset.description;
      copy.append(name, description);

      option.append(swatch, copy);
      option.addEventListener('click', () => {
        state.themeId = preset.id;
        renderCurrentTheme();
        renderGallery();
        handlers.onTheme(preset);
      });
      gallery.append(option);
    }
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

  for (const button of fontGroup.querySelectorAll<HTMLButtonElement>('[data-font-size]')) {
    button.addEventListener('click', () => {
      state.fontSize = button.dataset.fontSize as FontSize;
      syncFontSize();
      handlers.onFontSize(state.fontSize);
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
    for (const button of fontGroup.querySelectorAll<HTMLButtonElement>('[data-font-size]')) {
      const selected = button.dataset.fontSize === state.fontSize;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  };

  renderCurrentTheme();
  renderGallery();
  themeTotal.textContent = String(THEME_PRESETS.length);
  syncBackground();
  syncFontSize();
  scrollSync.checked = state.scrollSync;

  return {
    setTheme(themeId) {
      state.themeId = themeId;
      renderCurrentTheme();
      renderGallery();
    },
    setBackground(background) {
      state.background = background;
      syncBackground();
    },
    setFontSize(fontSize) {
      state.fontSize = fontSize;
      syncFontSize();
    },
    setScrollSync(enabled) {
      state.scrollSync = enabled;
      scrollSync.checked = enabled;
    },
  };
}
