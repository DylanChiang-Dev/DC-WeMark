语言：[繁體中文](README.md) | [简体中文](README.zh-CN.md) | [English](README.en.md)

<div align="center">

# DC-WeMark

### 在浏览器里把 Markdown 排版成微信公众号文章

**左边写 Markdown，右边实时预览公众号效果，一键复制、粘贴进公众号编辑器就能发。**

<strong>纯前端，零后端。</strong><br/>
排版核心用 Rust 编写、编译成 WebAssembly 在你的浏览器里运行；<br/>
文章从头到尾不离开你的设备，没有服务器、没有账号、没有上传。

*Write Markdown, preview it as a styled WeChat Official Account article, and copy it into the WeChat editor with one click — entirely in your browser.*

<br/>

[![Stars](https://img.shields.io/github/stars/DylanChiang-Dev/DC-WeMark?style=for-the-badge&logo=github&color=ffca28)](https://github.com/DylanChiang-Dev/DC-WeMark/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50?style=for-the-badge)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-core-ce422b?style=for-the-badge&logo=rust)](#技术架构)
[![WebAssembly](https://img.shields.io/badge/WASM-in--browser-654ff0?style=for-the-badge&logo=webassembly&logoColor=white)](#技术架构)
[![Status](https://img.shields.io/badge/status-live-4caf50?style=for-the-badge)](#项目状态与路线图)

</div>

---

如果你用 Markdown 写作、在微信公众号发文，你大概踩过这些坑：公众号编辑器不吃 Markdown；粘贴后样式全掉；在线转换工具要把整篇文章传到别人的服务器上。

DC-WeMark 要解决的就是这一段：**写作用你熟悉的 Markdown，发布时一键得到公众号编辑器直接认得的排版**——而且整个转换在你自己的浏览器里完成。

## 🧭 核心信念

> ### 你的文章只属于你。

- **纯前端，无后端。** 没有服务器逻辑、没有数据库、没有账号系统。部署产物就是一包静态文件。
- **文稿不上传。** Markdown 解析、排版与复制都在浏览器本地执行。网络图片仍会向图片来源请求；首次加载网站或尚未缓存的高亮／深色预览资源需要联网，不承诺完整离线使用。
- **不做全家桶。** 只做一件事：排版、预览、复制。不接 AI 写作、不管你的公众号账号、不碰发布 API。
- **目前只保留一套精修主题。** 苹果风的配色、字距、版式都是本项目独立设计；后续完成并验收一套，再新增下一套。

## 🗺️ 工作原理

```mermaid
flowchart LR
    A([📝 Markdown]) --> B[解析为 AST<br/>Rust · comrak]
    B --> C[主题引擎<br/>样式全部内联为 inline CSS]
    C --> D[公众号兼容 HTML<br/>过滤不支持的标签与属性]
    D --> E([👀 实时预览])
    D --> F([📋 一键复制<br/>Clipboard API · text/html])
    F --> G([✅ 粘贴进公众号编辑器<br/>样式完整保留])
```

关键在中间两步：微信公众号编辑器**只接受 inline style 的富文本**，不支持 `<style>` 标签、class、`position` 等一大批常规写法。DC-WeMark 的排版引擎把主题样式逐一内联到每个元素上，并过滤掉编辑器会吞掉的东西，让"粘贴即所见"真正成立。

## ✨ 功能

| 功能 | 说明 | 状态 |
|---|---|---|
| 双栏编辑器 | 朱丝栏笺外壳、简体中文界面；左侧 Markdown 输入，右侧公众号样式实时预览（含拖拽分隔线、手机/宽版切换） | ✅ 完成 |
| 排版引擎 | CommonMark + GFM（表格、代码块、任务清单、脚注），输出公众号兼容的 inline-styled HTML | ✅ 完成 |
| 一键复制 | 以 `text/html` 写入剪贴板（含兼容后备路径）；输出明确的像素行高，并处理行内混排造成的叠字误报 | ✅ 完成 |
| 原创主题 | 目前唯一的苹果风精修主题，支持自定义强调色 | ✅ 完成 |
| 排版设置 | 三种复制背景、三档字号、四种文章字体、可视化选色、双向滚动同步与偏好保存 | ✅ 完成 |
| 深色模式预览 | 用微信公众平台官方开源的 [mp-darkmode](https://github.com/wechatjs/mp-darkmode) 算法模拟读者的深色模式；只影响预览，不改复制内容。算法延迟加载，并有对比度回归测试 | ✅ 完成 |
| 编辑体验 | 字数统计、导入／导出、Tab／Shift+Tab 缩进、`Cmd/Ctrl+B/I`、拖入文件；编辑操作支持原生撤销，离开页面时保存草稿 | ✅ 完成 |
| 安全与输出提醒 | 危险网址协议过滤、CSP 安全标头、本地图片／网络图片提醒、重复外链共用脚注编号，脚注标题可选繁／简 | ✅ 完成 |
| 代码高亮 | 围栏标上语言（如 ` ```rust `）即语法上色；高亮引擎仅在文章含代码时延迟加载，不占首屏（见 [体积说明](docs/size-baseline.md)） | ✅ 完成 |

新文章使用标准 Markdown 即可。旧文稿中的 `:::` 容器语法仍可正常渲染，但仅作向后兼容，不再提供插入入口或扩展新模块（见[兼容说明](docs/container-syntax.md)）。

主题开发采用逐套完成、逐套验收的节奏。2026-10-07 用户已确认本轮微信编辑器粘贴修正可用；本轮升级结束，不自动开始下一套主题。

### 公众号粘贴兼容性

- 复制时将行高换算成 `px`，并包裹与行内元素混排的直接文本，避免内容结构检测误报；预览版面不变。
- 代码块自动换行，降低手机阅读时的水平溢出风险；方格背景附带深色模式兼容标记。
- 工程回归测试覆盖行高、代码与段落溢出、渐变背景，以及 Chromium、WebKit、Firefox。深色预览是模拟，实际发布仍以微信编辑器与手机阅读效果为准。
- 更新后须刷新网站，使用「复制」重新获取内容，再替换微信编辑器内的旧内容；已粘贴的文章不会自动修正。

## 🚀 快速开始

**在线版**：[dc-wemark.pages.dev](https://dc-wemark.pages.dev)，打开即用、无需安装。

**自部署**：按下方「本地开发」执行 `npm run build`，把 `web/dist/` 放到任意静态文件主机即可；不需要后端或容器。

## 🧱 技术架构

| 层 | 技术 | 职责 |
|---|---|---|
| 排版核心 | Rust（编译至 WebAssembly） | Markdown 解析、主题样式内联、公众号 HTML 兼容处理 |
| 前端壳 | Vite + 原生 TypeScript（零框架） | 双栏编辑器、主题切换、剪贴板写入 |
| 部署 | Cloudflare Pages | 纯静态文件分发，无服务器逻辑；安全标头见 `web/public/_headers` |

选 Rust + WASM 而不是纯 JavaScript，是为了同一个排版核心将来可以直接复用到 CLI 或其他形态，且核心逻辑有类型与测试保障。首屏体积与延迟加载资源分开计算；CI 限制首屏 gzip 小于 300 KB（见 [体积说明](docs/size-baseline.md)）。

## 🛠️ 本地开发

需要 Rust（stable）、[wasm-pack](https://github.com/rustwasm/wasm-pack) 与 Node 20+。

```bash
git clone https://github.com/DylanChiang-Dev/DC-WeMark.git
cd DC-WeMark

cargo test               # 排版核心测试（纯 Rust）

cd web
npm ci
npm run build:wasm       # 构建 WASM 到前端
npm run dev              # http://localhost:5173
npm run build            # 产出 dist/
npx playwright install --with-deps chromium webkit firefox
npm run test:e2e         # 三浏览器 e2e，含 dist 的 CSP 检查，需先 build
```

## ☁️ 部署到 Cloudflare Pages

Cloudflare Pages 直接连接 GitHub 仓库 `DylanChiang-Dev/DC-WeMark`：

1. `main` 是正式环境分支，push 后 Cloudflare 自动拉取仓库。
2. 构建命令：`bash deploy/build-pages.sh`。
3. 产物目录：`web/dist`。

构建与部署全程在 Cloudflare 执行，不需要 GitHub Secrets 或本地上传产物。

> Clipboard API 需要 HTTPS——Cloudflare Pages 自带 HTTPS，本地 `localhost` 也算安全上下文，均可正常复制。

## 📌 项目状态与路线图

当前版本：**1.0.1**（Cloudflare Pages 在线版已就绪；2026-10-06 至 2026-10-07 本轮升级已完成，用户确认粘贴修正可用）。

- [x] **0.1.0** — 排版引擎 MVP：Markdown → 公众号兼容 HTML，含 1 套默认主题
- [x] **0.2.0** — 双栏编辑器 + 实时预览 + 一键复制
- [x] **0.3.0** — 苹果风主题与主题切换 + 自定义强调色
- [x] **0.4.0** — 高级排版模块（现仅作旧文稿兼容）
- [x] **1.0.0** — Cloudflare Pages 部署流程（当时的 Docker 自部署方案已移除，项目只保留静态部署）
- [x] **1.0.1 本轮升级** — 界面改版、安全与编辑强化、延迟高亮、微信深色预览、行高与行内混排兼容修正、三浏览器回归测试

版本采用三段式语义化版本号；本轮维持 `1.0.1`，未另建 release 或 tag。后续候选：缩小延迟加载的高亮引擎；不属于本轮待办，另行启动。

## ⭐ Star 趋势

如果这个项目帮到你，点颗星——让更多还在手动调公众号排版的写作者看到它。

[![Star History Chart](https://api.star-history.com/svg?repos=DylanChiang-Dev/DC-WeMark&type=Date)](https://star-history.com/#DylanChiang-Dev/DC-WeMark&Date)

## 📄 授权与致谢

**MIT License**（版权人 Dylan Chiang 蒋涛）——可自由使用、修改、再发布（含商用），保留版权声明即可。

"Markdown 转公众号排版"是一个有众多先行者的领域，特此致谢其中的开拓者：

- [**md2wechat-skill**](https://github.com/geekjourneyx/md2wechat-skill) —— 本项目主要的功能与视觉对标；苹果风样稿特征包括暖白圆角文章、亮蓝重点、图片阴影与蓝紫红渐变章节标题（Source Available License）
- [**doocs/md**](https://github.com/doocs/md) —— 网页版微信 Markdown 编辑器的次要形态参考（MIT）
- [**markdown-nice**](https://github.com/mdnice/markdown-nice) —— 主题化公众号排版的次要理念参考（GPL-3.0）

> 仅参考公开功能边界与问题意识，**代码、主题样式、文案全部独立原创**，未复制上述项目的源代码或样式。
