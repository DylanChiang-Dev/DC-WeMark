import { test, expect, type Page } from '@playwright/test';

async function readClipboardHtml(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        return await blob.text();
      }
    }
    return '';
  });
}

test('loads and renders the sample article in the preview', async ({ page }) => {
  await page.goto('/');
  const previewH1 = page.locator('#preview h1');
  await expect(previewH1).toBeVisible({ timeout: 15_000 });
  // 預覽輸出帶 inline style（公眾號相容）
  await expect(page.locator('#preview section[style]').first()).toBeVisible();
});

test('typing updates the preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  const editor = page.locator('#editor');
  await editor.fill('# 全新標題\n\n一段測試文字。');
  await expect(page.locator('#preview h1')).toHaveText('全新標題');
});

test('toolbar keeps a single entry for theme and background settings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.topbar select')).toHaveCount(0);
  await expect(page.locator('.theme-pill')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '复制到公众号' })).toBeVisible();
});

async function chooseBackground(page: Page, value: 'warm' | 'grid' | 'none'): Promise<void> {
  await page.getByRole('button', { name: '排版设置' }).click();
  await page.locator(`input[name="backgroundStyle"][value="${value}"]`).check();
  await page.getByRole('button', { name: '关闭排版设置' }).click();
}

test('Apple theme renders soft white by default and keeps grid optional', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const article = page.locator('#preview > section');
  await expect(article).toHaveCSS('background-color', 'rgb(250, 250, 250)');
  await expect(article).toHaveCSS('background-image', 'none');

  await chooseBackground(page, 'grid');
  await expect(article).toHaveCSS('background-image', /linear-gradient/);
  await expect(article).toHaveCSS('background-size', /^24px 24px(?:, 24px 24px)?$/);
  // 輸出背景只作用於文章；編輯區維持自己的朱絲欄，不受方格紙影響。
  await expect(page.locator('#editor')).not.toHaveCSS('background-size', /24px 24px/);
});

test('background style can switch between grid, warm, and none', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const article = page.locator('#preview > section');
  const checked = page.locator('input[name="backgroundStyle"]:checked');
  await expect(checked).toHaveValue('warm');

  await chooseBackground(page, 'grid');
  await expect(article).toHaveCSS('background-image', /linear-gradient/);

  await chooseBackground(page, 'warm');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgb(250, 250, 250)');

  await chooseBackground(page, 'none');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(checked).toHaveValue('none');
  await expect(article).toHaveCSS('background-image', 'none');
});

test('appearance migration runs once and preserves draft and scroll sync', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('wemark:test-migration-seeded')) return;
    localStorage.setItem('wemark:test-migration-seeded', 'true');
    localStorage.setItem('wemark:draft:v1', '# 保留的草稿');
    localStorage.setItem('wemark:theme:v1', 'mist');
    localStorage.setItem('wemark:accent:v1', '#ff0066');
    localStorage.setItem('wemark:background:v1', 'grid');
    localStorage.setItem('wemark:font-size:v1', 'small');
    localStorage.setItem('wemark:font-family:v1', 'serif');
    localStorage.setItem('wemark:scroll-sync:v1', 'false');
  });

  await page.goto('/');
  await expect(page.locator('#preview h1')).toHaveText('保留的草稿');
  await expect(page.locator('#preview > section')).toHaveCSS(
    'background-color',
    'rgb(250, 250, 250)',
  );
  await page.getByRole('button', { name: '排版设置' }).click();
  await expect(page.getByRole('dialog', { name: '排版设置' })).toBeVisible();
  await expect(page.getByRole('switch', { name: '双向滚动同步' })).not.toBeChecked();

  const migrated = await page.evaluate(() => ({
    migration: localStorage.getItem('wemark:appearance-migration:v2'),
    theme: localStorage.getItem('wemark:theme:v1'),
    accent: localStorage.getItem('wemark:accent:v1'),
    background: localStorage.getItem('wemark:background:v1'),
    fontSize: localStorage.getItem('wemark:font-size:v1'),
    fontFamily: localStorage.getItem('wemark:font-family:v1'),
    draft: localStorage.getItem('wemark:draft:v1'),
    scrollSync: localStorage.getItem('wemark:scroll-sync:v1'),
  }));
  expect(migrated).toEqual({
    migration: 'v2',
    theme: null,
    accent: null,
    background: null,
    fontSize: null,
    fontFamily: null,
    draft: '# 保留的草稿',
    scrollSync: 'false',
  });

  await page.getByRole('button', { name: '关闭排版设置' }).click();
  await page.locator('#accent').evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = '#ff0066';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload();
  await expect(page.locator('#accent')).toHaveValue('#ff0066');
  await expect(page.locator('#editor')).toHaveValue('# 保留的草稿');
});

