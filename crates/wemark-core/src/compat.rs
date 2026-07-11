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
