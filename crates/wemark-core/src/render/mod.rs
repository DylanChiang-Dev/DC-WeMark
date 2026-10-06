//! AST → 帶 inline style 的公眾號相容 HTML。
//!
//! 核心是 `Writer`：走訪 comrak AST，對每個節點查主題樣式、輸出 inline-styled
//! 標籤；外部連結收集成文末腳註；原始 HTML 一律轉義（XSS 邊界）。

mod code;
mod containers;

use comrak::nodes::{AstNode, ListType, NodeList, NodeTable, NodeValue, TableAlignment};

use crate::compat::{self, UrlKind};
use crate::options::{Locale, RenderOptions};
use crate::theme::{style, Style, Theme};

const HEADING: [&str; 6] = ["h1", "h2", "h3", "h4", "h5", "h6"];
const ARTICLE_BASE_STYLE: &str = "padding:24px 20px;";

pub struct Writer {
    theme: &'static Theme,
    accent: String,
    background: crate::BackgroundStyle,
    font_delta_px: i16,
    font_family: crate::FontFamily,
    external_footnotes: bool,
    locale: Locale,
    out: String,
    footnotes: Vec<(String, String)>,
    pub warnings: Vec<String>,
    /// 網路圖片數（供前端提示轉存風險）。
    pub remote_images: usize,
    /// 已輸出的 Markdown 腳註定義數；>0 表示註釋區塊已開啟。
    notes: usize,
    /// 是否處於 tight list 語境（段落不加 <p> 外殼）。
    tight: bool,
    /// 目前開啟中的 `:::` 容器數（用於文末自動閉合未關閉的容器）。
    container_depth: usize,
}

impl Writer {
    pub fn new(theme: &'static Theme, opts: &RenderOptions) -> Self {
        let accent = opts
            .accent
            .clone()
            .unwrap_or_else(|| theme.meta.accent.to_string());
        Self {
            theme,
            accent,
            background: opts.background,
            font_delta_px: opts.font_size.delta_px(),
            font_family: opts.font_family,
            external_footnotes: opts.external_links_as_footnotes,
            locale: opts.locale,
            out: String::new(),
            footnotes: Vec::new(),
            warnings: Vec::new(),
            remote_images: 0,
            notes: 0,
            tight: false,
            container_depth: 0,
        }
    }

    pub fn footnote_count(&self) -> usize {
        self.footnotes.len()
    }

