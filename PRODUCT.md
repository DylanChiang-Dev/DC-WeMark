# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

以 Markdown 寫作、經營微信公眾號的個人創作者。主要在桌機瀏覽器長時間撰寫與修改，完成後一鍵複製貼進公眾號編輯器；手機只作偶爾查看。主要使用者以簡體中文為主（2026-10 使用者確認）。

## Product Purpose

在瀏覽器內把 Markdown 排版成公眾號編輯器可直接接受的 inline-styled HTML：左寫、右即時預覽、一鍵複製、貼上即所見。成功標準是貼進公眾號編輯器後樣式完整保留，且寫作者不必手動調排版。

## Positioning

純前端、零後端：排版核心以 Rust 編譯成 WebAssembly 在本機瀏覽器執行，文章從頭到尾不離開使用者裝置，無伺服器、無帳號、無上傳，斷網可用。只做排版、預覽、複製三件事。

## Operating Context

- 寫作流程：撰寫或匯入 `.md` → 即時預覽（手機寬／寬版）→ 調整排版設定 → 複製 → 貼進公眾號後台編輯器。
- 草稿與偏好只存在本機 localStorage。
- 線上版部署於 Cloudflare Pages（`main` 推送即自動部署正式站）。

## Capabilities and Constraints

- 前端：Vite + 原生 TypeScript，零框架；編輯器為增強型 textarea（刻意不引入 CodeMirror 以控制體積）。
- 公眾號只接受 inline style；輸出 HTML 經標籤／屬性白名單過濾，顏色一律展開 `#rrggbb`，避免漸層（深色模式會壓平）。
- 文章主題目前只有一套「蘋果風」，主題須逐套完成並經實際公眾號貼上驗收後才新增。
- 排版設定：強調色、三種輸出背景、三檔字級、四種文章字體、腳註繁／簡字形、同步捲動。
- CSP 安全標頭見 `web/public/_headers`；不新增網路請求、分析或遙測。
- 介面文案語言策略（繁／簡）尚未定案。

## Brand Commitments

- 名稱 DC-WeMark 保留不變。
- 原「令」字標誌可替換（使用者已同意）。
- 文章輸出主題可在有更好方案時調整，但須維持公眾號相容。
- 作者 Dylan Chiang；MIT 授權。

## Evidence on Hand

- 內建示範文稿：`web/src/sample.ts`。
- 無使用者見證、使用數據或媒體報導；不得虛構。

## Product Principles

1. 你的文章只屬於你：任何改動不得引入上傳、帳號或外部請求。
2. 預覽即結果：預覽與複製出的 HTML 必須一致。
3. 只做一件事並做好：排版、預覽、複製，不擴張成全家桶。
4. 輕量優先：體積與首屏載入是功能的一部分。
