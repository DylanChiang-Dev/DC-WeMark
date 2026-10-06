// 編輯器抽象。1.0 為增強型 textarea；EditorAdapter 介面留給未來 CodeMirror 6。

export interface EditorAdapter {
  getValue(): string;
  /** 程式設定內容（不進復原紀錄），只用於初次載入。 */
  setValue(v: string): void;
  /** 以使用者編輯的方式整篇取代，可用 Cmd/Ctrl+Z 復原。 */
  replaceAll(v: string): void;
  onChange(cb: (value: string) => void): void;
  /** 拖入檔案並取代內容後通知（參數為檔名）。 */
  onFileDrop(cb: (fileName: string) => void): void;
  focus(): void;
}

const INDENT = '  ';

export function createTextareaEditor(el: HTMLTextAreaElement): EditorAdapter {
  const listeners: Array<(v: string) => void> = [];
  const dropListeners: Array<(name: string) => void> = [];
  const emit = () => {
    for (const cb of listeners) cb(el.value);
  };

  // 原生編輯與 replaceRange 都會觸發 input，統一由這裡通知。
  el.addEventListener('input', emit);

  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.isComposing) return;
    // Tab / Shift+Tab 縮排
    if (e.key === 'Tab') {
      e.preventDefault();
      indentSelection(el, e.shiftKey);
      return;
    }
    // Cmd/Ctrl + B / I 包裹語法
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        wrapSelection(el, '**', '**');
      } else if (k === 'i') {
        e.preventDefault();
        wrapSelection(el, '*', '*');
      }
    }
  });

  // 拖入 .md / .markdown / .txt 檔讀入內容
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e: DragEvent) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return;
    e.preventDefault();
    void file.text().then((text) => {
      replaceRange(el, 0, el.value.length, text);
      for (const cb of dropListeners) cb(file.name);
    });
  });

  return {
    getValue: () => el.value,
    setValue: (v: string) => {
      el.value = v;
      emit();
    },
    replaceAll: (v: string) => replaceRange(el, 0, el.value.length, v),
    onChange: (cb) => listeners.push(cb),
    onFileDrop: (cb) => dropListeners.push(cb),
    focus: () => el.focus(),
  };
}

/**
 * 以「使用者輸入」的方式取代 [start, end)，讓瀏覽器保留原生復原紀錄。
 * execCommand 雖已標為過時，但仍是 textarea 保留 Cmd/Ctrl+Z 的唯一通用做法；
 * 不支援時退回 setRangeText（無法復原，但內容正確）。
 */
function replaceRange(el: HTMLTextAreaElement, start: number, end: number, raw: string): void {
  // textarea 一律以 \n 儲存換行；先正規化，才能正確比對插入結果。
  const text = raw.replace(/\r\n?/g, '\n');
  if (start === end && text === '') return;
  if (el.value.slice(start, end) === text) return;
  el.focus();
  el.setSelectionRange(start, end);
  let ok = false;
  try {
    ok =
      text === ''
        ? document.execCommand('delete')
        : document.execCommand('insertText', false, text);
  } catch {
    ok = false;
  }
  if (!ok || el.value.slice(start, start + text.length) !== text) {
    el.setRangeText(text, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function indentSelection(el: HTMLTextAreaElement, outdent: boolean): void {
  const { selectionStart, selectionEnd, value } = el;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const selected = value.slice(lineStart, selectionEnd);

  if (outdent) {
    const dedented = selected.replace(/^ {1,2}/gm, '');
    const removed = selected.length - dedented.length;
    if (removed === 0) return;
    const firstRemoved = selected.length - selected.replace(/^ {1,2}/, '').length;
    replaceRange(el, lineStart, selectionEnd, dedented);
    el.setSelectionRange(
      Math.max(lineStart, selectionStart - firstRemoved),
      selectionEnd - removed,
    );
  } else if (selectionStart === selectionEnd) {
    replaceRange(el, selectionStart, selectionEnd, INDENT);
  } else {
    const indented = selected.replace(/^/gm, INDENT);
    replaceRange(el, lineStart, selectionEnd, indented);
    el.setSelectionRange(
      selectionStart + INDENT.length,
      selectionEnd + (indented.length - selected.length),
    );
  }
}

function wrapSelection(el: HTMLTextAreaElement, open: string, close: string): void {
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd);
  replaceRange(el, selectionStart, selectionEnd, open + selected + close);
  el.setSelectionRange(selectionStart + open.length, selectionEnd + open.length);
}
