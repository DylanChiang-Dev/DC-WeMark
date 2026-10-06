---
name: DC-WeMark
description: 在瀏覽器裡把 Markdown 排版成微信公眾號文章的朱絲欄箋編輯器
colors:
  zhu: "#bf3a2b"
  zhu-deep: "#9c2d21"
  zhu-wash: "#fbeeeb"
  ink: "#1d2226"
  ink-soft: "#454d55"
  ink-faint: "#646d76"
  line: "#d6dedc"
  line-strong: "#b4c0bd"
  paper: "#ffffff"
  chrome: "#fbfcfc"
  qing: "#dae4e1"
typography:
  brand:
    fontFamily: "Songti SC, STSong, Noto Serif CJK SC, Source Han Serif SC, SimSun, Georgia, serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.01em"
  title:
    fontFamily: "Songti SC, STSong, Noto Serif CJK SC, Source Han Serif SC, SimSun, Georgia, serif"
    fontSize: "20px"
    fontWeight: 700
  heading:
    fontFamily: "Songti SC, STSong, Noto Serif CJK SC, Source Han Serif SC, SimSun, Georgia, serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, Segoe UI, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, Segoe UI, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  editor:
    fontFamily: "SFMono-Regular, Menlo, Consolas, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, monospace"
    fontSize: "15px"
    lineHeight: "28px"
rounded:
  seal: "3px"
  control: "6px"
  group: "8px"
  sheet: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  rule: "28px"
components:
  button-copy:
    backgroundColor: "{colors.zhu}"
    textColor: "{colors.paper}"
    rounded: "{rounded.seal}"
    height: "38px"
    padding: "0 16px 0 7px"
  button-copy-hover:
    backgroundColor: "{colors.zhu-deep}"
  button-tool:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 10px"
  segmented-active:
    backgroundColor: "{colors.zhu-wash}"
    textColor: "{colors.zhu-deep}"
    rounded: "{rounded.control}"
  option-active:
    backgroundColor: "{colors.zhu-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  preview-sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.sheet}"
    width: "375px"
---

# Design System: DC-WeMark

## Overview

**Creative North Star: "朱絲欄箋"**

工具外殼取材自民國木刻信箋（八行箋）：編輯區是一張每行都有朱絲欄的白箋，外圍是天青色箋，頂欄與面板以一粗一細的「文武線」收邊。寫公眾號被當成寫給讀者的一封信，複製就是落款鈐印。

介面屬於 Operate 模式：佈局、導覽與控制項都是標準網頁元件，世界只透過字體、配色、密度與一個招牌動作（複製即蓋章）進入。文章預覽區內的樣式屬於輸出主題（蘋果風），不受外殼設計系統支配。

**Key Characteristics:**
- 朱紅只出現在四處：朱絲欄、印章（複製）、選中狀態、分隔線握把。
- 天青灰底承托白箋，冷色地避開暖米黃預設。
- 宋體負責品牌與標題，黑體負責介面，等寬字只用於 Markdown 原文。
- 狀態以線形表達（實線／虛線），不靠顏色。

## Colors

冷色箋紙與墨色為底，一種朱紅承擔所有「選中」與「行動」。

### Primary
- **印泥朱**（zhu）：複製按鈕、選中狀態外框、開關、焦點環、分隔線握把懸停；淡化為朱絲欄（14% 透明度）與界欄（42% 透明度）。
- **深朱**（zhu-deep）：複製按鈕懸停、分段選中文字。
- **朱暈**（zhu-wash）：選中項目底色。

### Neutral
- **墨**（ink）：主要文字、提示框底。
- **淡墨**（ink-soft）：工具按鈕、文武線粗線。
- **枯墨**（ink-faint）：次要說明、狀態列（在 chrome 底上 ≥4.5:1）。
- **箋紙白**（paper）：編輯區、預覽箋、可選項目底。
- **天青**（qing）：預覽區外圍底色。
- **素箋**（chrome）：頂欄、狀態列、設定面板底。
- **界線**（line / line-strong）：分隔線、邊框、文武線細線。

### Named Rules
**The Four Places Rule.** 朱紅只用於朱絲欄、印章、選中狀態與分隔線握把；任何新元件想用朱紅，必須屬於這四類之一。

**The Cool Ground Rule.** 外圍底色維持冷調天青；不改成暖米黃或奶油色。

## Typography

**Display Font:** 系統宋體（Songti SC → STSong → Noto Serif CJK SC → SimSun）
**Body Font:** 系統黑體（PingFang SC → Microsoft YaHei → Noto Sans CJK SC）
**Label/Mono Font:** SFMono / Menlo / Consolas，中文回退黑體，只用於編輯區

