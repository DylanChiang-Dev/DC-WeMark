# DC-WeMark 實作計劃（0.0.1 → 1.0.0）

## Context

DC-WeMark（github.com/DylanChiang-Dev/DC-WeMark，本地 `/Users/dc/Documents/002/开源项目/DC-WeMark`）是全新開源專案（MIT），倉庫目前只有三語 README、LICENSE、.gitignore，零程式碼。產品：純前端網頁工具，左欄 Markdown、右欄即時預覽微信公眾號排版、一鍵複製貼進公眾號編輯器。無後端、無帳號、內容不出裝置。

**Clean-room 紅線**：功能概念對標 geekjourneyx/md2wechat-skill（Source Available License），但絕不讀取/複製其任何程式碼、CSS、文案；doocs/md（WTFPL）與 markdown-nice（GPL）的程式碼與主題也一律不用。主題全部原創（使用者已拍板）。

**已確認決策**：一次做到 1.0（編輯器+多主題+排版模組+部署）；核心 Rust→WASM（comrak）；前端 Vite + 原生 TS 零框架；主題 4–6 套全原創；部署 Cloudflare Pages 為主 + Dockerfile 自架；三段式版號，逐里程碑打 tag。

## 核心架構決策

1. **不用 comrak 內建 HTML formatter，自寫 AST→HTML 渲染器**。微信只吃 inline style，需按主題規則逐節點輸出帶 inline style 的 HTML，並處理巢狀語境（容器內元素樣式覆寫）。comrak 只負責 `parse_document` 產 AST。
2. **`:::` 容器語法用行級預處理器實作，不 fork comrak**（comrak 無自訂 block 擴充口）。預處理器把 `::: card key="v"` / `:::` 改寫成 HTML 註解標記行（`<!--wm:open card …-->` / `<!--wm:close-->`），comrak 解析成 HtmlBlock 節點，渲染器用容器堆疊配對輸出 `<section>` 外殼。必須帶 code fence 追蹤器（fence 內的 `:::` 不改寫）。
3. **主題定義為 TOML 資料檔，build.rs 編譯期生成 Rust 靜態表嵌入 WASM**。toml/serde 只作 build-dependency，不進 wasm 依賴圖（省 60–100KB）。schema：`[meta]`/`[palette]`/`[elements.h1…]`/`[containers.card…]`/`[code]`，支援 `{{accent}}` 變數插值。
4. **編輯器 1.0 用增強型 textarea**（Tab 縮排、Cmd+B/I、拖入 .md），不用 CodeMirror 6（wasm 已占 gzip 預算大頭 ~180–250KB，CM6 再加 70–110KB 必破 300KB 線）。`editor.ts` 定義 `EditorAdapter` 介面留 CM6 後路。

## 倉庫佈局

```
DC-WeMark/
├── Cargo.toml                  # workspace: crates/*
├── rust-toolchain.toml         # comrak 0.50 要求 Rust ≥ 1.85
├── crates/wemark-core/
│   ├── Cargo.toml              # crate-type = ["cdylib","rlib"]
│   ├── build.rs                # themes/*.toml → 生成碼；精簡 syntect 語法 dump
│   ├── themes/*.toml           # 主題單一事實來源
│   ├── src/
│   │   ├── lib.rs              # render(md, theme_id, &Options) -> RenderResult
│   │   ├── wasm.rs             # wasm-bindgen 薄殼：wm_render/wm_themes/wm_version（JSON 進出）
│   │   ├── preprocess.rs       # ::: → 標記行；fence 追蹤
│   │   ├── parse.rs            # comrak 組態（table/strikethrough/tasklist/autolink/footnotes）
│   │   ├── render/{mod,inline,block,code}.rs   # AST 走訪 + 容器堆疊 + syntect 高亮
│   │   ├── theme/{mod,style}.rs                # 型別 + include!(themes_gen.rs) + style 字串化
│   │   ├── compat.rs           # 白名單終檢、外鏈→文末腳註
│   │   └── options.rs
│   └── tests/                  # insta 快照 + fixtures
├── web/                        # Vite + TS（不在 Cargo workspace）
│   ├── src/{main,engine,editor,preview,clipboard,themes,storage,render-loop}.ts
│   ├── src/wasm/               # wasm-pack 輸出（gitignore）
│   └── e2e/                    # Playwright
├── deploy/{Dockerfile,nginx.conf}   # 三階段 build → nginx:alpine
├── .github/workflows/{ci,deploy}.yml
└── docs/{theme-format,container-syntax,wechat-checklist}.md
```

