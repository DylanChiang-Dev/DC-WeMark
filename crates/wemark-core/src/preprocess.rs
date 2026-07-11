//! `:::` 容器語法預處理。
//!
//! 把 `::: name` / `:::` 兩種行改寫成 HTML 註解標記行
//! （`<!--wm:open:name-->` / `<!--wm:close-->`），comrak 會解析成獨立的
//! HtmlBlock 節點，容器內部的 Markdown 照常被解析；渲染器用容器深度配對輸出
//! `<section>` 外殼。code fence（``` 或 ~~~）內的 `:::` 不改寫。

pub fn expand(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 64);
    let mut fence: Option<char> = None;

    for line in input.split_inclusive('\n') {
        let body = line.trim_end_matches(['\n', '\r']);
        let trimmed = body.trim_start();

        // code fence 追蹤：圍欄內原樣輸出
        if let Some(fc) = fence {
            if is_fence(trimmed, fc) {
                fence = None;
            }
            out.push_str(line);
            continue;
        }
        if let Some(fc) = opening_fence(trimmed) {
            fence = Some(fc);
            out.push_str(line);
            continue;
        }

        // 容器標記（僅在非圍欄時）
        if let Some(rest) = trimmed.strip_prefix(":::") {
            let name = rest.trim();
            if name.is_empty() {
                out.push_str("\n<!--wm:close-->\n\n");
            } else {
                out.push_str(&format!("\n<!--wm:open:{}-->\n\n", sanitize_name(name)));
            }
            continue;
        }

        out.push_str(line);
    }

    out
}

/// 圍欄字元（``` → '`'，~~~ → '~'），非圍欄回傳 None。
fn opening_fence(trimmed: &str) -> Option<char> {
    if trimmed.starts_with("```") {
        Some('`')
    } else if trimmed.starts_with("~~~") {
        Some('~')
    } else {
        None
    }
}

/// 是否為對應字元的收尾圍欄（至少三個）。
fn is_fence(trimmed: &str, fc: char) -> bool {
    let n = trimmed.chars().take_while(|&c| c == fc).count();
    n >= 3
}

/// 取第一個 token、只保留 a-z0-9- 並轉小寫；空則回傳 "block"。
fn sanitize_name(raw: &str) -> String {
    let token = raw.split_whitespace().next().unwrap_or("");
    let cleaned: String = token
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .map(|c| c.to_ascii_lowercase())
        .collect();
    if cleaned.is_empty() {
        "block".to_string()
    } else {
        cleaned
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_open_and_close() {
        let out = expand("::: note\nhi\n:::\n");
        assert!(out.contains("<!--wm:open:note-->"));
        assert!(out.contains("<!--wm:close-->"));
    }

    #[test]
    fn leaves_colons_inside_code_fence() {
        let out = expand("```\n::: note\n```\n");
        assert!(!out.contains("wm:open"));
        assert!(out.contains("::: note"));
    }

    #[test]
    fn sanitizes_weird_names() {
        let out = expand("::: Warn! extra\nx\n:::\n");
        assert!(out.contains("<!--wm:open:warn-->"));
    }
}
