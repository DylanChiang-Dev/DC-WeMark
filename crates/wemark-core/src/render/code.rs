//! 程式碼區塊高亮 → inline-styled HTML。
//!
//! `syntax-highlight` feature（預設關）用 syntect（fancy-regex）產生帶 color 的
//! span；關閉時退化為純文字轉義（保留區塊外殼樣式）。前端首屏載入精簡版，
//! 文章含程式碼區塊時再延遲載入開啟此 feature 的另一份 wasm。

#[cfg(feature = "syntax-highlight")]
mod imp {
    use std::sync::OnceLock;

    use syntect::dumps::from_uncompressed_data;
    use syntect::easy::HighlightLines;
    use syntect::highlighting::ThemeSet;
    use syntect::html::{styled_line_to_highlighted_html, IncludeBackground};
    use syntect::parsing::SyntaxSet;
    use syntect::util::LinesWithEndings;

    // build.rs 產出的精簡 dump（僅常用語言 / 少數主題），編譯期嵌入。
    static SYNTAX_DUMP: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/syntaxes.packdump"));
    static THEME_DUMP: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/themes.packdump"));

    fn syntax_set() -> &'static SyntaxSet {
        static S: OnceLock<SyntaxSet> = OnceLock::new();
        S.get_or_init(|| from_uncompressed_data(SYNTAX_DUMP).expect("valid syntax dump"))
    }

    fn theme_set() -> &'static ThemeSet {
        static T: OnceLock<ThemeSet> = OnceLock::new();
        T.get_or_init(|| from_uncompressed_data(THEME_DUMP).expect("valid theme dump"))
    }

    pub fn highlight(code: &str, lang: &str, theme_name: &str) -> String {
        let ss = syntax_set();
        let ts = theme_set();
        let syntax = ss
            .find_syntax_by_token(lang)
            .unwrap_or_else(|| ss.find_syntax_plain_text());
        let theme = ts
            .themes
            .get(theme_name)
            .or_else(|| ts.themes.get("InspiredGitHub"))
            .or_else(|| ts.themes.values().next())
            .expect("syntect default theme set is never empty");

        let mut h = HighlightLines::new(syntax, theme);
        let mut out = String::with_capacity(code.len() * 2);
        for line in LinesWithEndings::from(code) {
            match h.highlight_line(line, ss) {
                Ok(ranges) => match styled_line_to_highlighted_html(&ranges, IncludeBackground::No)
                {
                    Ok(html) => out.push_str(&html),
                    Err(_) => out.push_str(&crate::render::escape(line)),
                },
                Err(_) => out.push_str(&crate::render::escape(line)),
            }
        }
        out
    }
}

#[cfg(not(feature = "syntax-highlight"))]
mod imp {
    pub fn highlight(code: &str, _lang: &str, _theme: &str) -> String {
        crate::render::escape(code)
    }
}

/// 將 `code` 以 `lang` 語法、`theme_name` 配色高亮成 inline-styled HTML 片段。
pub fn highlight(code: &str, lang: &str, theme_name: &str) -> String {
    imp::highlight(code, lang, theme_name)
}
