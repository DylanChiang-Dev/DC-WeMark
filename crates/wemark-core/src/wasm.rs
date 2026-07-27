//! wasm-bindgen 薄殼：JSON 進出，不含業務邏輯。

use wasm_bindgen::prelude::*;

use crate::RenderOptions;

/// 渲染。回傳 JSON：成功 `{"ok":true,"html":"…","footnotes":n}`，
/// 失敗 `{"ok":false,"error":"…"}`。`accent` 空字串表示不覆寫。
#[wasm_bindgen]
pub fn wm_render(
    markdown: &str,
    theme_id: &str,
    external_footnotes: bool,
    accent: &str,
    background: &str,
    font_size: &str,
    font_family: &str,
) -> String {
    let opts = RenderOptions {
        external_links_as_footnotes: external_footnotes,
        accent: if accent.is_empty() {
            None
        } else {
            Some(accent.to_string())
        },
        background: crate::BackgroundStyle::from(background),
        font_size: crate::FontSize::from(font_size),
        font_family: crate::FontFamily::from(font_family),
    };
    match crate::render(markdown, theme_id, &opts) {
        Ok(r) => format!(
            "{{\"ok\":true,\"html\":{},\"footnotes\":{}}}",
            json_str(&r.html),
            r.footnotes
        ),
        Err(e) => format!("{{\"ok\":false,\"error\":{}}}", json_str(&e.to_string())),
    }
}

/// 所有主題的 meta，JSON 陣列。
#[wasm_bindgen]
pub fn wm_themes() -> String {
    let mut s = String::from("[");
    for (i, t) in crate::themes().iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        s.push_str(&format!(
            "{{\"id\":{},\"name\":{},\"description\":{},\"accent\":{}}}",
            json_str(t.meta.id),
            json_str(t.meta.name),
            json_str(t.meta.description),
            json_str(t.meta.accent)
        ));
    }
    s.push(']');
    s
}

#[wasm_bindgen]
pub fn wm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn json_str(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}
