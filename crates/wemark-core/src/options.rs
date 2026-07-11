//! 渲染選項。

#[derive(Clone, Debug)]
pub struct RenderOptions {
    /// 外部連結（非 mp.weixin.qq.com）是否轉為文末腳註。
    pub external_links_as_footnotes: bool,
    /// 覆寫主題強調色（取代 {{accent}}）；None 用主題預設。
    pub accent: Option<String>,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            external_links_as_footnotes: true,
            accent: None,
        }
    }
}
