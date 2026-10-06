use wemark_core::{render, BackgroundStyle, FontFamily, FontSize, Locale, RenderOptions};

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
fn only_apple_theme_renders_soft_white_by_default() {
    let themes = wemark_core::themes();
    assert_eq!(themes.len(), 1, "only one public theme should remain");
    assert_eq!(themes[0].meta.id, "default");
    assert_eq!(themes[0].meta.name, "蘋果風");

    let html = r("手帳內文");
    let root_tag = html.split_once('>').expect("root tag closes").0;
    assert!(root_tag.contains("background-color:#fafafa;"), "{root_tag}");
    assert!(root_tag.contains("padding:24px 20px;"), "{root_tag}");
}

#[test]
fn background_styles_render_distinct_root_styles() {
    let cases = [
        (
            BackgroundStyle::Grid,
            Some("background-color:#ffffff;"),
            true,
        ),
        (
            BackgroundStyle::Warm,
            Some("background-color:#fafafa;"),
            false,
        ),
        (BackgroundStyle::None, None, false),
    ];

    for (background, color, has_grid) in cases {
        let html = render(
            "背景測試",
            "default",
            &RenderOptions {
                background,
                ..RenderOptions::default()
            },
        )
        .expect("default theme renders")
        .html;
        let root_tag = html.split_once('>').expect("root tag closes").0;

        assert!(root_tag.contains("padding:24px 20px;"));
        assert_eq!(
            root_tag.contains("background-image:linear-gradient("),
            has_grid
        );
        assert_eq!(root_tag.contains("background-size:24px 24px;"), has_grid);
        // 只有用漸層畫格線的方格紙需要聲明深色模式豁免。
        assert_eq!(
            root_tag.contains("data-ignore-dm=\"text-bg-gradient\""),
            has_grid
        );
        if let Some(color) = color {
            assert!(root_tag.contains(color), "{root_tag}");
        } else {
            assert!(!root_tag.contains("background-color:"), "{root_tag}");
        }
    }
}

#[test]
fn font_size_scales_body_and_headings() {
    let cases = [
        (FontSize::Small, "font-size:14px;", "font-size:26px;"),
        (FontSize::Medium, "font-size:16px;", "font-size:28px;"),
        (FontSize::Large, "font-size:18px;", "font-size:30px;"),
    ];

    for (font_size, body_size, heading_size) in cases {
        let html = render(
            "# 字級測試",
            "default",
            &RenderOptions {
                font_size,
                ..RenderOptions::default()
            },
        )
        .expect("default theme renders")
        .html;
        let root_tag = html.split_once('>').expect("root tag closes").0;
        let heading_tag = html.split_once("<h1 ").expect("h1 opens").1;

        assert!(root_tag.contains(body_size), "{root_tag}");
        assert!(heading_tag.contains(heading_size), "{heading_tag}");
    }
}

#[test]
fn font_family_override_is_inlined_on_the_article_root() {
    let html = render(
        "# 字體測試",
        "default",
        &RenderOptions {
            font_family: FontFamily::Serif,
            ..RenderOptions::default()
        },
    )
    .expect("default theme renders")
    .html;
    let root_tag = html.split_once('>').expect("root tag closes").0;

    assert!(
        root_tag.contains("font-family:Georgia,Songti SC"),
        "{root_tag}"
    );
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
    // 公眾號會對手機上水平溢出的 <pre> 提示風險，程式碼必須自動換行。
    assert!(html.contains("white-space:pre-wrap;"), "{html}");
    assert!(!html.contains("white-space:pre;"), "{html}");
    assert!(!html.contains("overflow-x:"), "{html}");
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
fn apple_theme_has_fixed_heading_color_and_custom_accent_details() {
    let html = render(
        "# 一級標題\n\n## 二級標題\n\n> 引用\n\n**重點**",
        "default",
        &RenderOptions {
            accent: Some("#ff0066".to_string()),
            ..RenderOptions::default()
        },
    )
    .expect("apple theme renders")
    .html;

    // 不用漸層：公眾號深色模式會把漸層拍扁成單一色標，導致深淺兩種模式顏色不一致。
    assert!(
        html.contains("background:#6f5df6;"),
        "h2 should keep the fixed signature colour: {html}"
    );
    assert!(
        !html.contains("linear-gradient"),
        "theme must not emit gradients: {html}"
    );
    assert!(
        html.contains("color:#ff0066;"),
        "custom accent should apply: {html}"
    );
    assert!(
        !html.contains("background:#ff0066;"),
        "custom accent must not replace the signature colour: {html}"
    );
}

#[test]
fn every_theme_styles_standard_markdown_elements() {
    let required = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "strong",
        "em",
        "del",
        "a",
        "blockquote",
        "ul",
        "ol",
        "li",
        "hr",
        "img",
        "code-inline",
        "table",
        "th",
        "td",
    ];

    for theme in wemark_core::themes() {
        for element in required {
            assert!(
                !theme.element(element).is_empty(),
                "theme {} is missing a style for {element}",
                theme.meta.id
            );
        }
    }
}

