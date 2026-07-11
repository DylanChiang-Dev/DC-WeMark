//! 主題型別與查詢。實際的主題資料由 build.rs 從 themes/*.toml 生成，
//! 於編譯期 include 進來（見底部 `include!`）。

pub mod style;

/// 一組 CSS 屬性（key, value）。value 可能仍含 `{{accent}}`，執行期替換。
pub type Style = &'static [(&'static str, &'static str)];

#[derive(Debug, Clone, Copy)]
pub struct ThemeMeta {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub accent: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct CodeStyle {
    /// syntect 高亮主題名（配色），例如 "InspiredGitHub"。
    pub theme: &'static str,
    /// 程式碼區塊外殼樣式（背景、圓角、padding…）。
    pub block: Style,
}

#[derive(Debug, Clone, Copy)]
pub struct Theme {
    pub meta: ThemeMeta,
    pub root: Style,
    pub elements: &'static [(&'static str, Style)],
    pub code: CodeStyle,
}

impl Theme {
    /// 查某元素的樣式；找不到回傳空切片（該元素不套樣式，仍是合法輸出）。
    pub fn element(&self, key: &str) -> Style {
        self.elements
            .iter()
            .find(|(k, _)| *k == key)
            .map(|(_, s)| *s)
            .unwrap_or(&[])
    }
}

// build.rs 生成：`pub static THEMES: &[Theme] = &[ ... ];`
include!(concat!(env!("OUT_DIR"), "/themes_gen.rs"));

pub fn all() -> &'static [Theme] {
    THEMES
}

pub fn by_id(id: &str) -> Option<&'static Theme> {
    THEMES.iter().find(|t| t.meta.id == id)
}