## 關鍵技術要點

- **comrak 依賴宣告**：`comrak = { version = "~0.50", default-features = false, features = ["syntect-fancy"] }`——預設 features 含 `cli` 和 `syntect-onig`（onig 在 wasm 下無法建置）。CI 用 `cargo tree --target wasm32-unknown-unknown -e features` 防 feature 統一陷阱。
- **syntect**：走 `regex-fancy`；build.rs 產精簡 SyntaxSet dump（~15 常用語言），絕不用 default-syntaxes（體積爆炸）。高亮輸出 inline style，包進主題定義的 code block 外殼。
- **compat.rs**：標籤白名單 `section p h1-h6 span strong em a img ul ol li blockquote table thead tbody tr th td code pre br hr sup sub figure figcaption`；屬性白名單 `style src alt title colspan rowspan`。輸出全程自產，白名單是防禦性終檢+測試斷言（不含 `class=`/`id=`/`position:`/`<style`/`<script`），不引入重型 sanitizer。原始 HTML 節點一律 escape（XSS 邊界——預覽直接 innerHTML）。外鏈（非 mp.weixin.qq.com）→ `文字<sup>[n]</sup>` + 文末「參考連結」區塊，可用 options 關閉。
- **剪貼簿三層策略**（`clipboard.ts`，產品成敗點）：① `navigator.clipboard.write(ClipboardItem{'text/html','text/plain'})`；② Safari 要求使用者手勢同步棧內建 ClipboardItem——用 promise-valued ClipboardItem 形式；③ 後備：隱藏 contenteditable + Range 全選 + `execCommand('copy')`。複製的 HTML 外層包根 `<section>` 帶基準字號/行高/字色。
- **WASM 建置**：`wasm-pack build --target web`（鎖 wasm-pack 0.15.x，CLI 與 crate 版本自動配對）；Vite `build.target: 'esnext'`；`[profile.release] opt-level="z", lto=true, codegen-units=1, panic="abort", strip=true` + wasm-opt -Oz。
- **渲染迴圈**：debounce 200ms，主執行緒直呼（萬字文 <10ms 預期）；預覽容器 ~375px 模擬手機視口，可切 PC 寬度；比例法同步捲動。
- **顏色一律展開 `#rrggbb`**（微信清洗簡寫）；清單 list-style 支援不穩→做成主題層策略開關（原生 list vs 手工序號 section）。

## 分階段任務（每階段結束打 tag）

### 第 0 步（開工即做）
- 把本計劃整理成 spec 存 `docs/superpowers/specs/2026-07-11-dc-wemark-design.md` 並 commit（brainstorming 流程要求）。
- **技術 spike（全案最早驗證點）**：comrak(syntect-fancy) + 精簡語法包編成 wasm，實測 gzip 體積與 release 模式渲染速度。此 spike 決定體積預算基線。

### 0.1.0 — 排版引擎 MVP（純 Rust）
workspace 骨架 + CI rust job → parse.rs + render/ 走訪器（全 GFM 元素）→ 主題型別 + build.rs TOML 管線 + `default.toml` 首套主題 → compat.rs → syntect 高亮 → insta 快照 + 相容性斷言 → wasm.rs 綁定 + wasm-bindgen-test + CI wasm job（gzip 體積門檻初設 260KB）。
**驗收**：cargo test 全綠；含全部 GFM 元素的中文長文渲染輸出手工貼進公眾號編輯器樣式完整保留；記錄 wasm 體積基線。

