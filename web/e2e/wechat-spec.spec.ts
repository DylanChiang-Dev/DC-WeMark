// 公眾號「第三方平台排版规范」回歸測試：
// https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html
// 以複製出去的 HTML，在官方檢測工具（wechatjs/verify-article-structure-spec）使用的
// 三種寬度下量測，重現其中與本專案相關的規則：
//   #1.3 line-height 疊字（多行且平均行高 < 0.95 × 字號）
//        另含公眾號貼上檢測仍在用的舊版兜底量測（0.2.16）：對有直接文字的區塊
//        不歸併行內片段，片段數即行數，夾著 code／sup 的段落會被誤報。
//   #1.8 pre 水平溢出
//   #1.4 段落水平溢出
//   #4.1.2 文字背景漸層（須以 data-ignore-dm 聲明）
import { test, expect, type Page } from '@playwright/test';

const SCREENS = [375, 585, 677];

const FIXTURE =
  '# 结构检测用的长标题，故意写长让它在手机宽度下折成多行显示\n\n'
  + '一段很长的正文，用来确认多行文字的行高。这里再补一些文字让它折成三到四行，包含 **粗体强调**、*斜体*、~~删除线~~、`行内代码` 与 [外部链接](https://example.com)，以及英文 English words mixed in.\n\n'
  + '## 很长的二级标题，确认章节标题折行后行距足够不会叠字\n\n'
  + '### 三级标题也写长一点，确认左侧竖线与多行文字\n\n'
  + '#### 四级标题同样写长，看看强调色标题折行后的行距\n\n'
  + '> 引用段落写得够长，让它折成多行显示，检查引用区块中的行高是否会导致文字重叠。\n\n'
  + '- 列表项目写长一点，让它在手机上折成多行，确认列表项目的行高\n'
  + '  - 嵌套列表项目同样写长一点以便折成多行显示\n'
  + '- [x] 已完成的任务项目\n\n'
  + '1. 宽松列表第一项，写长一点让它在手机上折成多行显示\n\n'
  + '2. 宽松列表第二项\n\n'
  + '| 栏位 | 很长的说明 |\n|---|---|\n| 排版 | 这个单元格写长一点让它在窄屏下折成多行显示 |\n\n'
  + '```\n'
  + 'const message = "这是一行非常非常长的程式码字串，用来确认代码块在手机宽度下会自动换行而不是水平溢出";\n'
  + 'https://example.com/a/very/long/path/without/any/spaces/that/must/wrap/inside/the/code/block\n'
  + '```\n\n'
  + '正文脚注[^1]。\n\n[^1]: 脚注内容写得长一点，让它在手机上折成多行，检查脚注区域的行高。\n';

async function copiedHtml(page: Page, background: string, fontSize: string): Promise<string> {
  await page.addInitScript(
    ([bg, size]) => {
      localStorage.setItem('wemark:appearance-migration:v2', 'v2');
      localStorage.setItem('wemark:background:v1', bg);
      localStorage.setItem('wemark:font-size:v1', size);
    },
    [background, fontSize],
  );
  await page.goto('/');
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page.locator('#editor').fill(FIXTURE);
  await expect(page.locator('#preview h1')).toContainText('结构检测');
  return page.evaluate(async () => {
    let html = '';
    Object.defineProperty(navigator.clipboard, 'write', {
      configurable: true,
      value: async (items: ClipboardItem[]) => {
        html = await (await items[0].getType('text/html')).text();
      },
    });
    const preview = document.getElementById('preview')!;
    const modulePath = '/src/clipboard.ts';
    const { copyHtml } = await import(modulePath);
    await copyHtml(preview.innerHTML, '');
    return html;
  });
}

interface Finding {
  rule: string;
  width: number;
  detail: string;
}

