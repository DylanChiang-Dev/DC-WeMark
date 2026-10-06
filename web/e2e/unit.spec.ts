// 純函式單元測試：在 Node 端直接執行，不開瀏覽器。
import { test, expect } from '@playwright/test';

import { debouncedSaveDraft, loadDraft } from '../src/storage';
import { countWords } from '../src/util';

test.describe('countWords', () => {
  test('counts CJK characters one by one and other words by whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('你好世界')).toBe(4);
    expect(countWords('hello world')).toBe(2);
    expect(countWords('用 Rust 寫 WASM')).toBe(4);
    expect(countWords('# 標題\n\n- item')).toBe(5);
  });
});

test.describe('debouncedSaveDraft', () => {
  test.beforeEach(() => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  test('flush writes the latest pending text immediately', () => {
    const saver = debouncedSaveDraft(60_000);
    saver.save('第一版');
    saver.save('第二版');
    expect(loadDraft()).toBeNull();
    saver.flush();
    expect(loadDraft()).toBe('第二版');
  });

  test('flush without pending text keeps the stored draft', () => {
    const saver = debouncedSaveDraft(60_000);
    saver.save('已存');
    saver.flush();
    localStorage.setItem('wemark:draft:v1', '外部更新');
    saver.flush();
    expect(loadDraft()).toBe('外部更新');
  });

  test('debounced save eventually writes', async () => {
    const saver = debouncedSaveDraft(10);
    saver.save('延遲寫入');
    await expect.poll(() => loadDraft()).toBe('延遲寫入');
  });
});
