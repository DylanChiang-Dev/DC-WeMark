# DC-WeMark

在浏览器里把 Markdown 排版成微信公众号文章。左边写 Markdown，右边实时预览公众号效果，一键复制、粘贴进公众号编辑器即可发布。

Write Markdown, preview it as a styled WeChat Official Account article, and copy it into the WeChat editor with one click — entirely in your browser.

## 特性

- **纯前端，无后端**：排版核心用 Rust 编写并编译为 WebAssembly，所有转换都在浏览器本地完成，文章内容不会离开你的设备
- **实时预览**：双栏编辑器，左侧 Markdown、右侧公众号样式预览
- **一键复制**：以富文本（inline style HTML）写入剪贴板，直接粘贴进公众号编辑器即保留全部样式
- **多主题**：内置多套原创排版主题，可切换
- **静态部署**：部署产物是一包静态文件，托管在 Cloudflare Pages；也提供 Dockerfile 供自架

## 项目状态

早期开发中（early development），尚未发布可用版本。

## 规划

- [ ] Rust 排版核心：Markdown → inline-styled HTML（适配公众号编辑器的标签与样式限制）
- [ ] WASM 构建与前端编辑器壳（双栏 + 主题切换 + 一键复制）
- [ ] 原创主题若干
- [ ] Cloudflare Pages 自动部署
- [ ] Dockerfile（自架）

## 开发

技术栈：Rust（核心库，编译至 WASM）+ 轻量前端壳。构建与本地开发说明将随首个可运行版本补充。

## License

[MIT](LICENSE)
