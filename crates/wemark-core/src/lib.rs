//! wemark-core：把 Markdown 排版成微信公眾號相容的 inline-styled HTML。
//!
//! 管線：preprocess → comrak 解析 AST → 自寫渲染器（套主題、外鏈轉腳註）。

mod compat;
mod options;
mod parse;
mod preprocess;
mod render;
mod theme;
#[cfg(target_arch = "wasm32")]
mod wasm;

pub use options::{BackgroundStyle, FontFamily, FontSize, RenderOptions};
pub use theme::{Theme, ThemeMeta};

/// 渲染結果。
pub struct RenderResult {
    pub html: String,
    pub footnotes: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WemarkError {
    UnknownTheme(String),
}

impl std::fmt::Display for WemarkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WemarkError::UnknownTheme(id) => write!(f, "unknown theme: {id}"),
        }
    }
}

impl std::error::Error for WemarkError {}

/// 把 Markdown 渲染成公眾號相容 HTML。
pub fn render(
    markdown: &str,
    theme_id: &str,
    opts: &RenderOptions,
) -> Result<RenderResult, WemarkError> {
    let theme =
        theme::by_id(theme_id).ok_or_else(|| WemarkError::UnknownTheme(theme_id.to_string()))?;
    let pre = preprocess::expand(markdown);
    let arena = comrak::Arena::new();
    let options = parse::options();
    let root = comrak::parse_document(&arena, &pre, &options);

    let mut writer = render::Writer::new(theme, opts);
    let html = writer.finish(root);
    let footnotes = writer.footnote_count();
    let warnings = std::mem::take(&mut writer.warnings);

    Ok(RenderResult {
        html,
        footnotes,
        warnings,
    })
}

/// 所有可用主題。
pub fn themes() -> &'static [Theme] {
    theme::all()
}
