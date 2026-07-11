//! `:::` 容器語法預處理。
//!
//! 0.1.0：passthrough。容器語法（card / quote / timeline / note…）在 0.4.0
//! 實作——屆時這裡會把 `::: card key="v"` / `:::` 改寫成 HTML 註解標記行，
//! 並帶 code fence 追蹤器（圍欄內的 `:::` 不改寫）。

pub fn expand(input: &str) -> String {
    input.to_string()
}
