//! 把 Style（屬性列表）字串化成 ` style="k:v;k:v;"`，並在此替換 {{accent}}。

use super::Style;

const ACCENT_TOKEN: &str = "{{accent}}";

pub fn render_scaled(pairs: Style, accent: &str, font_delta_px: i16) -> String {
    if pairs.is_empty() {
        return String::new();
    }
    let mut s = String::with_capacity(pairs.len() * 24);
    s.push_str(" style=\"");
    for (k, v) in pairs {
        s.push_str(k);
        s.push(':');
        // CSS 值可能含雙引號（font-family: "PingFang SC"）——必須做 HTML 屬性轉義，
        // 否則會提前關閉 style="…" 屬性、產生壞掉的 HTML（貼進公眾號會失真）。
        let mut resolved = if v.contains(ACCENT_TOKEN) {
            v.replace(ACCENT_TOKEN, accent)
        } else {
            (*v).to_string()
        };
        if *k == "font-size" {
            resolved = scale_px(&resolved, font_delta_px);
        }
        s.push_str(&crate::render::escape(&resolved));
        s.push(';');
    }
    s.push('"');
    s
}

fn scale_px(value: &str, delta: i16) -> String {
    let Some(raw) = value.strip_suffix("px") else {
        return value.to_string();
    };
    let Ok(size) = raw.parse::<i16>() else {
        return value.to_string();
    };
    format!("{}px", (size + delta).max(10))
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
