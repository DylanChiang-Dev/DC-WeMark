//! comrak 組態：只用它把 Markdown 解析成 AST（自寫渲染器負責 HTML）。

use comrak::Options;

pub fn options<'a>() -> Options<'a> {
    let mut o = Options::default();
    o.extension.table = true;
    o.extension.strikethrough = true;
    o.extension.tasklist = true;
    o.extension.autolink = true;
    o.extension.footnotes = true;
    o
}