/** 依官方檢測工具的量測方式，回傳違規清單。 */
async function inspect(page: Page, html: string): Promise<Finding[]> {
  return page.evaluate(
    ({ html, screens }) => {
      const findings: Finding[] = [];
      const style = document.createElement('style');
      style.textContent =
        '.rich_media_content *{max-width:100%!important;box-sizing:border-box!important;word-wrap:break-word!important}';
      document.head.append(style);
      const sandbox = document.createElement('div');
      sandbox.className = 'rich_media_content';
      Object.assign(sandbox.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        boxSizing: 'border-box',
        fontSize: '17px',
        textAlign: 'justify',
        overflow: 'hidden',
      });
      sandbox.innerHTML = html;
      document.body.append(sandbox);

      // 官方 Rule B：以 Range 量測行框，按垂直重疊 >50% 合併為同一行。
      const overlap = (node: Element) => {
        const fontSize = parseFloat(getComputedStyle(node).fontSize);
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter((r) => r.height > 0 && r.width > 0);
        const lines: Array<{ top: number; bottom: number }> = [];
        for (const r of rects) {
          const hit = lines.find((l) => {
            const o = Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top);
            return o > Math.min(l.bottom - l.top, r.height) * 0.5;
          });
          if (hit) {
            hit.top = Math.min(hit.top, r.top);
            hit.bottom = Math.max(hit.bottom, r.bottom);
          } else lines.push({ top: r.top, bottom: r.bottom });
        }
        if (lines.length < 2) return null;
        const avg = range.getBoundingClientRect().height / lines.length;
        return avg < fontSize * 0.95 ? `${avg.toFixed(1)} < 0.95 × ${fontSize}` : null;
      };

      // 舊版兜底：只看有直接文字的區塊，每個非零高 rect 都算一行。
      const blockTags = new Set(['P', 'DIV', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'A']);
      const legacyOverlap = (node: Element) => {
        if (!blockTags.has(node.tagName)) return null;
        const direct = Array.from(node.childNodes).some(
          (c) => c.nodeType === Node.TEXT_NODE && !!c.textContent?.trim(),
        );
        if (!direct) return null;
        const fontSize = parseFloat(getComputedStyle(node).fontSize);
        const range = document.createRange();
        range.selectNodeContents(node);
        const count = Array.from(range.getClientRects()).filter((r) => r.height > 0).length;
        if (count < 2) return null;
        const avg = range.getBoundingClientRect().height / count;
        return avg < fontSize * 0.95 ? `${avg.toFixed(1)} < 0.95 × ${fontSize}` : null;
      };

      for (const width of screens) {
        sandbox.style.width = `${width}px`;
        for (const node of sandbox.querySelectorAll('*')) {
          if (!node.textContent?.trim()) continue;
          const hit = overlap(node);
          if (hit) findings.push({ rule: 'line-height', width, detail: `${node.tagName} ${hit}` });
          const legacy = legacyOverlap(node);
          if (legacy) findings.push({ rule: 'line-height-legacy', width, detail: `${node.tagName} ${legacy}` });
        }
        for (const pre of sandbox.querySelectorAll('pre')) {
          if (pre.scrollWidth > pre.clientWidth + 1) {
            findings.push({ rule: 'pre-overflow', width, detail: `${pre.scrollWidth} > ${pre.clientWidth}` });
          }
        }
        const right = sandbox.getBoundingClientRect().right;
        for (const block of sandbox.querySelectorAll('section, p, h1, h2, h3, h4, h5, h6, li, table, blockquote')) {
          if (block.getBoundingClientRect().right > right + 1) {
            findings.push({ rule: 'width-overflow', width, detail: block.tagName });
          }
        }
      }
      for (const el of sandbox.querySelectorAll<HTMLElement>('[style]')) {
        if (/gradient\(/.test(el.style.backgroundImage) && el.textContent?.trim()) {
          const ignored = (el.getAttribute('data-ignore-dm') ?? '').split(/\s+/);
          if (!ignored.includes('text-bg-gradient')) {
            findings.push({ rule: 'text-bg-gradient', width: 0, detail: el.tagName });
          }
        }
      }
      sandbox.remove();
      style.remove();
      return findings;
    },
    { html, screens: SCREENS },
  );
}

for (const [background, fontSize] of [
  ['warm', 'medium'],
  ['grid', 'small'],
  ['none', 'large'],
] as const) {
  test(`copied HTML follows the WeChat layout spec (${background}, ${fontSize})`, async ({ page }) => {
    const html = await copiedHtml(page, background, fontSize);
    expect(html).toContain('<pre');
    const findings = await inspect(page, html);
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });
}

test('the spec check catches undersized line heights and overflowing code', async ({ page }) => {
  await page.goto('/');
  // 反例：確認量測本身會抓到違規，避免測試永遠綠燈。
  const findings = await inspect(
    page,
    '<section style="font-size:16px;line-height:12px;">'
      + '一段很长很长的文字，一段很长很长的文字，一段很长很长的文字，一段很长很长的文字，一段很长很长的文字。</section>'
      + '<p style="font-size:16px;line-height:30px;">装好后，从 <code>boya</code> 开始。</p>'
      + '<pre style="white-space:pre;">' + 'x'.repeat(400) + '</pre>'
      + '<section style="background-image:linear-gradient(#fff,#eee);">渐变上的文字</section>',
  );
  const rules = new Set(findings.map((f) => f.rule));
  expect(rules).toEqual(new Set(['line-height', 'line-height-legacy', 'pre-overflow', 'text-bg-gradient']));
});
