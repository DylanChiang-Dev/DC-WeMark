//! 渲染選項。

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum BackgroundStyle {
    Warm,
    #[default]
    Grid,
    None,
}

impl From<&str> for BackgroundStyle {
    fn from(value: &str) -> Self {
        match value {
            "warm" => Self::Warm,
            "none" => Self::None,
            _ => Self::Grid,
        }
    }
}

impl BackgroundStyle {
    pub(crate) fn css(self) -> &'static str {
        match self {
            Self::Warm => "background-color:#fff8ee;",
            Self::Grid => "background-color:#fff;background-image:linear-gradient(rgba(47,54,64,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(47,54,64,0.05) 1px,transparent 1px);background-size:24px 24px;",
            Self::None => "",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum FontSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl From<&str> for FontSize {
    fn from(value: &str) -> Self {
        match value {
            "small" => Self::Small,
            "large" => Self::Large,
            _ => Self::Medium,
        }
    }
}

impl FontSize {
    pub(crate) fn delta_px(self) -> i16 {
        match self {
            Self::Small => -2,
            Self::Medium => -1,
            Self::Large => 0,
        }
    }
}

#[derive(Clone, Debug)]
pub struct RenderOptions {
    /// 外部連結（非 mp.weixin.qq.com）是否轉為文末腳註。
    pub external_links_as_footnotes: bool,
    /// 覆寫主題強調色（取代 {{accent}}）；None 用主題預設。
    pub accent: Option<String>,
    /// 複製到公眾號時的文章底稿。
    pub background: BackgroundStyle,
    /// 文章整體字級。
    pub font_size: FontSize,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            external_links_as_footnotes: true,
            accent: None,
            background: BackgroundStyle::default(),
            font_size: FontSize::default(),
        }
    }
}