### 0.2.0 — 編輯器 + 預覽 + 複製
Vite+TS 專案 + wasm 載入封裝 + 雙欄佈局（窄螢幕 tab 切換）→ 增強 textarea + debounce 渲染 + 同步捲動 → clipboard.ts 三層策略 + 教學 toast → localStorage 草稿（debounce 1s，key `wemark:draft:v1`）→ Playwright e2e（chromium+webkit）+ 全站體積門檻 <300KB。
**驗收**：Chrome/Safari/Firefox 全流程可用；Safari 真機複製貼上公眾號必過；草稿還原；e2e 綠。

### 0.3.0 — 多主題
再原創 3–5 套主題 TOML（調性方向：極簡黑白、雜誌襯線、科技深色、暖色手帳、學術風——全部從零配色）→ wm_themes() + 切換器 UI + 強調色自訂 → 每主題 × fixture 快照 + 人工公眾號清單。
**驗收**：≥4 套主題切換 <300ms；任一主題貼上樣式保留；選擇持久化。

### 0.4.0 — 排版模組
preprocess.rs 容器語法（屬性解析、巢狀、fence 跳過）→ 首批模組 card/quote/timeline/note/warn/tip（每主題各定義樣式）→ 容器語境樣式覆寫 → docs/container-syntax.md + 工具列插入模板按鈕 → 病態輸入測試（未閉合容器寬容處理：文末自動閉合+warning，不 panic）。
**驗收**：全模組 × 全主題渲染正確且貼上保留；病態輸入不 panic 不吞文。

### 1.0.0 — 上線
CF Pages 接入（GitHub Actions 建置 + `wrangler pages deploy`，不用 Pages 自建）+ deploy.yml → Dockerfile 三階段 + nginx.conf（wasm MIME、immutable cache、CSP 含 `wasm-unsafe-eval`）→ 打磨（字數統計、.md 匯入匯出、快捷鍵、wasm 載入失敗降級提示）→ 體積審計（twiggy）+ Lighthouse → 三語 README 更新（快速開始改「打開網頁」）。
**驗收**：公網可用；`docker run -p 8080:80` 一行自架成功；真實文章全鏈路發布走通；gzip 總體積 <300KB。

## 測試策略

- Rust 單元：preprocess fence 追蹤/巢狀、外鏈判定、style 字串化、主題插值
- insta 快照：fixtures（中文標點、長 URL、深巢狀清單、表格含行內碼、多語言 fence、容器巢狀等病態組合）× 每套主題
- 相容性斷言：輸出不含 `class=`/`id=`/`<style`/`position:`/`<script`
- build.rs 即主題 schema 驗證（缺欄位編譯失敗）
- wasm-bindgen-test：綁定層 JSON 進出、中文/emoji UTF-8 無損
- Playwright：打字→預覽、切主題、複製（clipboard 權限；webkit 斷言走對路徑）、草稿還原
- 人工驗收：每版真貼公眾號編輯器，逐項勾 `docs/wechat-checklist.md`

## 風險與緩解（要點）

- **syntect 體積**（高）：精簡語法包 + CI 體積門檻；最壞降級「無高亮」feature flag
- **fancy-regex 效能**（中）：開發全程 `--release` 測 wasm；第 0 步 spike 先驗證
- **剪貼簿跨瀏覽器**（高）：三層策略 + webkit e2e + Safari 真機每版必測
- **微信清洗規則變動**（高）：規則集中 compat.rs + 主題策略開關；issue 模板附「貼上失真回報」
- **外域圖片防盜鏈**（低中）：文件明示「圖先傳素材庫」；預覽對外域圖標角標

## Verification（端到端）

1. `cargo test`（含 insta）+ `cargo clippy -D warnings` 全綠
2. `wasm-pack build --release` 過且 gzip 體積在門檻內
3. `npm run build` + Playwright e2e 綠
4. 本地 `vite dev` 手動走全流程：寫中文長文（含表格/程式碼/容器模組）→ 預覽正確 → 複製 → 貼進微信公眾號網頁編輯器 → 樣式完整保留 → 可正常儲存草稿
5. `docker build && docker run -p 8080:80` 打開 localhost:8080 全流程可用
6. 部署 CF Pages 後線上再走一遍複製流程（HTTPS 下 Clipboard API 正常）
