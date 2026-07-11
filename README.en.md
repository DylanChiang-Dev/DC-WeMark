Languages: [繁體中文](README.md) | [简体中文](README.zh-CN.md) | [English](README.en.md)

<div align="center">

# DC-WeMark

### Markdown to WeChat Official Account articles, in your browser

**Write Markdown on the left, preview the styled WeChat article on the right, copy it into the WeChat editor with one click.**

<strong>Frontend only. Zero backend.</strong><br/>
The typesetting core is written in Rust and compiled to WebAssembly, running entirely in your browser;<br/>
your article never leaves your device — no server, no account, no upload.

<br/>

[![Stars](https://img.shields.io/github/stars/DylanChiang-Dev/DC-WeMark?style=for-the-badge&logo=github&color=ffca28)](https://github.com/DylanChiang-Dev/DC-WeMark/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50?style=for-the-badge)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-core-ce422b?style=for-the-badge&logo=rust)](#architecture)
[![WebAssembly](https://img.shields.io/badge/WASM-in--browser-654ff0?style=for-the-badge&logo=webassembly&logoColor=white)](#architecture)
[![Status](https://img.shields.io/badge/status-early_development-9e9e9e?style=for-the-badge)](#status--roadmap)

</div>

---

If you write in Markdown and publish on WeChat Official Accounts, you have probably hit these walls: the WeChat editor does not accept Markdown; pasted content loses all styling; online converters upload your entire article to someone else's server.

DC-WeMark fixes exactly this gap: **write in the Markdown you already know, and get markup the WeChat editor natively understands with one click** — with the whole conversion happening inside your own browser.

## 🧭 Core Beliefs

> ### Your article belongs to you alone.

- **Frontend only, no backend.** No server logic, no database, no accounts. The deployment artifact is a bundle of static files.
- **Content never leaves the device.** From Markdown input to HTML copy, every step runs locally in the browser; it even works offline.
- **No kitchen sink.** One job only: format, preview, copy. No AI writing, no account management, no publishing API.
- **All themes are original.** Every theme's palette, spacing, and layout is designed by this project.

## 🗺️ How It Works

```mermaid
flowchart LR
    A([📝 Markdown]) --> B[Parse to AST<br/>Rust · comrak]
    B --> C[Theme engine<br/>all styles inlined as inline CSS]
    C --> D[WeChat-compatible HTML<br/>unsupported tags/attrs filtered]
    D --> E([👀 Live preview])
    D --> F([📋 One-click copy<br/>Clipboard API · text/html])
    F --> G([✅ Paste into WeChat editor<br/>styles fully preserved])
```

The two middle steps are the crux: the WeChat editor **only accepts rich text with inline styles** — no `<style>` tags, no classes, no `position`, and a long list of other everyday CSS. DC-WeMark's engine inlines theme styles onto every element and strips what the editor would swallow, so "paste is what you see" actually holds.

## ✨ Features

| Feature | Description | Status |
|---|---|---|
| Split-pane editor | Markdown input on the left, live WeChat-styled preview on the right | 🚧 In progress |
| Typesetting engine | CommonMark + GFM (tables, code blocks, task lists) to WeChat-compatible inline-styled HTML | 🚧 In progress |
| One-click copy | Writes `text/html` to the clipboard; paste into the WeChat editor with all styles intact | 🚧 In progress |
| Original themes | Multiple switchable typesetting themes for different article tones | ⬜ Planned |
| Layout modules | Extended syntax for cards, pull quotes, timelines, and other advanced layouts | ⬜ Planned |
| Code highlighting | Syntax highlighting adapted to WeChat editor constraints | ⬜ Planned |
| Offline capable | Static site + WASM; keeps working without a network after first load | ⬜ Planned |

## 🚀 Getting Started

> Early development — no usable release yet. Once the first release ships, this section becomes one sentence: **open the page and start writing.**

Two ways to use it, eventually:

1. **Hosted**: on Cloudflare Pages, zero install.
2. **Self-hosted**: a one-line `docker run` serves the same static site on your own server or NAS.

## 🧱 Architecture

| Layer | Tech | Responsibility |
|---|---|---|
| Typesetting core | Rust (compiled to WebAssembly) | Markdown parsing, theme style inlining, WeChat HTML compatibility |
| Frontend shell | Lightweight web frontend | Split-pane editor, theme switching, clipboard write |
| Deployment | Cloudflare Pages (primary) / Docker + nginx (self-host) | Static file serving, no server logic |

Rust + WASM instead of plain JavaScript, so the same core can later be reused in a CLI or other form factors, with full type and test coverage on the core logic.

## 🛠️ Development

```bash
git clone https://github.com/DylanChiang-Dev/DC-WeMark.git
cd DC-WeMark
```

Full toolchain instructions (Rust + wasm-pack + frontend) will land with the first runnable version.

## 📌 Status & Roadmap

Current version: **pre-0.0.1** (repository just created, core under development).

- [ ] **0.1.0** — Engine MVP: Markdown → WeChat-compatible HTML, with 1 default theme
- [ ] **0.2.0** — Split-pane editor + live preview + one-click copy
- [ ] **0.3.0** — Multi-theme system and switching
- [ ] **0.4.0** — Advanced layout modules (cards, pull quotes, timelines, …)
- [ ] **1.0.0** — Hosted release on Cloudflare Pages + Docker self-hosting

Semantic three-part versioning; every release gets a git tag.

## ⭐ Star History

If this project helps you, star it — help more writers still hand-tweaking WeChat layouts find it.

[![Star History Chart](https://api.star-history.com/svg?repos=DylanChiang-Dev/DC-WeMark&type=Date)](https://star-history.com/#DylanChiang-Dev/DC-WeMark&Date)

## 📄 License & Acknowledgements

**MIT License** (copyright Dylan Chiang) — free to use, modify, and redistribute (commercial use included), as long as the copyright notice is kept.

"Markdown to WeChat typesetting" is a space with many pioneers; credit where it is due:

- [**doocs/md**](https://github.com/doocs/md) — the web-editor form factor precedent (MIT)
- [**markdown-nice**](https://github.com/mdnice/markdown-nice) — the themed-typesetting direction (GPL-3.0)
- [**md2wechat-skill**](https://github.com/geekjourneyx/md2wechat-skill) — the layout-module syntax idea (Source Available License)

> Only ideas and problem framing were borrowed. **All code, theme styles, and copy are independently original** — zero code borrowed, zero styles copied. This is a clean-room implementation; none of the above projects' source code is consulted during development.
