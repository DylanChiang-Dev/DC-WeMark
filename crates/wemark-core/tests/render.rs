use wemark_core::{render, RenderOptions};

fn r(md: &str) -> String {
    render(md, "default", &RenderOptions::default())
        .expect("default theme renders")
        .html
}

#[test]
fn wraps_in_root_section_with_styles() {
    let html = r("# 標題\n\n這是一段**粗體**與*斜體*文字。");
    assert!(
        html.starts_with("<section style=\""),
        "root section missing: {html}"
    );
    assert!(html.contains("<h1 style=\""));
    assert!(html.contains("粗體"));
    assert!(html.contains("<strong style=\""));
}

#[test]
fn output_has_no_forbidden_constructs() {
    let md = "# T\n\n\
              普通段落與 `行內碼`。\n\n\
              ```rust\nfn main() { println!(\"hi\"); }\n```\n\n\
              > 引言區塊\n\n\
              | 左 | 中 | 右 |\n|:--|:-:|--:|\n| a | b | c |\n\n\
              - [x] 已完成\n- [ ] 待辦\n\n\
              1. 一\n2. 二\n\n---\n";
    let html = r(md);
    if let Some(bad) = wemark_core_forbidden(&html) {
        panic!("output contains forbidden `{bad}`:\n{html}");
    }
}

// 內嵌一份禁用構造掃描（compat::FORBIDDEN 未對外導出，測試自帶一份）。
fn wemark_core_forbidden(html: &str) -> Option<&'static str> {
    ["class=", "<style", "<script", "position:", " id="]
        .into_iter()
        .find(|f| html.contains(f))
}

#[test]
fn external_link_becomes_footnote() {
    let html = r("參見 [Rust 官網](https://www.rust-lang.org) 的說明。");
    assert!(
        html.contains("<sup style=\""),
        "footnote sup missing: {html}"
    );
    assert!(html.contains("[1]"));
    assert!(html.contains("參考連結"));
    assert!(html.contains("rust-lang.org"));
}

#[test]
fn weixin_link_is_kept_not_footnoted() {
    let html = r("看 [這篇](https://mp.weixin.qq.com/s/abc)。");
    assert!(html.contains("<a href="));
    assert!(!html.contains("參考連結"));
}

#[test]
fn code_block_has_themed_shell_and_escaped_content() {
    let html = r("```rust\nlet x = 1 < 2;\n```");
    assert!(
        html.contains("<pre style=\""),
        "code block shell missing: {html}"
    );
    // 內容轉義（< 變 &lt;），且不論是否高亮都保留原始碼文字。
    // （高亮模式下 token 會被拆進不同 span，故只驗單一 token 而非連續子字串。）
    assert!(
        html.contains("&lt;"),
        "code content should be escaped: {html}"
    );
    assert!(html.contains("let"), "code text missing: {html}");
}

#[cfg(feature = "syntax-highlight")]
#[test]
fn code_block_is_color_highlighted_when_feature_on() {
    let html = r("```rust\nlet x = 1;\n```");
    assert!(
        html.contains("color:#"),
        "expected inline-colored spans with syntax-highlight: {html}"
    );
}

#[test]
fn raw_html_is_escaped() {
    let html = r("<div onclick=\"x\">hi</div>\n");
    assert!(
        html.contains("&lt;div"),
        "raw html should be escaped: {html}"
    );
    assert!(!html.contains("<div"));
}

#[test]
fn unknown_theme_errors() {
    assert!(render("x", "does-not-exist", &RenderOptions::default()).is_err());
}

#[test]
fn themes_list_contains_default() {
    assert!(wemark_core::themes().iter().any(|t| t.meta.id == "default"));
}
