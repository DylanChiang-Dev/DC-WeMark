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

test('switching theme changes preview styling', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  const pills = page.locator('.theme-pill');
  await expect(pills).toHaveCount(1);
  await expect(pills.first()).toHaveText('蘋果風');
  await expect(pills.first()).toHaveAttribute('aria-selected', 'true');
});

test('Apple theme renders soft white by default and keeps grid optional', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const article = page.locator('#preview > section');
  await expect(article).toHaveCSS('background-color', 'rgb(247, 247, 245)');
  await expect(article).toHaveCSS('background-image', 'none');

  const background = page.getByLabel('複製背景');
  await background.selectOption('grid');
  await expect(article).toHaveCSS('background-image', /linear-gradient/);
  await expect(article).toHaveCSS('background-size', /^24px 24px(?:, 24px 24px)?$/);
  await expect(page.locator('#editor')).toHaveCSS('background-image', 'none');
});

test('background style can switch between grid, warm, and none', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const background = page.getByLabel('複製背景');
  const article = page.locator('#preview > section');
  await expect(background).toHaveValue('warm');

  await background.selectOption('warm');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgb(247, 247, 245)');

  await background.selectOption('none');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(background).toHaveValue('none');
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
    'rgb(247, 247, 245)',
  );
  await page.getByRole('button', { name: '排版設定' }).click();
  await expect(page.getByRole('dialog', { name: '排版設定' })).toBeVisible();
  await expect(page.getByRole('switch', { name: '雙向捲動同步' })).not.toBeChecked();

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

  await page.getByRole('button', { name: '關閉排版設定' }).click();
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
  await page.getByRole('button', { name: '排版設定' }).click();

  const panel = page.getByRole('dialog', { name: '排版設定' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('#themeTotal')).toHaveText('1');
  await expect(panel.locator('.theme-option')).toHaveCount(1);
  await expect(panel.locator('.theme-option__palette > span')).toHaveCount(3);
  const themeGallery = panel.locator('#themeGallery');
  await expect(themeGallery.getByRole('button', { name: /蘋果風/ })).toBeVisible();
  await expect(panel.locator('[data-theme-group]')).toHaveCount(0);
  await expect(panel.locator('text=霧銀')).toHaveCount(0);
  await expect(panel.locator('text=躍藍')).toHaveCount(0);
  await expect(panel.locator('#currentThemeName')).toHaveText('蘋果風');
  await expect(page.locator('#preview h2').first()).toHaveAttribute(
    'style',
    /linear-gradient\(135deg,#1677ff/i,
  );
});

test('font size and scroll sync preferences persist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版設定' }).click();

  const fontSizes = page.getByRole('group', { name: '文章字級' });
  await fontSizes.getByRole('button', { name: '小' }).click();
  await expect(page.locator('#preview > section')).toHaveCSS('font-size', '14px');

  const sync = page.getByRole('switch', { name: '雙向捲動同步' });
  await expect(sync).toBeChecked();
  await sync.uncheck();

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#preview > section')).toHaveCSS('font-size', '14px');
  await page.getByRole('button', { name: '排版設定' }).click();
  await expect(page.getByRole('switch', { name: '雙向捲動同步' })).not.toBeChecked();
});

test('font and named accent choices are visual and persist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版設定' }).click();

  const fontFamily = page.getByRole('group', { name: '文章字體' });
  await fontFamily.getByRole('button', { name: '刊物宋體' }).click();
  await expect(page.locator('#preview > section')).toHaveAttribute(
    'style',
    /font-family:Georgia,Songti SC/,
  );

  const accentPresets = page.getByRole('group', { name: '強調色' });
  await expect(page.locator('#accent')).toHaveAttribute('type', 'color');
  await accentPresets.getByRole('button', { name: '藍色' }).click();
  await expect(page.locator('#preview strong').first()).toHaveAttribute('style', /#2563eb/i);
  await expect(page.locator('#preview h2').first()).toHaveAttribute(
    'style',
    /linear-gradient\(135deg,#1677ff/i,
  );

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#preview > section')).toHaveAttribute(
    'style',
    /font-family:Georgia,Songti SC/,
  );
  await page.getByRole('button', { name: '排版設定' }).click();
  await expect(fontFamily.getByRole('button', { name: '刊物宋體' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(accentPresets.getByRole('button', { name: '藍色' })).toHaveAttribute(
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

  const copyright = page.getByLabel('版權與作者連結');
  await expect(copyright).toContainText('© 2026 Dylan Chiang');
  await expect(copyright.getByRole('link', { name: '個人首頁' })).toHaveAttribute(
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
  await expect(page.locator('#preview h2')).toHaveAttribute('style', /linear-gradient/);
  await expect(page.locator('#preview img')).toHaveAttribute('style', /box-shadow/);

  const phoneMetrics = await page.locator('#preview').evaluate((article) => ({
    width: article.clientWidth,
    scrollWidth: article.scrollWidth,
    imageWidth: article.querySelector('img')?.getBoundingClientRect().width ?? 0,
  }));
  expect(phoneMetrics.scrollWidth).toBeLessThanOrEqual(phoneMetrics.width);
  expect(phoneMetrics.imageWidth).toBeLessThanOrEqual(phoneMetrics.width);

  await page.getByRole('button', { name: '寬版' }).click();
  await expect(page.locator('#phone')).toHaveClass(/is-wide/);
  const wideMetrics = await page.locator('#preview').evaluate((article) => ({
    width: article.clientWidth,
    scrollWidth: article.scrollWidth,
  }));
  expect(wideMetrics.scrollWidth).toBeLessThanOrEqual(wideMetrics.width);
});

test('copy writes text/html to the clipboard', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit blocks clipboard read in automation');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(
    '# 複製測試\n\n## 章節\n\n> 引用\n\n- [x] 任務\n\n| 欄位 | 值 |\n|---|---|\n| A | B |\n',
  );
  await page.locator('#copyBtn').click();
  await expect(page.locator('#toast')).toHaveClass(/is-show/);

  const html = await readClipboardHtml(page);
  expect(html).toContain('<section');
  expect(html).toContain('複製測試');
  expect(html).toContain('data-darkmode-color="#a3a3a3"');
  expect(html).toContain('data-darkmode-bgcolor="#191919"');
  expect(html).toContain('background-color:#f7f7f5');
  expect(html).toContain('background:linear-gradient(135deg,#1677ff');
  expect(html).not.toContain('class=');
  expect(html).not.toContain('<style');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('position:');
  // font-family 的雙引號必須轉義；否則瀏覽器會把 style 屬性解析壞掉，
  // 產生像 `ui"=""` 這種殘骸（貼進公眾號會失真）。
  expect(html).not.toMatch(/="">/);
  expect(html).not.toContain('font-family:"');

  await page.getByLabel('複製背景').selectOption('none');
  await page.locator('#copyBtn').click();
  await expect.poll(() => readClipboardHtml(page)).not.toContain('background-image:');
  const plainHtml = await readClipboardHtml(page);
  expect(plainHtml).toContain('background:linear-gradient(135deg,#1677ff');
  expect(plainHtml).not.toContain('background-size:');
});
