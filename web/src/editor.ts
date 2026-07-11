// 編輯器抽象。1.0 為增強型 textarea；EditorAdapter 介面留給未來 CodeMirror 6。

export interface EditorAdapter {
  getValue(): string;
  setValue(v: string): void;
  onChange(cb: (value: string) => void): void;
  focus(): void;
}

const INDENT = '  ';

export function createTextareaEditor(el: HTMLTextAreaElement): EditorAdapter {
  const listeners: Array<(v: string) => void> = [];
  const emit = () => {
    for (const cb of listeners) cb(el.value);
  };

  el.addEventListener('input', emit);

  el.addEventListener('keydown', (e: KeyboardEvent) => {
    // Tab / Shift+Tab 縮排
    if (e.key === 'Tab') {
      e.preventDefault();
      indentSelection(el, e.shiftKey);
      emit();
      return;
    }
    // Cmd/Ctrl + B / I 包裹語法
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        wrapSelection(el, '**', '**');
        emit();
      } else if (k === 'i') {
        e.preventDefault();
        wrapSelection(el, '*', '*');
        emit();
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
    file.text().then((text) => {
      el.value = text;
      emit();
    });
  });

  return {
    getValue: () => el.value,
    setValue: (v: string) => {
      el.value = v;
      emit();
    },
    onChange: (cb) => listeners.push(cb),
    focus: () => el.focus(),
  };
}

function indentSelection(el: HTMLTextAreaElement, outdent: boolean): void {
  const { selectionStart, selectionEnd, value } = el;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const before = value.slice(0, lineStart);
  const selected = value.slice(lineStart, selectionEnd);
  const after = value.slice(selectionEnd);

  if (outdent) {
    const dedented = selected.replace(/^ {1,2}/gm, '');
    el.value = before + dedented + after;
    const removed = selected.length - dedented.length;
    el.selectionStart = Math.max(lineStart, selectionStart - Math.min(INDENT.length, removed));
    el.selectionEnd = selectionEnd - removed;
  } else if (selectionStart === selectionEnd) {
    el.value = value.slice(0, selectionStart) + INDENT + value.slice(selectionStart);
    el.selectionStart = el.selectionEnd = selectionStart + INDENT.length;
  } else {
    const indented = selected.replace(/^/gm, INDENT);
    el.value = before + indented + after;
    el.selectionStart = selectionStart + INDENT.length;
    el.selectionEnd = selectionEnd + (indented.length - selected.length);
  }
}

function wrapSelection(el: HTMLTextAreaElement, open: string, close: string): void {
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd);
  el.value = value.slice(0, selectionStart) + open + selected + close + value.slice(selectionEnd);
  if (selected) {
    el.selectionStart = selectionStart + open.length;
    el.selectionEnd = selectionEnd + open.length;
  } else {
    el.selectionStart = el.selectionEnd = selectionStart + open.length;
  }
}
