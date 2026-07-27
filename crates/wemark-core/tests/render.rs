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
fn every_theme_renders_square_paper_background() {
    for theme in wemark_core::themes() {
        let html = render("手帳內文", theme.meta.id, &RenderOptions::default())
            .unwrap_or_else(|_| panic!("theme {} failed to render", theme.meta.id))
            .html;
        let root_tag = html.split_once('>').expect("root tag closes").0;

        assert!(
            root_tag.contains("background-color:#fff;"),
            "theme {} root should have a paper color: {root_tag}",
            theme.meta.id
        );
        assert!(
            root_tag.contains("background-image:linear-gradient("),
            "theme {} root should render grid lines: {root_tag}",
            theme.meta.id
        );
        assert!(
            root_tag.contains("background-size:24px 24px;"),
            "theme {} root should use a stable square grid: {root_tag}",
            theme.meta.id
        );
        assert!(
            root_tag.contains("padding:24px 20px;"),
            "theme {} root should keep text clear of the paper edge: {root_tag}",
            theme.meta.id
        );
    }
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
fn style_attribute_quotes_are_escaped() {
    // font-family 含雙引號的值必須被轉義，否則會提前關閉 style="…" 屬性。
    let html = r("# 標題\n\n內文");
    assert!(
        html.contains("&quot;"),
        "font-family quotes should be escaped to &quot;: {html}"
    );
    // 不應出現「未轉義雙引號緊接非空白」這種壞掉的屬性徵兆
    assert!(
        !html.contains("font-family:\""),
        "raw double-quote right after font-family breaks the attribute: {html}"
    );
}

#[test]
fn container_renders_section_shell() {
    let html = r("::: note\n這是一段提示。\n:::\n");
    // 容器外殼 + 內部段落都在
    assert!(
        html.contains("border-left:4px solid #3b82f6"),
        "note shell missing: {html}"
    );
    assert!(html.contains("這是一段提示"));
    // 內部 markdown 仍被解析成 <p>
    assert!(html.contains("<p style=\""));
}

#[test]
fn nested_containers_balance() {
    let html = r("::: card\n外層\n\n::: tip\n內層\n:::\n\n:::\n");
    let opens = html.matches("<section").count();
    let closes = html.matches("</section>").count();
    assert_eq!(opens, closes, "unbalanced sections: {html}");
    assert!(html.contains("外層") && html.contains("內層"));
}

#[test]
fn unclosed_container_auto_closes_without_losing_content() {
    let res = render("::: warn\n沒有關閉\n", "default", &RenderOptions::default()).unwrap();
    assert!(res.html.contains("沒有關閉"));
    assert_eq!(
        res.html.matches("<section").count(),
        res.html.matches("</section>").count()
    );
    assert!(!res.warnings.is_empty(), "should warn about auto-close");
}

#[test]
fn colons_inside_code_fence_are_literal() {
    let html = r("```\n::: note\n:::\n```\n");
    // 不應產生容器 section（除了根 section）
    assert_eq!(
        html.matches("<section").count(),
        1,
        "fence content became a container: {html}"
    );
    assert!(html.contains("::: note"));
}

#[test]
fn unknown_theme_errors() {
    assert!(render("x", "does-not-exist", &RenderOptions::default()).is_err());
}

#[test]
fn themes_list_contains_default() {
    assert!(wemark_core::themes().iter().any(|t| t.meta.id == "default"));
}

#[test]
fn every_theme_renders_rich_doc_without_forbidden() {
    let md = "# 標題\n\n**粗體** *斜體* `碼` [外鏈](https://example.com)\n\n\
              > 引言\n\n\
              | 左 | 右 |\n|:--|--:|\n| 1 | 2 |\n\n\
              - a\n- b\n\n1. 一\n2. 二\n\n\
              ```rust\nfn main() {}\n```\n\n---\n";
    let themes = wemark_core::themes();
    assert!(
        themes.len() >= 4,
        "expected >=4 themes, got {}",
        themes.len()
    );
    for t in themes {
        let html = render(md, t.meta.id, &RenderOptions::default())
            .unwrap_or_else(|_| panic!("theme {} failed to render", t.meta.id))
            .html;
        assert!(
            html.starts_with("<section style=\""),
            "theme {} missing root section",
            t.meta.id
        );
        for bad in ["class=", "<style", "<script", "position:", " id="] {
            assert!(
                !html.contains(bad),
                "theme {} output contains forbidden `{bad}`",
                t.meta.id
            );
        }
    }
}
