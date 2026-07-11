// 一鍵複製：以 text/html 寫入剪貼簿，貼進公眾號編輯器保留樣式。
// 三層策略：ClipboardItem（含 Safari 的 promise-valued 形式）→ execCommand 後備。

export type CopyResult = 'clipboard-api' | 'exec-command';

/**
 * 把 HTML 片段以 text/html + text/plain 寫入剪貼簿。
 * 在使用者手勢（點擊）的同步呼叫棧內呼叫，Safari 才會接受。
 */
export async function copyHtml(html: string, plain: string): Promise<CopyResult> {
  if (
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return 'clipboard-api';
    } catch {
      // 落到後備路徑
    }
  }
  if (execCommandCopy(html)) {
    return 'exec-command';
  }
  throw new Error('clipboard not available');
}

function execCommandCopy(html: string): boolean {
  const holder = document.createElement('div');
  holder.setAttribute('contenteditable', 'true');
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.style.top = '0';
  holder.style.opacity = '0';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  selection?.removeAllRanges();
  document.body.removeChild(holder);
  return ok;
}
