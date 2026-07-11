// 小工具：debounce、字數統計。

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/** 統計字數：CJK 逐字計，其餘按空白分詞。 */
export function countWords(text: string): number {
  const cjk = text.match(/[一-鿿぀-ヿ가-힯]/g)?.length ?? 0;
  const nonCjk = text
    .replace(/[一-鿿぀-ヿ가-힯]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + nonCjk;
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
