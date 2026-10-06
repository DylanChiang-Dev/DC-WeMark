// 微信深色模式回歸測試：以預覽區的「深色」模擬（微信官方開源 mp-darkmode 演算法）
// 檢查三種輸出背景下的文字對比度，避免改顏色後又在深色模式糊成一片。
import { test, expect, type Page } from '@playwright/test';

const FIXTURE =
  '# 一级标题\n\n'
  + '正文 **重点** *斜体* ~~删除~~ `行内代码` [链接](https://example.com)[^1]\n\n'
  + '## 二级标题\n\n### 三级标题\n\n#### 四级标题\n\n##### 五级标题\n\n###### 六级标题\n\n'
  + '> 引用文字\n\n- 列表项目\n- [x] 已完成\n\n1. 有序项目\n\n'
  + '| 栏位 | 值 |\n|---|---|\n| A | B |\n\n'
  + '```\nfn main() {}\n```\n\n---\n\n[^1]: 注释内容\n';

const BACKGROUNDS = ['warm', 'grid', 'none'] as const;

async function openDarkPreview(page: Page, background: string): Promise<void> {
  await page.addInitScript((bg) => {
    localStorage.setItem('wemark:appearance-migration:v2', 'v2');
    localStorage.setItem('wemark:background:v1', bg);
  }, background);
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(FIXTURE);
  await expect(page.locator('#preview h6')).toHaveText('六级标题');
  await page.getByRole('group', { name: '预览配色' }).getByRole('button', { name: '深色' }).click();
  await expect(page.locator('#phone')).toHaveClass(/is-dark/);
  // 演算法以 class 套用深色樣式；等正文確實被轉成淺色字。
  await expect
    .poll(() => page.locator('#preview p').first().evaluate((el) => getComputedStyle(el).color))
    .not.toBe('rgb(44, 44, 44)');
  await expect(page.locator('#preview p').first()).toHaveClass(/js_darkmode/);
}

interface Sample {
  tag: string;
  text: string;
  color: string;
  chromatic: boolean;
  contrast: number;
}

/** 對預覽中每個含文字的元素，計算文字色與實際底色（往上找第一個不透明背景）的對比度。 */
async function sampleContrast(page: Page): Promise<Sample[]> {
  return page.locator('#preview').evaluate((root) => {
    const parse = (value: string) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(',').map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (x: number) => {
        const c = x / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const backgroundOf = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a > 0.5) return c;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    const samples: Sample[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      const color = getComputedStyle(el).color;
      const fg = parse(color)!;
      const bg = backgroundOf(el);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      samples.push({
        tag: el.tagName,
        text: node.textContent.trim().slice(0, 16),
        color,
        chromatic: !(fg.r === fg.g && fg.g === fg.b),
        contrast: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100,
      });
    }
    return samples;
  });
}

for (const background of BACKGROUNDS) {
  test(`WeChat dark mode keeps text readable on "${background}" background`, async ({ page }) => {
    await openDarkPreview(page, background);

    const article = page.locator('#preview > section');
    const articleBg = await article.evaluate((el) => getComputedStyle(el).backgroundColor);
    if (background === 'none') {
      expect(articleBg).toBe('rgba(0, 0, 0, 0)');
    } else {
      // 文章底色必須被轉暗，不能留在淺色（舊版近白偏色底就是卡在這裡）。
      const [r, g, b] = articleBg.match(/\d+/g)!.map(Number);
      expect(Math.max(r, g, b)).toBeLessThan(60);
    }

    const samples = await sampleContrast(page);
    expect(samples.length).toBeGreaterThan(15);
    // 無彩色文字（正文、標題、註釋、刪除線）須達 WCAG AA 4.5:1；
    // 強調色（連結、粗體、行內碼、章節標題）由使用者選色，至少 3:1。
    const failures = samples.filter((s) => s.contrast < (s.chromatic ? 3 : 4.5));
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });
}

test('dark preview does not change the copied HTML and can switch back', async ({
  page,
  context,
  browserName,
}) => {
  await openDarkPreview(page, 'warm');
  await expect(page.locator('#schemeNote')).toBeVisible();

  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#copyBtn').click();
    await expect(page.locator('#toast')).toHaveClass(/is-show/);
    const readHtml = () =>
      page.evaluate(async () => {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/html')) return (await item.getType('text/html')).text();
        }
        return '';
      });
    await expect.poll(readHtml).toContain('<section');
    const html = await readHtml();
    expect(html).toContain('background-color:#fafafa');
    expect(html).not.toContain('js_darkmode');
    expect(html).not.toContain('class=');
  }

  await page.reload();
  await expect(page.locator('#phone')).toHaveClass(/is-dark/, { timeout: 15_000 });
  await page.getByRole('group', { name: '预览配色' }).getByRole('button', { name: '浅色' }).click();
  await expect(page.locator('#phone')).not.toHaveClass(/is-dark/);
  await expect(page.locator('#schemeNote')).toBeHidden();
  await expect(page.locator('#preview p').first()).not.toHaveClass(/js_darkmode/);
  await expect(page.locator('#preview > section')).toHaveCSS('background-color', 'rgb(250, 250, 250)');
});

test('grid background explains that grid lines disappear in dark mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '排版设置' }).click();
  await expect(
    page.locator('input[name="backgroundStyle"][value="grid"]').locator('..'),
  ).toContainText('深色模式下不显示格线');
});
