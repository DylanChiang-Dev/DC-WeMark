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
  const count = await pills.count();
  expect(count).toBeGreaterThan(0);
  const rootStyleBefore = await page.locator('#preview > section').getAttribute('style');
  if (count > 1) {
    await pills.nth(1).click();
    const rootStyleAfter = await page.locator('#preview > section').getAttribute('style');
    expect(rootStyleAfter).not.toEqual(rootStyleBefore);
  }
});

test('all themes render a square-paper article background', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const article = page.locator('#preview > section');
  const themes = page.locator('.theme-pill');
  const themeCount = await themes.count();
  for (let index = 0; index < themeCount; index += 1) {
    await themes.nth(index).click();
    await expect(article).toHaveCSS('background-image', /linear-gradient/);
    await expect(article).toHaveCSS('background-size', '24px 24px, 24px 24px');
  }
  await expect(page.locator('#editor')).toHaveCSS('background-image', 'none');
});

test('background style can switch between grid, warm, and none', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });

  const background = page.getByLabel('複製背景');
  const article = page.locator('#preview > section');
  await expect(background).toHaveValue('grid');

  await background.selectOption('warm');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgb(255, 248, 238)');

  await background.selectOption('none');
  await expect(article).toHaveCSS('background-image', 'none');
  await expect(article).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.reload();
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await expect(background).toHaveValue('none');
  await expect(article).toHaveCSS('background-image', 'none');
});

test('settings expose 48 original theme presets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '排版設定' }).click();

  const panel = page.getByRole('dialog', { name: '排版設定' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('#themeTotal')).toHaveText('48');
  await expect(panel.locator('.theme-option')).toHaveCount(6);
  await expect(panel.locator('.theme-option__palette > span')).toHaveCount(18);
  const themeGallery = panel.locator('#themeGallery');
  const mist = themeGallery.getByRole('button', { name: /霧銀/ });
  const pulse = themeGallery.getByRole('button', { name: /躍藍/ });
  await expect(mist).toBeVisible();
  await expect(pulse).toBeVisible();

  await pulse.click();
  await expect(panel.locator('#currentThemeName')).toHaveText('躍藍');
  await expect(page.locator('#preview h1')).toHaveAttribute(
    'style',
    /border-left:5px solid #1673d1/i,
  );

  await mist.click();
  await expect(panel.locator('#currentThemeName')).toHaveText('霧銀');
  await expect(page.locator('#preview h1')).toHaveAttribute(
    'style',
    /border-bottom:1px solid #49647a/i,
  );

  await panel.getByRole('tab', { name: /精選/ }).click();
  await expect(panel.locator('.theme-option')).toHaveCount(10);
  await panel.getByRole('tab', { name: /模板/ }).click();
  await expect(panel.locator('.theme-option')).toHaveCount(32);

  await panel.locator('[data-theme-id="airy-blue"]').click();
  await expect(panel.locator('#currentThemeName')).toHaveText('留白藍');
  await expect(page.locator('#preview h1')).toHaveAttribute('style', /#2563eb/i);
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
  await accentPresets.getByRole('button', { name: '躍藍' }).click();
  await expect(page.locator('#preview h2').first()).toHaveAttribute('style', /#1673d1/i);

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
  await expect(accentPresets.getByRole('button', { name: '躍藍' })).toHaveAttribute(
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

test('copy writes text/html to the clipboard', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit blocks clipboard read in automation');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(
    '# 複製測試\n\n> 引用\n\n- [x] 任務\n\n| 欄位 | 值 |\n|---|---|\n| A | B |\n',
  );
  await page.locator('#copyBtn').click();
  await expect(page.locator('#toast')).toHaveClass(/is-show/);

  const html = await readClipboardHtml(page);
  expect(html).toContain('<section');
  expect(html).toContain('複製測試');
  expect(html).toContain('background-image:linear-gradient');
  expect(html).toContain('background-size:24px 24px');
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
  expect(plainHtml).not.toContain('background-size:');
});
