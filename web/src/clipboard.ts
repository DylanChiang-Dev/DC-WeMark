// 一鍵複製：以 text/html 寫入剪貼簿，貼進公眾號編輯器保留樣式。
// 三層策略：ClipboardItem（含 Safari 的 promise-valued 形式）→ execCommand 後備。

export type CopyResult = 'clipboard-api' | 'exec-command';

/**
 * 把 HTML 片段以 text/html + text/plain 寫入剪貼簿。
 * 在使用者手勢（點擊）的同步呼叫棧內呼叫，Safari 才會接受。
 */
export async function copyHtml(html: string, plain: string): Promise<CopyResult> {
  const clipboardHtml = prepareForWechat(html);
  if (
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  ) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([clipboardHtml], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return 'clipboard-api';
    } catch {
      // 落到後備路徑
    }
  }
  if (execCommandCopy(clipboardHtml)) {
    return 'exec-command';
  }
  throw new Error('clipboard not available');
}

type LineHeight = { multiplier: number } | { pixels: number };

function pixelLength(value: string, fontSize: number): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(px|em|%)$/.exec(value);
  if (!match) return undefined;
  const size = Number(match[1]);
  return match[2] === 'px' ? size : size * fontSize / (match[2] === '%' ? 100 : 1);
}

function prepareForWechat(html: string): string {
  // 在 inert template 內處理引擎的內聯樣式，不改預覽、不載入圖片。
  const template = document.createElement('template');
  template.innerHTML = html;
  wrapMixedText(template.content);
  withPixelLineHeights(template.content);
  return template.innerHTML;
}

/**
 * 公眾號貼上時的疊字檢測會把「有直接文字的區塊」的每個行內片段都算成一行，
 * 段落裡只要夾著 <code>、<sup> 等行內元素，平均行高就被稀釋而誤報。
 * 把與元素混排的直接文字包進 <span>，區塊便不再有直接文字；版面不變。
 */
function wrapMixedText(root: DocumentFragment): void {
  for (const element of root.querySelectorAll('*')) {
    if (element.closest('pre, svg') || element.children.length === 0) continue;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
      const span = document.createElement('span');
      node.replaceWith(span);
      span.append(node);
    }
  }
}

function withPixelLineHeights(root: DocumentFragment): void {
  function visit(element: HTMLElement, parentFontSize: number, inherited?: LineHeight): void {
    const fontSize = pixelLength(element.style.fontSize, parentFontSize) ?? parentFontSize;
    const declared = element.style.lineHeight;
    let lineHeight = inherited;
    if (declared && declared !== 'inherit') {
      const pixels = pixelLength(declared, fontSize);
      const multiplier = Number(declared);
      lineHeight = pixels !== undefined ? { pixels }
        : Number.isFinite(multiplier) ? { multiplier } : undefined;
    }
    if (lineHeight && (declared || element.textContent?.trim())) {
      const pixels = 'multiplier' in lineHeight ? lineHeight.multiplier * fontSize : lineHeight.pixels;
      const value = `${Number(Math.max(fontSize, pixels).toFixed(4))}px`;
      const original = element.getAttribute('style') ?? '';
      const style = declared
        ? original.replace(/(^|;)\s*line-height\s*:[^;]*/gi, `$1line-height:${value}`)
        : `${original}${original && !original.trimEnd().endsWith(';') ? ';' : ''}line-height:${value};`;
      element.setAttribute('style', style);
    }
    // 傳遞原本的倍率，而非剛寫入的 px，才能保留子元素不同字級的行高。
    for (const child of element.children) {
      if (child instanceof HTMLElement) visit(child, fontSize, lineHeight);
    }
  }

  for (const element of root.children) {
    if (element instanceof HTMLElement) visit(element, 16);
  }
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
