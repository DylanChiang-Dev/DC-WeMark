// 微信深色模式預覽：以微信公眾平台官方開源的 mp-darkmode 演算法轉換預覽區。
// 只改預覽 DOM 的 class 與注入的樣式，不影響複製出去的 HTML；演算法延遲載入。

interface DarkmodeApi {
  run(nodes: ArrayLike<Element>, options?: Record<string, unknown>): void;
}

/** 微信深色模式的頁面底色（mp-darkmode 預設值）。 */
export const WECHAT_DARK_BG = '#191919';

let api: DarkmodeApi | undefined;
let loader: Promise<void> | undefined;
let configured = false;
let injected: HTMLStyleElement[] = [];

export function isDarkmodeReady(): boolean {
  return api !== undefined;
}

export function loadDarkmode(): Promise<void> {
  loader ??= import('mp-darkmode').then(
    (mod) => {
      // UMD 套件經打包後可能落在 default 或模組本身。
      const candidate = ((mod as { default?: unknown }).default ?? mod) as Partial<DarkmodeApi>;
      if (typeof candidate.run !== 'function') throw new Error('mp-darkmode 缺少 run()');
      api = candidate as DarkmodeApi;
    },
    (err: unknown) => {
      loader = undefined; // 允許之後重試
      throw err;
    },
  );
  return loader;
}

/** 對預覽根節點套用深色轉換；每次重繪後呼叫，並移除上一輪注入的樣式避免累積。 */
export function applyWechatDark(root: HTMLElement): void {
  if (!api) throw new Error('mp-darkmode 尚未載入');
  const before = new Set(document.querySelectorAll('style'));
  // 設定只能給一次；關閉首屏判斷，否則捲動容器內的段落會被延後處理。
  api.run(
    root.querySelectorAll('*'),
    configured ? undefined : { mode: 'dark', needJudgeFirstPage: false },
  );
  configured = true;
  clearWechatDark();
  injected = Array.from(document.querySelectorAll('style')).filter((s) => !before.has(s));
}

/** 移除注入的深色樣式（切回淺色或重繪前）。 */
export function clearWechatDark(): void {
  for (const style of injected) style.remove();
  injected = [];
}
