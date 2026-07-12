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
[![Status](https://img.shields.io/badge/status-early_development-9e9e9e?style=for-the-badge)](#项目状态与路线图)

</div>

---

如果你用 Markdown 写作、在微信公众号发文，你大概踩过这些坑：公众号编辑器不吃 Markdown；粘贴后样式全掉；在线转换工具要把整篇文章传到别人的服务器上。

DC-WeMark 要解决的就是这一段：**写作用你熟悉的 Markdown，发布时一键得到公众号编辑器直接认得的排版**——而且整个转换在你自己的浏览器里完成。

## 🧭 核心信念

> ### 你的文章只属于你。

- **纯前端，无后端。** 没有服务器逻辑、没有数据库、没有账号系统。部署产物就是一包静态文件。
- **内容不出设备。** 从输入 Markdown 到复制 HTML，每一步都在浏览器本地执行；断网也能用。
- **不做全家桶。** 只做一件事：排版、预览、复制。不接 AI 写作、不管你的公众号账号、不碰发布 API。
- **主题全部原创。** 每一套主题的配色、字距、版式都是本项目自己设计的。

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
| 双栏编辑器 | 左侧 Markdown 输入，右侧公众号样式实时预览（含拖拽分隔线、手机/宽版切换） | ✅ 完成 |
| 排版引擎 | CommonMark + GFM（表格、代码块、任务清单），输出公众号兼容的 inline-styled HTML | ✅ 完成 |
| 一键复制 | 以 `text/html` 写入剪贴板（含 Safari 兼容路径），粘贴进公众号编辑器保留全部样式 | ✅ 完成 |
| 原创主题 | 5 套原创主题可切换（晴川／墨白／晚报／松石／暖阳）＋ 自定义强调色 | ✅ 完成 |
| 排版模块 | `:::` 容器语法：提示框、卡片、金句、时间轴等（见 [语法说明](docs/container-syntax.md)） | ✅ 完成 |
| 编辑体验 | 字数统计、`.md` 导入／导出、Tab 缩进、`Cmd/Ctrl+B/I`、拖入文件、本地草稿 | ✅ 完成 |
| 代码高亮 | 语法 token 上色（可选 feature；默认关以控体积，见 [体积说明](docs/size-baseline.md)） | 🚧 opt-in |

## 🚀 快速开始

**在线版**：托管于 Cloudflare Pages，打开即用、无需安装（部署见下方）。

**自部署（Docker，一行启动）**：

```bash
docker build -f deploy/Dockerfile -t dc-wemark .
docker run -p 8080:80 dc-wemark
# 打开 http://localhost:8080
```

## 🧱 技术架构

| 层 | 技术 | 职责 |
|---|---|---|
| 排版核心 | Rust（编译至 WebAssembly） | Markdown 解析、主题样式内联、公众号 HTML 兼容处理 |
| 前端壳 | Vite + 原生 TypeScript（零框架） | 双栏编辑器、主题切换、剪贴板写入 |
| 部署 | Cloudflare Pages（主）／Docker + nginx（自部署） | 纯静态文件分发，无服务器逻辑 |

选 Rust + WASM 而不是纯 JavaScript，是为了同一个排版核心将来可以直接复用到 CLI 或其他形态，且核心逻辑有完整的类型与测试保障。整站 gzip 约 130KB。

## 🛠️ 本地开发

需要 Rust（stable）、[wasm-pack](https://github.com/rustwasm/wasm-pack) 与 Node 20+。

```bash
git clone https://github.com/DylanChiang-Dev/DC-WeMark.git
cd DC-WeMark

cargo test               # 排版核心测试（纯 Rust）

cd web
npm install
npm run build:wasm       # 构建 WASM 到前端
npm run dev              # http://localhost:5173
npm run build            # 产出 dist/
npm run test:e2e         # Playwright e2e
```

## ☁️ 部署到 Cloudflare Pages

1. 在 Cloudflare Pages 创建 Direct Upload 项目，命名 `dc-wemark`。
2. 在 GitHub repo Secrets 设置 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。
3. 在 GitHub repo Variables 设置 `CF_DEPLOY=true` 以启用部署工作流。
4. push 到 `main` 触发 [`deploy.yml`](.github/workflows/deploy.yml)：构建后 `wrangler pages deploy`。

> Clipboard API 需要 HTTPS——Cloudflare Pages 自带 HTTPS，本地 `localhost` 也算安全上下文，均可正常复制。

## 📌 项目状态与路线图

当前版本：**1.0.0**（功能完成、自部署就绪；在线版待接入 Cloudflare 账号部署）。

- [x] **0.1.0** — 排版引擎 MVP：Markdown → 公众号兼容 HTML，含 1 套默认主题
- [x] **0.2.0** — 双栏编辑器 + 实时预览 + 一键复制
- [x] **0.3.0** — 多主题系统与主题切换 + 自定义强调色
- [x] **0.4.0** — 高级排版模块（提示框、卡片、金句、时间轴）
- [x] **1.0.0** — Docker 自部署方案 + Cloudflare Pages 部署流程

版本采用三段式语义化版本号，每个版本打 git tag。后续：富代码高亮的体积优化（延迟加载或 vendored 语法文件）。

## ⭐ Star 趋势

如果这个项目帮到你，点颗星——让更多还在手动调公众号排版的写作者看到它。

[![Star History Chart](https://api.star-history.com/svg?repos=DylanChiang-Dev/DC-WeMark&type=Date)](https://star-history.com/#DylanChiang-Dev/DC-WeMark&Date)

## 📄 授权与致谢

**MIT License**（版权人 Dylan Chiang 蒋涛）——可自由使用、修改、再发布（含商用），保留版权声明即可。

"Markdown 转公众号排版"是一个有众多先行者的领域，特此致谢其中的开拓者：

- [**doocs/md**](https://github.com/doocs/md) —— 网页版微信 Markdown 编辑器的形态先例（MIT）
- [**markdown-nice**](https://github.com/mdnice/markdown-nice) —— 主题化公众号排版的理念方向（GPL-3.0）
- [**md2wechat-skill**](https://github.com/geekjourneyx/md2wechat-skill) —— 排版模块扩展语法的理念启发（Source Available License）

> 仅借鉴功能理念与问题意识，**代码、主题样式、文案全部独立原创**——零代码借用、零样式复制。本项目为 clean-room 独立实现，开发过程不参考上述任何项目的源代码。
