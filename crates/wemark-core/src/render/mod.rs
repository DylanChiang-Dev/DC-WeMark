//! AST → 帶 inline style 的公眾號相容 HTML。
//!
//! 核心是 `Writer`：走訪 comrak AST，對每個節點查主題樣式、輸出 inline-styled
//! 標籤；外部連結收集成文末腳註；原始 HTML 一律轉義（XSS 邊界）。

mod code;

use comrak::nodes::{AstNode, ListType, NodeList, NodeTable, NodeValue, TableAlignment};

use crate::compat;
use crate::options::RenderOptions;
use crate::theme::{style, Theme};

const HEADING: [&str; 6] = ["h1", "h2", "h3", "h4", "h5", "h6"];

pub struct Writer {
    theme: &'static Theme,
    accent: String,
    external_footnotes: bool,
    out: String,
    footnotes: Vec<(String, String)>,
    pub warnings: Vec<String>,
    /// 是否處於 tight list 語境（段落不加 <p> 外殼）。
    tight: bool,
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
            external_footnotes: opts.external_links_as_footnotes,
            out: String::new(),
            footnotes: Vec::new(),
            warnings: Vec::new(),
            tight: false,
        }
    }

    pub fn footnote_count(&self) -> usize {
        self.footnotes.len()
    }

    /// 渲染整份文件，回傳被根 <section> 包裹的完整 HTML。
    pub fn finish<'a>(&mut self, root: &'a AstNode<'a>) -> String {
        self.render_children(root);
        if self.external_footnotes && !self.footnotes.is_empty() {
            self.render_references();
        }
        let st = style::render(self.theme.root, &self.accent);
        format!("<section{st}>{}</section>", std::mem::take(&mut self.out))
    }

    fn render_children<'a>(&mut self, node: &'a AstNode<'a>) {
        for c in node.children() {
            self.render_node(c);
        }
    }

    fn render_node<'a>(&mut self, node: &'a AstNode<'a>) {
        let value = node.data.borrow().value.clone();
        match value {
            NodeValue::Document => self.render_children(node),
            NodeValue::Heading(h) => {
                let tag = HEADING[(h.level.clamp(1, 6) - 1) as usize];
                self.wrap(tag, tag, node);
            }
            NodeValue::Paragraph => {
                if self.tight {
                    self.render_children(node);
                } else {
                    self.wrap("p", "p", node);
                }
            }
            NodeValue::Text(t) => self.out.push_str(&escape(&t)),
            NodeValue::Strong => self.wrap("strong", "strong", node),
            NodeValue::Emph => self.wrap("em", "em", node),
            NodeValue::Strikethrough => self.wrap("del", "del", node),
            NodeValue::Code(c) => {
                let st = style::render(self.theme.element("code-inline"), &self.accent);
                self.out
                    .push_str(&format!("<code{st}>{}</code>", escape(&c.literal)));
            }
            NodeValue::SoftBreak => self.out.push('\n'),
            NodeValue::LineBreak => self.out.push_str("<br>"),
            NodeValue::Link(l) => self.render_link(node, &l.url),
            NodeValue::Image(l) => self.render_image(node, &l.url),
            NodeValue::BlockQuote => self.wrap("blockquote", "blockquote", node),
            NodeValue::List(nl) => self.render_list(node, &nl),
            NodeValue::Item(_) => self.wrap("li", "li", node),
            NodeValue::TaskItem(ti) => self.render_task_item(node, ti.symbol),
            NodeValue::CodeBlock(cb) => self.render_code_block(&cb.info, &cb.literal),
            NodeValue::ThematicBreak => {
                let st = style::render(self.theme.element("hr"), &self.accent);
                self.out.push_str(&format!("<hr{st}>"));
            }
            NodeValue::Table(t) => self.render_table(node, &t),
            NodeValue::HtmlBlock(h) => self.out.push_str(&escape(&h.literal)),
            NodeValue::HtmlInline(h) => self.out.push_str(&escape(&h)),
            _ => self.render_children(node),
        }
    }

    /// `<tag STYLE>children</tag>`，樣式取自主題 `key`。
    fn wrap<'a>(&mut self, tag: &str, key: &str, node: &'a AstNode<'a>) {
        let st = style::render(self.theme.element(key), &self.accent);
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
        if self.external_footnotes && compat::is_external_link(url) {
            self.footnotes.push((inner.clone(), url.to_string()));
            let n = self.footnotes.len();
            let st = style::render(self.theme.element("footnote-sup"), &self.accent);
            self.out.push_str(&inner);
            self.out.push_str(&format!("<sup{st}>[{n}]</sup>"));
        } else {
            let st = style::render(self.theme.element("a"), &self.accent);
            self.out
                .push_str(&format!("<a href={:?}{st}>{inner}</a>", escape(url)));
        }
    }

    fn render_image<'a>(&mut self, node: &'a AstNode<'a>, url: &str) {
        let alt = strip_tags(&self.capture(|w| w.render_children(node)));
        let st = style::render(self.theme.element("img"), &self.accent);
        self.out
            .push_str(&format!("<img src={:?} alt={alt:?}{st}>", escape(url)));
    }

    fn render_list<'a>(&mut self, node: &'a AstNode<'a>, nl: &NodeList) {
        let ordered = matches!(nl.list_type, ListType::Ordered);
        let key = if ordered { "ol" } else { "ul" };
        let st = style::render(self.theme.element(key), &self.accent);
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
        let st = style::render(self.theme.element("li"), &self.accent);
        self.out.push_str(&format!("<li{st}>"));
        self.out.push_str(if checked { "☑ " } else { "☐ " });
        self.render_children(node);
        self.out.push_str("</li>");
    }

    fn render_code_block(&mut self, info: &str, literal: &str) {
        let lang = info.split_whitespace().next().unwrap_or("");
        let inner = code::highlight(literal, lang, self.theme.code.theme);
        let st = style::render(self.theme.code.block, &self.accent);
        self.out.push_str(&format!("<pre{st}>{inner}</pre>"));
    }

    fn render_table<'a>(&mut self, node: &'a AstNode<'a>, t: &NodeTable) {
        let tstyle = style::render(self.theme.element("table"), &self.accent);
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
                let mut st = style::render(self.theme.element(key), &self.accent);
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

    fn render_references(&mut self) {
        let fns = self.footnotes.clone();
        let sec = style::render(self.theme.element("footnote-section"), &self.accent);
        let title = style::render(self.theme.element("footnote-title"), &self.accent);
        let item = style::render(self.theme.element("footnote-item"), &self.accent);
        self.out.push_str(&format!("<section{sec}>"));
        self.out.push_str(&format!("<p{title}>參考連結</p>"));
        for (i, (text, url)) in fns.iter().enumerate() {
            self.out.push_str(&format!(
                "<p{item}>[{}] {text} — {}</p>",
                i + 1,
                escape(url)
            ));
        }
        self.out.push_str("</section>");
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
