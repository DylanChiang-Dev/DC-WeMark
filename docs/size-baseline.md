# WASM 體積基線與高亮策略（0.1.0 spike）

日期：2026-07-12。工具：Rust 1.97、wasm-pack、`wasm-opt -Oz`。量測 `wemark_core_bg.wasm` 的 gzip -9 大小。

## 量測結果

| 設定 | raw | gzip |
|---|---|---|
| 完整 syntect（default-syntaxes + default-themes）| ~1687 KB | ~830 KB |
| comrak only（無 syntect）| 295 KB | **120 KB** |
| **0.1.0 預設（lean，highlight off）** | 295 KB | **120 KB** |

預算：wasm gzip < 260 KB、整站 gzip < 300 KB。**lean 預設 120 KB 達標**，並留約 180 KB 給前端殼與 CSS。

## 高亮策略決策

完整 syntect 語法集會佔掉約 700 KB gzip，直接爆掉整站預算，因此：

- **`syntax-highlight` feature 預設關閉**。關閉時程式碼區塊保留主題外殼（背景、圓角、等寬字）+ 純文字轉義，可讀但無 token 上色。
- feature 開啟可得完整 syntect 高亮，但體積大幅上升，僅適合不在意體積的自架/桌面場景。

### 為何不能「抽子集縮小語法包」

syntect 完整語法集含跨語言 embed（HTML 內嵌 CSS/JS、Markdown 內嵌多語言…），context 之間以 index 互相參照。`SyntaxSet::into_builder()` 只重映射各語法「自己的」context，跨語法的 Direct 參照仍保留原始 index；抽子集後 `build()` 會 index out of bounds panic。要安全縮小，必須從各語言的 `.sublime-syntax` **原始檔重新解析建置**（fresh link），而非從已連結的集合抽子集。

### 後續任務（富高亮而不犧牲體積）

擇一實作：

1. **延遲載入的獨立語法資產**：把精簡語法/主題 dump 拆成獨立檔，使用者打開含程式碼的文章時才 fetch，不佔首屏。
2. **vendored 原始語法檔**：在 repo 內放入約 15 種常用語言的 `.sublime-syntax`（授權相容者），build.rs fresh 解析建置精簡 dump（預期語法資料僅數十 KB）。

兩者皆為 additive、不阻塞 0.2.0–0.3.0。