#[test]
fn every_theme_renders_rich_doc_without_forbidden() {
    let md = "# 標題\n\n**粗體** *斜體* `碼` [外鏈](https://example.com)\n\n\
              > 引言\n\n\
              | 左 | 右 |\n|:--|--:|\n| 1 | 2 |\n\n\
              - a\n- b\n\n1. 一\n2. 二\n\n\
              ```rust\nfn main() {}\n```\n\n---\n";
    let themes = wemark_core::themes();
    assert_eq!(themes.len(), 1, "only the Apple theme should be public");
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

#[test]
fn unsafe_link_keeps_text_but_drops_href() {
    let res = render(
        "點 [這裡](javascript:alert(1)) 看看",
        "default",
        &RenderOptions::default(),
    )
    .unwrap();
    assert!(!res.html.contains("javascript:"), "{}", res.html);
    assert!(!res.html.contains("<a "), "{}", res.html);
    assert!(res.html.contains("這裡"));
    assert!(res.warnings.iter().any(|w| w.contains("不安全的链接")));
}

#[test]
fn unsafe_image_is_replaced_by_alt_text() {
    let res = render(
        "![示意](javascript:alert(1))",
        "default",
        &RenderOptions::default(),
    )
    .unwrap();
    assert!(!res.html.contains("<img"), "{}", res.html);
    assert!(res.html.contains("示意"));
    assert!(res.warnings.iter().any(|w| w.contains("不安全的图片")));

    let res = render(
        "[A & B](javascript:x)",
        "default",
        &RenderOptions::default(),
    )
    .unwrap();
    assert!(
        res.warnings.iter().any(|w| w.ends_with("A & B")),
        "{:?}",
        res.warnings
    );
}

#[test]
fn local_images_warn_and_remote_images_are_counted() {
    let res = render(
        "![本機](./a.png)\n\n![網路](https://example.com/b.png)",
        "default",
        &RenderOptions::default(),
    )
    .unwrap();
    assert!(
        res.warnings.iter().any(|w| w.contains("本地或相对路径")),
        "{:?}",
        res.warnings
    );
    assert_eq!(res.remote_images, 1);
}

#[test]
fn repeated_external_url_reuses_footnote_number() {
    let res = render(
        "[A](https://example.com) 與 [B](https://example.com) 及 [C](https://rust-lang.org)",
        "default",
        &RenderOptions::default(),
    )
    .unwrap();
    assert_eq!(res.footnotes, 2);
    assert_eq!(res.html.matches("[1]").count(), 3, "{}", res.html);
    assert!(res.html.contains("[2]"));
    assert!(!res.html.contains("[3]"));
}

#[test]
fn markdown_footnotes_render_as_notes() {
    let html = r("正文[^a]與第二處[^b]。\n\n[^b]: 第二條\n[^a]: 第一條\n");
    assert!(!html.contains("[^a]"), "{html}");
    assert!(html.contains("[註1]") && html.contains("[註2]"), "{html}");
    assert!(html.contains("註釋"), "{html}");
    let first = html.find("[註1] 第一條").expect("note 1 text");
    let second = html.find("[註2] 第二條").expect("note 2 text");
    assert!(first < second, "{html}");
    assert_eq!(
        html.matches("<section").count(),
        html.matches("</section>").count()
    );
}

#[test]
fn simplified_locale_changes_generated_titles() {
    let html = render(
        "見[^1] [Rust](https://www.rust-lang.org)\n\n[^1]: 說明\n",
        "default",
        &RenderOptions {
            locale: Locale::Hans,
            ..RenderOptions::default()
        },
    )
    .unwrap()
    .html;
    assert!(
        html.contains("参考链接") && html.contains("注释") && html.contains("[注1]"),
        "{html}"
    );
    assert!(!html.contains("參考連結"), "{html}");
}
