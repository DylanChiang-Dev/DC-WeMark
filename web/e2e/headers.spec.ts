// 以 public/_headers（Cloudflare Pages 會套用的標頭）服務建置產物，
// 確認 CSP 不會擋掉 WASM、預覽與樣式。需先執行 `npm run build`。
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
};

function rootHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let inRoot = false;
  for (const line of readFileSync(join(dist, '_headers'), 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    if (!/^\s/.test(line)) {
      inRoot = line.trim() === '/*';
      continue;
    }
    if (inRoot) {
      const i = line.indexOf(':');
      headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return headers;
}

let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  test.skip(!existsSync(join(dist, '_headers')), 'run `npm run build` first');
  const headers = rootHeaders();
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const file = normalize(join(dist, path === '/' ? 'index.html' : path));
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(file)] ?? 'text/plain' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address === 'object') origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(() => {
  server?.close();
});

test('built site works under the Cloudflare Pages CSP', async ({ page }) => {
  expect(rootHeaders()['Content-Security-Policy']).toContain("'wasm-unsafe-eval'");
  const violations: string[] = [];
  await page.exposeFunction('reportViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { reportViolation(v: string): void }).reportViolation(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  await page.goto(`${origin}/`);
  await expect(page.locator('#preview h1')).toBeVisible({ timeout: 15_000 });
  await page
    .locator('#editor')
    .fill('# CSP 測試\n\n![圖](https://example.com/a.png)\n\n```js\nconst a = 1;\n```\n');
  await expect(page.locator('#preview h1')).toHaveText('CSP 測試');
  // 延遲載入的高亮引擎也必須通過 CSP。
  await expect
    .poll(() => page.locator('#preview pre span[style*="color"]').count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(violations).toEqual([]);
});
