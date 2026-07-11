//! `:::` 容器的外殼樣式（code-driven，依主題強調色著色）。
//!
//! 語義提示框（note/tip/warn/danger）用固定語義色，跨主題一致好認；
//! card/quote/timeline 用主題強調色，隨主題變化。全部輸出 inline style。

use crate::render::escape;

/// 回傳可接在 `<section` 後的 style 屬性字串（含前導空白）。
pub fn shell_style(name: &str, accent: &str) -> String {
    let accent = escape(accent);
    match name {
        "note" | "info" => callout("#3b82f6", "#eff6ff"),
        "tip" | "success" => callout("#10b981", "#ecfdf5"),
        "warn" | "warning" => callout("#f59e0b", "#fffbeb"),
        "danger" | "error" => callout("#ef4444", "#fef2f2"),
        "card" => " style=\"margin:18px 0;padding:16px 18px;background:#ffffff;\
             border:1px solid #ececf2;border-radius:12px;\""
            .to_string(),
        "quote" => format!(
            " style=\"margin:20px 0;padding:16px 20px;background:#f7f8fc;\
             border-radius:10px;border-left:4px solid {accent};\""
        ),
        "timeline" => format!(
            " style=\"margin:18px 0;padding:4px 0 4px 20px;border-left:2px solid {accent};\""
        ),
        _ => format!(
            " style=\"margin:18px 0;padding:12px 16px;background:#f7f8fc;\
             border-radius:8px;border-left:4px solid {accent};\""
        ),
    }
}

fn callout(bar: &str, bg: &str) -> String {
    format!(
        " style=\"margin:18px 0;padding:12px 16px;background:{bg};\
         border-left:4px solid {bar};border-radius:0 8px 8px 0;\""
    )
}