    /// 渲染整份文件，回傳被根 <section> 包裹的完整 HTML。
    pub fn finish<'a>(&mut self, root: &'a AstNode<'a>) -> String {
        self.render_children(root);
        self.close_containers();
        if self.notes > 0 {
            self.out.push_str("</section>");
        }
        if self.external_footnotes && !self.footnotes.is_empty() {
            self.render_references();
        }
        let mut st = style::inject(self.render_style(self.theme.root), ARTICLE_BASE_STYLE);
        if let Some(font_family) = self.font_family.css() {
            st = style::inject(st, &format!("font-family:{font_family};"));
        }
        let st = style::inject(st, self.background.css());
        format!("<section{st}>{}</section>", std::mem::take(&mut self.out))
    }

    /// 自動閉合未關閉的容器（寬容處理，不吞內容）。
    fn close_containers(&mut self) {
        while self.container_depth > 0 {
            self.out.push_str("</section>");
            self.container_depth -= 1;
            self.warnings.push("未闭合的排版容器已自动闭合".to_string());
        }
    }

    fn render_style(&self, pairs: Style) -> String {
        style::render_scaled(pairs, &self.accent, self.font_delta_px)
    }

    fn render_children<'a>(&mut self, node: &'a AstNode<'a>) {
        for c in node.children() {
            self.render_node(c);
        }
    }

    fn render_node<'a>(&mut self, node: &'a AstNode<'a>) {
        let data = node.data.borrow();
        match &data.value {
            NodeValue::Document => self.render_children(node),
            NodeValue::Heading(h) => {
                let tag = HEADING[usize::from(h.level.clamp(1, 6) - 1)];
                self.wrap(tag, tag, node);
            }
            NodeValue::Paragraph => {
                if self.tight {
                    self.render_children(node);
                } else {
                    self.wrap("p", "p", node);
                }
            }
            NodeValue::Text(t) => self.out.push_str(&escape(t)),
            NodeValue::Strong => self.wrap("strong", "strong", node),
            NodeValue::Emph => self.wrap("em", "em", node),
            NodeValue::Strikethrough => self.wrap("del", "del", node),
            NodeValue::Code(c) => {
                let st = self.render_style(self.theme.element("code-inline"));
                self.out
                    .push_str(&format!("<code{st}>{}</code>", escape(&c.literal)));
            }
            NodeValue::SoftBreak => self.out.push('\n'),
            NodeValue::LineBreak => self.out.push_str("<br>"),
            NodeValue::Link(l) => self.render_link(node, &l.url),
            NodeValue::Image(l) => self.render_image(node, &l.url),
            NodeValue::BlockQuote => self.wrap("blockquote", "blockquote", node),
            NodeValue::List(nl) => self.render_list(node, nl),
            NodeValue::Item(_) => self.wrap("li", "li", node),
            NodeValue::TaskItem(ti) => self.render_task_item(node, ti.symbol),
            NodeValue::CodeBlock(cb) => self.render_code_block(&cb.info, &cb.literal),
            NodeValue::ThematicBreak => {
                let st = self.render_style(self.theme.element("hr"));
                self.out.push_str(&format!("<hr{st}>"));
            }
            NodeValue::Table(t) => self.render_table(node, t),
            NodeValue::HtmlBlock(h) => self.handle_html_block(&h.literal),
            NodeValue::HtmlInline(h) => self.out.push_str(&escape(h)),
            NodeValue::FootnoteReference(r) => {
                let st = self.render_style(self.theme.element("footnote-sup"));
                let label = self.locale.note_label();
                self.out
                    .push_str(&format!("<sup{st}>[{label}{}]</sup>", r.ix));
            }
            NodeValue::FootnoteDefinition(_) => self.render_note(node),
            _ => self.render_children(node),
        }
    }

    /// `<tag STYLE>children</tag>`，樣式取自主題 `key`。
    fn wrap<'a>(&mut self, tag: &str, key: &str, node: &'a AstNode<'a>) {
        let st = self.render_style(self.theme.element(key));
        self.out.push('<');
        self.out.push_str(tag);
        self.out.push_str(&st);
        self.out.push('>');
        self.render_children(node);
        self.out.push_str("</");
        self.out.push_str(tag);
        self.out.push('>');
    }

    fn render_link<'a>(&mut self, node: &'a AstNode<'a>, url: &str) {
        let inner = self.capture(|w| w.render_children(node));
        if !compat::is_safe_url(url, UrlKind::Link) {
            self.out.push_str(&inner);
            self.warnings
                .push(format!("已移除不安全的链接：{}", plain_text(&inner)));
            return;
        }
        if self.external_footnotes && compat::is_external_link(url) {
            // 同一網址重複出現時沿用第一次的編號。
            let n = match self.footnotes.iter().position(|(_, u)| u == url) {
                Some(i) => i + 1,
                None => {
                    self.footnotes.push((inner.clone(), url.to_string()));
                    self.footnotes.len()
                }
            };
            let st = self.render_style(self.theme.element("footnote-sup"));
            self.out.push_str(&inner);
            self.out.push_str(&format!("<sup{st}>[{n}]</sup>"));
        } else {
            let st = self.render_style(self.theme.element("a"));
            self.out
                .push_str(&format!("<a href=\"{}\"{st}>{inner}</a>", escape(url)));
        }
    }

    fn render_image<'a>(&mut self, node: &'a AstNode<'a>, url: &str) {
        // alt 來自子節點：render_children 已對文字做 HTML 轉義，strip_tags 去標籤後可直接放入屬性。
        let alt = strip_tags(&self.capture(|w| w.render_children(node)));
        let label = if alt.is_empty() {
            url.to_string()
        } else {
            plain_text(&alt)
        };
        if compat::is_local_image(url) {
            self.warnings.push(format!(
                "图片「{label}」是本地或相对路径，粘贴到公众号后无法显示，请改用网络图片或在公众号内上传"
            ));
        }
        if !compat::is_safe_url(url, UrlKind::Image) {
            if !compat::is_local_image(url) {
                self.warnings.push(format!("已移除不安全的图片：{label}"));
            }
            self.out.push_str(&alt);
            return;
        }
        if !compat::is_local_image(url) && !url.trim().to_ascii_lowercase().starts_with("data:") {
            self.remote_images += 1;
        }
        let st = self.render_style(self.theme.element("img"));
        self.out
            .push_str(&format!("<img src=\"{}\" alt=\"{alt}\"{st}>", escape(url)));
    }

    fn render_list<'a>(&mut self, node: &'a AstNode<'a>, nl: &NodeList) {
        let ordered = matches!(nl.list_type, ListType::Ordered);
        let key = if ordered { "ol" } else { "ul" };
        let st = self.render_style(self.theme.element(key));
        if ordered && nl.start != 1 {
            self.out
                .push_str(&format!("<ol start=\"{}\"{st}>", nl.start));
        } else {
            self.out.push('<');
            self.out.push_str(key);
            self.out.push_str(&st);
            self.out.push('>');
        }
        let saved = self.tight;
        self.tight = nl.tight;
        self.render_children(node);
        self.tight = saved;
        self.out.push_str("</");
        self.out.push_str(key);
        self.out.push('>');
    }

    fn render_task_item<'a>(&mut self, node: &'a AstNode<'a>, sym: Option<char>) {
        let checked = matches!(sym, Some(c) if c != ' ');
        let st = self.render_style(self.theme.element("li"));
        self.out.push_str(&format!("<li{st}>"));
        self.out.push_str(if checked { "☑ " } else { "☐ " });
        self.render_children(node);
        self.out.push_str("</li>");
    }

    /// HtmlBlock：攔截 `:::` 容器標記，其餘原始 HTML 一律轉義。
    fn handle_html_block(&mut self, literal: &str) {
        let t = literal.trim();
        if t == "<!--wm:close-->" {
            if self.container_depth > 0 {
                self.out.push_str("</section>");
                self.container_depth -= 1;
            }
            return;
        }
        if let Some(name) = t
            .strip_prefix("<!--wm:open:")
            .and_then(|s| s.strip_suffix("-->"))
        {
            let shell = containers::shell_style(name, &self.accent);
            self.out.push_str(&format!("<section{shell}>"));
            self.container_depth += 1;
            return;
        }
        self.out.push_str(&escape(literal));
    }

    fn render_code_block(&mut self, info: &str, literal: &str) {
        let lang = info.split_whitespace().next().unwrap_or("");
        let inner = code::highlight(literal, lang, self.theme.code.theme);
        let st = self.render_style(self.theme.code.block);
        self.out.push_str(&format!("<pre{st}>{inner}</pre>"));
    }

    fn render_table<'a>(&mut self, node: &'a AstNode<'a>, t: &NodeTable) {
        let tstyle = self.render_style(self.theme.element("table"));
        self.out.push_str(&format!("<table{tstyle}>"));
        let mut first = true;
        for row in node.children() {
            let is_header = matches!(row.data.borrow().value, NodeValue::TableRow(true));
            if first {
                self.out.push_str("<thead>");
            }
            self.out.push_str("<tr>");
            for (ci, cell) in row.children().enumerate() {
                let key = if is_header { "th" } else { "td" };
                let mut st = self.render_style(self.theme.element(key));
                let ta = match t.alignments.get(ci) {
                    Some(TableAlignment::Left) => "left",
                    Some(TableAlignment::Center) => "center",
                    Some(TableAlignment::Right) => "right",
                    _ => "",
                };
                if !ta.is_empty() {
                    st = style::inject(st, &format!("text-align:{ta};"));
                }
                self.out.push('<');
                self.out.push_str(key);
                self.out.push_str(&st);
                self.out.push('>');
                self.render_children(cell);
                self.out.push_str("</");
                self.out.push_str(key);
                self.out.push('>');
            }
            self.out.push_str("</tr>");
            if first {
                self.out.push_str("</thead><tbody>");
                first = false;
            }
        }
        if first {
            self.out.push_str("</table>");
        } else {
            self.out.push_str("</tbody></table>");
        }
    }

    /// Markdown 腳註定義（comrak 已依引用順序移到文末）：首個定義開啟註釋區塊。
    fn render_note<'a>(&mut self, node: &'a AstNode<'a>) {
        if self.notes == 0 {
            self.close_containers();
            let sec = self.render_style(self.theme.element("footnote-section"));
            let title = self.render_style(self.theme.element("footnote-title"));
            self.out.push_str(&format!(
                "<section{sec}><p{title}>{}</p>",
                self.locale.notes_title()
            ));
        }
        self.notes += 1;
        let item = self.render_style(self.theme.element("footnote-item"));
        let label = self.locale.note_label();
        self.out
            .push_str(&format!("<section{item}>[{label}{}] ", self.notes));
        let saved = self.tight;
        self.tight = true;
        self.render_children(node);
        self.tight = saved;
        self.out.push_str("</section>");
    }

    fn render_references(&mut self) {
        let fns = std::mem::take(&mut self.footnotes);
        let sec = self.render_style(self.theme.element("footnote-section"));
        let title = self.render_style(self.theme.element("footnote-title"));
        let item = self.render_style(self.theme.element("footnote-item"));
        self.out.push_str(&format!("<section{sec}>"));
        self.out
            .push_str(&format!("<p{title}>{}</p>", self.locale.references_title()));
        for (i, (text, url)) in fns.iter().enumerate() {
            self.out.push_str(&format!(
                "<p{item}>[{}] {text} — {}</p>",
                i + 1,
                escape(url)
            ));
        }
        self.out.push_str("</section>");
        self.footnotes = fns;
    }

    /// 暫時把輸出換成空 buffer 執行 f，回傳期間產生的片段（用於連結/圖片子渲染）。
    fn capture<F: FnOnce(&mut Self)>(&mut self, f: F) -> String {
        let saved = std::mem::take(&mut self.out);
        f(self);
        std::mem::replace(&mut self.out, saved)
    }
}

pub(crate) fn escape(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => o.push_str("&amp;"),
            '<' => o.push_str("&lt;"),
            '>' => o.push_str("&gt;"),
            '"' => o.push_str("&quot;"),
            _ => o.push(c),
        }
    }
    o
}

/// 把渲染後的 HTML 片段轉回純文字（用於警告訊息，前端以 textContent 顯示）。
fn plain_text(html: &str) -> String {
    strip_tags(html)
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
}

fn strip_tags(s: &str) -> String {
    let mut o = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => o.push(c),
            _ => {}
        }
    }
    o
}
