//! 公眾號相容層：外鏈判定 + 防禦性禁用構造掃描。
//!
//! HTML 全程由本 crate 自產，故白名單主要作為測試斷言與最後防線，
//! 不引入重型 sanitizer。

/// 公眾號編輯器內允許保留的連結域名（其餘外鏈轉腳註）。
const ALLOWED_LINK_HOSTS: &[&str] = &["mp.weixin.qq.com"];

/// 判斷是否為「外部連結」（需要轉腳註）。
/// 相對連結、錨點、mailto、白名單域名皆視為非外部（保留原樣）。
pub fn is_external_link(url: &str) -> bool {
    let u = url.trim();
    let lower = u.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return false;
    }
    let after_scheme = match u.find("//") {
        Some(i) => &u[i + 2..],
        None => return false,
    };
    let host = after_scheme
        .split('/')
        .next()
        .unwrap_or("")
        .rsplit('@')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    !ALLOWED_LINK_HOSTS
        .iter()
        .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")))
}

/// 網址用途：連結與圖片允許的協定不同。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UrlKind {
    Link,
    Image,
}

/// 網址是否可安全輸出。無協定（相對路徑、錨點）視為安全；
/// 有協定時只允許白名單，擋下 `javascript:`、`vbscript:`、`data:text/html` 等。
pub fn is_safe_url(url: &str, kind: UrlKind) -> bool {
    // 瀏覽器解析網址時會忽略前後空白與控制字元、以及中間的 tab/換行，
    // 先做同樣的正規化，避免 `java\tscript:` 之類的繞過。
    let normalized: String = url
        .trim_matches(|c: char| c.is_ascii_whitespace() || c.is_ascii_control())
        .chars()
        .filter(|c| !matches!(c, '\t' | '\n' | '\r'))
        .collect();
    let lower = normalized.to_ascii_lowercase();
    let Some(scheme) = scheme_of(&lower) else {
        return true;
    };
    match kind {
        UrlKind::Link => matches!(scheme, "http" | "https" | "mailto"),
        UrlKind::Image => matches!(scheme, "http" | "https") || lower.starts_with("data:image/"),
    }
}

/// 圖片是否為本機或相對路徑（貼進公眾號後無法載入）。
pub fn is_local_image(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    matches!(scheme_of(&lower), None | Some("file"))
}

fn scheme_of(lower: &str) -> Option<&str> {
    let end = lower.find([':', '/', '?', '#'])?;
    if !lower[end..].starts_with(':') {
        return None;
    }
    let scheme = &lower[..end];
    let mut chars = scheme.chars();
    // 單一字母視為 Windows 磁碟路徑（`C:\img.png`），不是協定。
    let first_ok = scheme.len() > 1 && chars.next().is_some_and(|c| c.is_ascii_alphabetic());
    let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'));
    (first_ok && rest_ok).then_some(scheme)
}

/// 禁止出現在輸出中的構造（目前僅測試斷言使用）。
#[cfg(test)]
pub(crate) const FORBIDDEN: &[&str] = &["class=", "<style", "<script", "position:"];

/// 掃描輸出是否含禁用構造，回傳第一個命中的字串。
#[cfg(test)]
pub(crate) fn find_forbidden(html: &str) -> Option<&'static str> {
    FORBIDDEN.iter().copied().find(|f| html.contains(f))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_vs_internal() {
        assert!(is_external_link("https://www.rust-lang.org"));
        assert!(is_external_link("http://example.com/path"));
        assert!(!is_external_link("https://mp.weixin.qq.com/s/abc"));
        assert!(!is_external_link("#anchor"));
        assert!(!is_external_link("/relative"));
        assert!(!is_external_link("mailto:a@b.com"));
    }

    #[test]
    fn unsafe_url_schemes_are_rejected() {
        for url in [
            "javascript:alert(1)",
            " JavaScript:alert(1)",
            "java\tscript:alert(1)",
            "vbscript:x",
            "data:text/html,<script>1</script>",
        ] {
            assert!(!is_safe_url(url, UrlKind::Link), "{url}");
            assert!(!is_safe_url(url, UrlKind::Image), "{url}");
        }
        for url in [
            "https://a.com",
            "http://a.com",
            "mailto:a@b.com",
            "#x",
            "./a.md",
            "/a?b=c:d",
        ] {
            assert!(is_safe_url(url, UrlKind::Link), "{url}");
        }
        assert!(is_safe_url("data:image/png;base64,AAAA", UrlKind::Image));
        assert!(!is_safe_url("mailto:a@b.com", UrlKind::Image));
    }

    #[test]
    fn local_image_detection() {
        assert!(is_local_image("./img/a.png"));
        assert!(is_local_image("a.png"));
        assert!(is_local_image("C:\\img\\a.png"));
        assert!(is_local_image("file:///Users/a/a.png"));
        assert!(!is_local_image("https://a.com/a.png"));
        assert!(!is_local_image("data:image/png;base64,AAAA"));
    }

    #[test]
    fn forbidden_scan() {
        assert_eq!(
            find_forbidden("<section style=\"color:#000\">ok</section>"),
            None
        );
        assert_eq!(find_forbidden("<div class=\"x\">"), Some("class="));
        assert_eq!(
            find_forbidden("a { position: absolute }"),
            Some("position:")
        );
    }
}