test('settings expose only the completed Apple theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版设置' }).click();

  const panel = page.getByRole('dialog', { name: '排版设置' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('#themeTotal')).toHaveText('1');
  await expect(panel.locator('.theme-option')).toHaveCount(1);
  await expect(panel.locator('.theme-option__palette > span')).toHaveCount(3);
  const themeGallery = panel.locator('#themeGallery');
  await expect(themeGallery.getByRole('button', { name: /苹果风/ })).toBeVisible();
  await expect(panel.locator('[data-theme-group]')).toHaveCount(0);
  await expect(panel.locator('text=霧銀')).toHaveCount(0);
  await expect(panel.locator('text=躍藍')).toHaveCount(0);
  await expect(page.locator('#preview h2').first()).toHaveAttribute(
    'style',
    /background:#6f5df6/i,
  );
});

test('font size and scroll sync preferences persist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版设置' }).click();

  const fontSizes = page.getByRole('group', { name: '文章字号' });
  await fontSizes.getByRole('button', { name: '小' }).click();
  await expect(page.locator('#preview > section')).toHaveCSS('font-size', '14px');

  const sync = page.getByRole('switch', { name: '双向滚动同步' });
  await expect(sync).toBeChecked();
  await sync.uncheck();

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#preview > section')).toHaveCSS('font-size', '14px');
  await page.getByRole('button', { name: '排版设置' }).click();
  await expect(page.getByRole('switch', { name: '双向滚动同步' })).not.toBeChecked();
});

