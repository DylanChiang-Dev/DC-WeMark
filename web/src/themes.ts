// 主題切換器 UI：把 wm_themes() 的清單渲染成可點選的 pill。

import type { ThemeMeta } from './engine.js';

export function renderThemeSwitcher(
  container: HTMLElement,
  themes: ThemeMeta[],
  active: string,
  onSelect: (id: string) => void,
): void {
  container.replaceChildren();
  for (const theme of themes) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'theme-pill' + (theme.id === active ? ' is-active' : '');
    pill.dataset.id = theme.id;
    pill.setAttribute('role', 'tab');
    pill.setAttribute('aria-selected', String(theme.id === active));
    pill.title = theme.description;

    const dot = document.createElement('span');
    dot.className = 'theme-pill__dot';
    dot.style.background = theme.accent;

    const label = document.createElement('span');
    label.textContent = theme.name;

    pill.append(dot, label);
    pill.addEventListener('click', () => {
      onSelect(theme.id);
      setActive(container, theme.id);
    });
    container.append(pill);
  }
}

function setActive(container: HTMLElement, id: string): void {
  for (const el of container.querySelectorAll<HTMLElement>('.theme-pill')) {
    const isActive = el.dataset.id === id;
    el.classList.toggle('is-active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  }
}
