import { test, expect } from '@playwright/test';

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

test('warm theme renders a square-paper article background', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: '暖陽' }).click();

  const article = page.locator('#preview > section');
  await expect(article).toHaveCSS('background-image', /linear-gradient/);
  await expect(article).toHaveCSS('background-size', '24px 24px, 24px 24px');
  await expect(page.locator('#editor')).toHaveCSS('background-image', 'none');
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

test('inserting a module renders a container in the preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill('# 標題\n');
  await page.selectOption('#insertModule', 'warn');
  // warn 容器外殼帶琥珀色左邊條
  await expect(page.locator('#preview section[style*="#f59e0b"]')).toBeVisible();
});

test('copy writes text/html to the clipboard', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit blocks clipboard read in automation');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: '暖陽' }).click();
  await page.locator('#editor').fill('# 複製測試\n\n**粗體**內容。');
  await page.locator('#copyBtn').click();
  await expect(page.locator('#toast')).toHaveClass(/is-show/);

  const html = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        return await blob.text();
      }
    }
    return '';
  });
  expect(html).toContain('<section');
  expect(html).toContain('複製測試');
  expect(html).toContain('background-image:linear-gradient');
  expect(html).toContain('background-size:24px 24px');
  expect(html).not.toContain('class=');
  // font-family 的雙引號必須轉義；否則瀏覽器會把 style 屬性解析壞掉，
  // 產生像 `ui"=""` 這種殘骸（貼進公眾號會失真）。
  expect(html).not.toMatch(/="">/);
  expect(html).not.toContain('font-family:"');
});