test('font and named accent choices are visual and persist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版设置' }).click();

  const fontFamily = page.getByRole('group', { name: '文章字体' });
  await fontFamily.getByRole('button', { name: '刊物宋体' }).click();
  await expect(page.locator('#preview > section')).toHaveAttribute(
    'style',
    /font-family:Georgia,Songti SC/,
  );

  const accentPresets = page.getByRole('group', { name: '强调色' });
  await expect(page.locator('#accent')).toHaveAttribute('type', 'color');
  await accentPresets.getByRole('button', { name: '蓝色' }).click();
  await expect(page.locator('#preview strong').first()).toHaveAttribute('style', /#2563eb/i);
  await expect(page.locator('#preview h2').first()).toHaveAttribute(
    'style',
    /background:#6f5df6/i,
  );

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#preview > section')).toHaveAttribute(
    'style',
    /font-family:Georgia,Songti SC/,
  );
  await page.getByRole('button', { name: '排版设置' }).click();
  await expect(fontFamily.getByRole('button', { name: '刊物宋体' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(accentPresets.getByRole('button', { name: '蓝色' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('scroll sync follows in both directions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const markdown = Array.from(
    { length: 70 },
    (_, index) => `## 段落 ${index + 1}\n\n這是一段用來驗證同步捲動的內容。`,
  ).join('\n\n');
  const editor = page.locator('#editor');
  const previewPane = page.locator('.pane--preview');
  await editor.fill(markdown);
  await expect(page.locator('#preview h2')).toHaveCount(70);

  await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => previewPane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await previewPane.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBe(0);
});

test('word count reflects editor content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill('你好世界');
  await expect(page.locator('#wordcount')).toHaveText('4 字');
});

test('footer shows copyright and author links', async ({ page }) => {
  await page.goto('/');

  const copyright = page.getByLabel('版权与作者链接');
  await expect(copyright).toContainText('© 2026 Dylan Chiang');
  await expect(copyright.getByRole('link', { name: '个人主页' })).toHaveAttribute(
    'href',
    'https://dc.caiada.edu.kg/',
  );
  await expect(copyright.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/DylanChiang-Dev',
  );

  for (const link of await copyright.getByRole('link').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('custom accent persists across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#accent').evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = '#ff0066';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#preview h1')).toHaveAttribute('style', /#ff0066/i);
  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#accent')).toHaveValue('#ff0066');
});

test('standard Markdown is the only visible authoring path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#insertModule')).toHaveCount(0);
  await expect(page.locator('#editor')).not.toHaveValue(/:::/);
  await expect(page.locator('#editor')).toHaveValue(/- \[x\]/);
});

test('Apple Markdown fixture fits phone and wide previews', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(
    '# 蘋果風驗收\n\n'
      + '## 章節標題\n\n'
      + '段落 **重點**、*斜體*、~~刪除~~ 與 [連結](https://example.com)。\n\n'
      + '> 引用內容\n\n'
      + '- 清單一\n- [x] 已完成\n\n'
      + '1. 有序一\n2. 有序二\n\n'
      + '| 欄位 | 值 |\n| --- | --- |\n| A | B |\n\n'
      + '`行內碼`\n\n```rust\nfn main() {}\n```\n\n---\n\n'
      + '![測試圖片](data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=)',
  );
  await expect(page.locator('#preview h2')).toHaveAttribute('style', /background:#6f5df6/);
  await expect(page.locator('#preview img')).toHaveAttribute('style', /box-shadow/);

  const phoneMetrics = await page.locator('#preview').evaluate((article) => ({
    width: article.clientWidth,
    scrollWidth: article.scrollWidth,
    imageWidth: article.querySelector('img')?.getBoundingClientRect().width ?? 0,
  }));
  expect(phoneMetrics.scrollWidth).toBeLessThanOrEqual(phoneMetrics.width);
  expect(phoneMetrics.imageWidth).toBeLessThanOrEqual(phoneMetrics.width);

  await page.getByRole('button', { name: '宽版' }).click();
  await expect(page.locator('#phone')).toHaveClass(/is-wide/);
  const wideMetrics = await page.locator('#preview').evaluate((article) => ({
    width: article.clientWidth,
    scrollWidth: article.scrollWidth,
  }));
  expect(wideMetrics.scrollWidth).toBeLessThanOrEqual(wideMetrics.width);
});

test('copy writes text/html to the clipboard', async ({ page, context, browserName }) => {
  // WebKit／Firefox 的自動化環境無法讀回剪貼簿；寫入邏輯由 clipboard.spec.ts 以替身覆蓋。
  test.skip(browserName !== 'chromium', 'clipboard read is unavailable in WebKit/Firefox automation');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(
    '# 複製測試\n\n## 章節\n\n> 引用\n\n- [x] 任務\n\n| 欄位 | 值 |\n|---|---|\n| A | B |\n',
  );
  await page.locator('#copyBtn').click();
  await expect(page.locator('#toast')).toHaveClass(/is-show/);
  await expect(page.locator('#stamp')).toHaveClass(/is-stamped/);

  const html = await readClipboardHtml(page);
  expect(html).toContain('<section');
  expect(html).toContain('複製測試');
  expect(html).toContain('background-color:#fafafa');
  // 公眾號深色模式會把漸層拍扁成單一色標，章節標題必須輸出純色。
  expect(html).toContain('background:#6f5df6');
  expect(html).not.toContain('class=');
  expect(html).not.toContain('<style');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('position:');
  // font-family 的雙引號必須轉義；否則瀏覽器會把 style 屬性解析壞掉，
  // 產生像 `ui"=""` 這種殘骸（貼進公眾號會失真）。
  expect(html).not.toMatch(/="">/);
  expect(html).not.toContain('font-family:"');

  const lineHeights = await page.evaluate((copiedHtml) => {
    const template = document.createElement('template');
    template.innerHTML = copiedHtml;
    return Array.from(
      template.content.querySelectorAll<HTMLElement>('section, h1, h2, p, li, th, td'),
      (element) => element.style.lineHeight,
    );
  }, html);
  expect(lineHeights.length).toBeGreaterThan(0);
  for (const lineHeight of lineHeights) {
    expect(lineHeight).toMatch(/^\d+(?:\.\d+)?px$/);
  }

  await chooseBackground(page, 'none');
  await page.locator('#copyBtn').click();
  await expect.poll(() => readClipboardHtml(page)).not.toContain('background-image:');
  const plainHtml = await readClipboardHtml(page);
  expect(plainHtml).toContain('background:#6f5df6');
  expect(plainHtml).not.toContain('background-size:');
});

test('divider can be resized from the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  const divider = page.getByRole('separator', { name: '调整编辑区与预览区宽度' });
  await divider.focus();
  await divider.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '45');
  await divider.press('ArrowRight');
  await divider.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '55');
});

test('narrow screens switch between editing and preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#preview h1')).toBeHidden();

  const views = page.getByRole('group', { name: '切换编辑或预览' });
  await views.getByRole('button', { name: '预览' }).click();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#editor')).toBeHidden();
  await expect(views.getByRole('button', { name: '预览' })).toHaveAttribute('aria-pressed', 'true');

  await views.getByRole('button', { name: '编辑' }).click();
  await expect(page.locator('#editor')).toBeVisible();
});
