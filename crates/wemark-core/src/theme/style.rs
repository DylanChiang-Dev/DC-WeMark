//! 把 Style（屬性列表）字串化成 ` style="k:v;k:v;"`，並在此替換 {{accent}}。

use super::Style;

const ACCENT_TOKEN: &str = "{{accent}}";

/// 產生可直接接在標籤名後的 style 屬性字串（含前導空白）。
/// 空樣式回傳空字串（不輸出 style 屬性）。
pub fn render(pairs: Style, accent: &str) -> String {
    if pairs.is_empty() {
        return String::new();
    }
    let mut s = String::with_capacity(pairs.len() * 24);
    s.push_str(" style=\"");
    for (k, v) in pairs {
        s.push_str(k);
        s.push(':');
        if v.contains(ACCENT_TOKEN) {
            s.push_str(&v.replace(ACCENT_TOKEN, accent));
        } else {
            s.push_str(v);
        }
        s.push(';');
    }
    s.push('"');
    s
}

/// 在既有 style 屬性字串尾端補一段宣告（用於表格對齊等動態樣式）。
pub fn inject(style_attr: String, extra: &str) -> String {
    if style_attr.is_empty() {
        return format!(" style=\"{extra}\"");
    }
    let mut s = style_attr;
    // s 以 `"` 結尾，插到閉合引號之前
    debug_assert!(s.ends_with('"'));
    s.pop();
    s.push_str(extra);
    s.push('"');
    s
}
