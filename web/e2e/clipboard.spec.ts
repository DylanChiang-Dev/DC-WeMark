import { test, expect } from '@playwright/test';

const markdown = '# 一級標題\n\n## 二級標題\n\n### 三級標題\n\n'
  + '#### 四級標題\n\n##### 五級標題\n\n###### 六級標題\n\n'
  + '多行段落 **重點**、*斜體*、~~刪除~~、`行內碼` 與 [外鏈](https://example.com)。  \n'
  + '第二行文字。\n\n> 引用段落  \n> 引用第二行。\n\n'
  + '- 清單一\n- [x] 清單二\n\n'
  + '| 欄位 | 值 |\n| --- | --- |\n| A | B |\n\n'
  + '```rust\nfn main() {\n    println!("兩行程式碼");\n}\n```';

for (const fontSize of ['small', 'medium', 'large']) {
  test(`copy resolves line heights for ${fontSize} text without changing preview`, async ({ page }) => {
    await page.addInitScript((size) => {
      localStorage.setItem('wemark:appearance-migration:v2', 'v2');
      localStorage.setItem('wemark:font-size:v1', size);
    }, fontSize);
    await page.goto('/');
    await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
    await page.locator('#editor').fill(markdown);
    await expect(page.locator('#preview h6')).toHaveText('六級標題');

    const result = await page.evaluate(async (plain) => {
      const article = document.querySelector<HTMLElement>('#preview > section')!;
      const before = article.outerHTML;
      const previewMetrics = Array.from(article.querySelectorAll<HTMLElement>('*'), (element) => {
        const style = getComputedStyle(element);
        return { tag: element.tagName, fontSize: style.fontSize, lineHeight: style.lineHeight };
      });
      let copiedHtml = '';
      let copiedPlain = '';
      Object.defineProperty(navigator.clipboard, 'write', {
        configurable: true,
        value: async (items: ClipboardItem[]) => {
          copiedHtml = await (await items[0].getType('text/html')).text();
          copiedPlain = await (await items[0].getType('text/plain')).text();
        },
      });
      const modulePath = '/src/clipboard.ts';
      const { copyHtml } = await import(modulePath);
      const via = await copyHtml(before, plain);
      const holder = document.createElement('div');
      holder.innerHTML = copiedHtml;
      document.body.appendChild(holder);
      try {
        return {
          via,
          copiedPlain,
          unchanged: article.outerHTML === before,
          previewMetrics,
          elements: Array.from(holder.querySelector('section')!.querySelectorAll<HTMLElement>('*'), (element) => {
            const style = getComputedStyle(element);
            return {
              tag: element.tagName,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              inlineLineHeight: element.style.lineHeight,
              hasText: !!element.textContent?.trim(),
            };
          }),
          rootLineHeight: holder.querySelector<HTMLElement>('section')!.style.lineHeight,
        };
      } finally {
        holder.remove();
      }
    }, markdown);

    expect(result.via).toBe('clipboard-api');
    expect(result.copiedPlain).toBe(markdown);
    expect(result.unchanged).toBe(true);
    expect(result.rootLineHeight).toMatch(/^\d+(?:\.\d+)?px$/);
    expect(result.elements).toHaveLength(result.previewMetrics.length);
    result.elements.forEach((element, index) => {
      const original = result.previewMetrics[index];
      expect(element.tag).toBe(original.tag);
      expect(element.fontSize).toBe(original.fontSize);
      // WebKit 的相對字級計算會有微小的浮點誤差。
      expect(parseFloat(element.lineHeight)).toBeCloseTo(parseFloat(original.lineHeight), 4);
    });
    for (const element of result.elements.filter((element) => element.hasText)) {
      expect(element.inlineLineHeight, element.tag).toMatch(/^\d+(?:\.\d+)?px$/);
      expect(parseFloat(element.lineHeight), element.tag).toBeGreaterThanOrEqual(parseFloat(element.fontSize));
    }
  });
}

test('fallback copy uses the same pixel line heights and removes temporary elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator.clipboard, 'write', {
      configurable: true,
      value: async () => { throw new Error('clipboard denied'); },
    });
    let copiedHtml = '';
    document.execCommand = (command: string) => {
      if (command !== 'copy') return false;
      const selection = window.getSelection()!;
      const holder = document.createElement('div');
      holder.appendChild(selection.getRangeAt(0).cloneContents());
      copiedHtml = holder.innerHTML;
      return true;
    };
    const before = document.body.childElementCount;
    const modulePath = '/src/clipboard.ts';
    const { copyHtml } = await import(modulePath);
    const via = await copyHtml(
      '<section style="font-size:16px;line-height:1.9;"><p>段落<br>第二行</p>'
        + '<pre style="font-size:14px;line-height:1.65;">第一行\n第二行</pre></section>',
      '段落',
    );
    const holder = document.createElement('div');
    holder.innerHTML = copiedHtml;
    return {
      via,
      unchangedChildCount: before === document.body.childElementCount,
      lineHeights: Array.from(holder.querySelectorAll<HTMLElement>('section, p, pre'), (element) => element.style.lineHeight),
    };
  });
  expect(result.via).toBe('exec-command');
  expect(result.unchangedChildCount).toBe(true);
  expect(result.lineHeights).toEqual(['30.4px', '30.4px', '23.1px']);
});

test('copy keeps fixed line-height inheritance and clamps undersized line heights', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  const result = await page.evaluate(async () => {
    let html = '';
    Object.defineProperty(navigator.clipboard, 'write', {
      configurable: true,
      value: async (items: ClipboardItem[]) => {
        html = await (await items[0].getType('text/html')).text();
      },
    });
    const modulePath = '/src/clipboard.ts';
    const { copyHtml } = await import(modulePath);
    await copyHtml(
      '<section style="font-size:16px;line-height:150%;">'
        + '<p style="font-size:20px;">固定行高</p>'
        + '<p style="line-height:2em;"><strong style="font-size:20px;">em 行高</strong></p>'
        + '<p style="font-size:18px;line-height:10px;">過小行高</p></section>',
      '固定行高',
    );
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.querySelectorAll<HTMLElement>('section, p, strong'), (element) => element.style.lineHeight);
  });
  expect(result).toEqual(['24px', '24px', '32px', '32px', '18px']);
});

test('copy preparation does not load remote images', async ({ page }) => {
  let imageRequests = 0;
  await page.route('**/clipboard-image.png', async (route) => {
    imageRequests++;
    await route.abort();
  });
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async () => {
    Object.defineProperty(navigator.clipboard, 'write', {
      configurable: true,
      value: async () => {},
    });
    const modulePath = '/src/clipboard.ts';
    const { copyHtml } = await import(modulePath);
    await copyHtml(
      '<section style="font-size:16px;line-height:1.9;">'
        + '<img src="/clipboard-image.png" alt="圖片">段落</section>',
      '段落',
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  expect(imageRequests).toBe(0);
});
