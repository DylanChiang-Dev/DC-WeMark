import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
}

test('Tab indent and bold shortcut can be undone', async ({ page }) => {
  await ready(page);
  const editor = page.locator('#editor');
  await editor.fill('第一行');
  await editor.press('Home');
  await editor.press('Tab');
  await expect(editor).toHaveValue('  第一行');
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue('第一行');

  await editor.press('ControlOrMeta+a');
  await editor.press('ControlOrMeta+b');
  await expect(editor).toHaveValue('**第一行**');
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue('第一行');
});

test('importing a file replaces the draft and can be undone', async ({ page }) => {
  await ready(page);
  const editor = page.locator('#editor');
  await editor.fill('# 原本的草稿');
  await page.locator('#fileInput').setInputFiles({
    name: 'other.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 匯入的文章\r\n\r\n內文'),
  });
  await expect(editor).toHaveValue('# 匯入的文章\n\n內文');
  await expect(page.locator('#toast')).toContainText('撤销');
  await expect(page.locator('#preview h1')).toHaveText('匯入的文章');

  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue('# 原本的草稿');
});

test('clearing the draft via word count can be undone', async ({ page }) => {
  await ready(page);
  const editor = page.locator('#editor');
  await editor.fill('# 要保留的內容');
  await page.locator('#wordcount').dblclick();
  await expect(editor).not.toHaveValue('# 要保留的內容');
  await expect(page.locator('#toast')).toContainText('撤销');
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue('# 要保留的內容');
});

test('draft is saved immediately when the page is left', async ({ page }) => {
  await ready(page);
  await page.locator('#editor').fill('# 剛打完就重新整理');
  // 不等 debounce：pagehide / visibilitychange 應立即寫入。
  await page.reload();
  await expect(page.locator('#editor')).toHaveValue('# 剛打完就重新整理');
});

test('unsafe links are stripped and reported', async ({ page }) => {
  await ready(page);
  await page.locator('#editor').fill('點 [這裡](javascript:alert(1)) 看看');
  await expect(page.locator('#preview')).toContainText('這裡');
  await expect(page.locator('#preview a')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveClass(/is-warning/);
  await expect(page.locator('#status')).toContainText('不安全的链接');
});

test('local images warn about WeChat upload', async ({ page }) => {
  await ready(page);
  await page.locator('#editor').fill('![封面](./cover.png)');
  await expect(page.locator('#status')).toHaveClass(/is-warning/);
  await expect(page.locator('#status')).toContainText('本地或相对路径');
});

test('markdown footnotes and simplified output titles', async ({ page }) => {
  await ready(page);
  await page
    .locator('#editor')
    .fill('正文[^1] 與 [Rust](https://www.rust-lang.org)\n\n[^1]: 補充說明\n');
  // 主要使用者以簡體為主：預設輸出簡體字形，可切換為繁體並保存。
  await expect(page.locator('#preview')).toContainText('[注1]');
  await expect(page.locator('#preview')).toContainText('注释');
  await expect(page.locator('#preview')).toContainText('参考链接');

  await page.locator('#settingsBtn').click();
  await page.locator('[data-locale="hant"]').click();
  await expect(page.locator('[data-locale="hant"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview')).toContainText('參考連結');
  await expect(page.locator('#preview')).toContainText('[註1]');

  await page.reload();
  await expect(page.locator('#preview')).toContainText('參考連結', { timeout: 15_000 });
});

test('highlighter is not downloaded for articles without code', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await ready(page);
  await page.locator('#editor').fill('# 純文字文章\n\n沒有程式碼。');
  await expect(page.locator('#preview h1')).toHaveText('純文字文章');
  expect(requests.filter((url) => url.includes('wemark_highlight'))).toEqual([]);
});

test('code blocks are colour highlighted after lazy loading', async ({ page }) => {
  await ready(page);
  await page.locator('#editor').fill('```rust\nfn main() { let x = 1; }\n```\n');
  const coloured = page.locator('#preview pre span[style*="color"]');
  await expect.poll(() => coloured.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.locator('#preview pre')).toContainText('fn main()');
  await expect(page.locator('#status')).not.toContainText('加载中');
});