**Character:** 宋體帶出刊印與信箋的氣質，黑體保持工具介面的清晰；兩者都不載入外部字體，以符合「不新增網路請求、輕量優先」。

### Hierarchy
- **Brand**（700, 19px）：頂欄 DC-WeMark 字標。
- **Title**（700, 20px）：設定面板標題。
- **Heading**（700, 16px）：設定區段標題。
- **Body**（400–600, 13–14px）：按鈕、選項名稱。
- **Label**（400, 12px）：說明文字、狀態列；數字用 tabular-nums。
- **Editor**（400, 15px / 28px）：Markdown 原文，行高與朱絲欄間距相同。

### Named Rules
**The Ruled Line Rule.** 編輯區行高必須等於朱絲欄間距（28px）；改字級時同步改 `--rule-h`，否則文字會脫離欄線。

## Layout

三列格線：頂欄、雙欄工作區、狀態列，全高 `100dvh`。工作區為「編輯｜10px 分隔線｜預覽」，比例可拖曳或用方向鍵以 5% 調整（20%–80%）。預覽箋手機寬 375px、寬版 720px，置中於天青底。

820px 以下改為單欄，頂欄出現「编辑／预览」分段切換，工具按鈕只留圖示；560px 以下隱藏字標、複製按鈕縮為「印 复制」，狀態列換行。

## Elevation & Depth

以色調分層為主，陰影只用於兩種浮起物：預覽箋（`0 1px 2px` 加 `0 22px 44px -18px` 的柔和投影）與複製印章按鈕（短而貼近的投影）。設定面板以左側柔和投影區隔。預覽箋外另有一道 1px 細框外移 7px，作為信箋版框，不是陰影。

### Named Rules
**The One Elevation Rule.** 一個元素只宣告一種層次：邊框或陰影擇一；版框是裝飾邊欄，不算邊框層次。

## Shapes

方印語彙：印章與複製按鈕幾乎直角（3–4px），控制項 6px，分段群組 8px，預覽箋 12px。文武線（2px 粗線 + 間隔 + 1px 細線）是頂欄與面板標頭的固定收邊。

## Components

### Buttons
- **Shape:** 方印式直角（4px）。
- **Primary（复制到公众号）：** 朱紅底、白字，左側內嵌一枚白框「印」字小方印；懸停轉深朱，按下下沉 1px 並微縮。
- **Tool（导入／导出／设置）：** 無框透明，18px 線性圖示（1.5 描邊）加文字；懸停淡墨底。
- **Icon（關閉）：** 36px 方形，SVG 叉號，懸停淡墨底。

### Chips / Options
- **Style:** 白底、1px 界線框、6px 圓角。
- **State:** 選中時朱紅細框加朱暈底，文字轉墨色。

### Inputs / Fields
- **Editor：** 無框白箋，每行朱絲欄、左側一粗一細朱色界欄，游標朱紅，選取為淡朱。
- **Switch：** 開啟為朱紅軌道。
- **Segmented：** 白底細框群組，選中項朱暈底、深朱字。

### Navigation
- **Topbar：** 左為方印標誌「记」與宋體字標，中為預覽寬度分段，右為工具與複製印章；底邊文武線。

### 預覽配色列
預覽區頂端固定一列：右側「浅色／深色」分段切換，深色時左側顯示「按微信官方开源的深色算法模拟，实际以手机为准」。深色模擬時預覽箋底色為微信深色頁面色 `#191919`；這是輸出模擬，不屬於外殼調色盤。

### 落款鈐印（Signature）
複製成功時，預覽區右下蓋上一枚 82px 朱文方印「复制完成」（右欄先讀），-7° 旋轉，從 1.7 倍帶模糊壓下、停留後淡出；減少動態偏好下只淡入淡出。

### 草稿狀態線
狀態列左側 18px 短線：實線＝草稿已存本機，虛線＝編輯中。

## Do's and Don'ts

### Do:
- **Do** 讓新增的選中或行動元件沿用朱暈底加朱紅細框（zhu-wash / zhu）。
- **Do** 圖示用 20×20 viewBox、1.5 描邊、圓角端點的自繪 SVG。
- **Do** 頂部收邊使用文武線，而不是單一 1px 邊框。
- **Do** 介面文案使用簡體中文。

### Don't:
- **Don't** 把朱紅用在四處以外（例如裝飾色塊、標題文字）。
- **Don't** 用 Unicode 符號或 emoji 充當圖示。
- **Don't** 在標題上方加 eyebrow 小標。
- **Don't** 為外殼載入外部字體或任何網路資源。
