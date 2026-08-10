//! 渲染選項。

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum BackgroundStyle {
    #[default]
    Warm,
    Grid,
    None,
}

impl From<&str> for BackgroundStyle {
    fn from(value: &str) -> Self {
        match value {
            "warm" => Self::Warm,
            "none" => Self::None,
            "grid" => Self::Grid,
            _ => Self::Warm,
        }
    }
}

impl BackgroundStyle {
    pub(crate) fn css(self) -> &'static str {
        match self {
            Self::Warm => "background-color:#f7f7f5;",
            Self::Grid => "background-color:#f7f7f5;background-image:linear-gradient(rgba(44,44,46,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(44,44,46,0.05) 1px,transparent 1px);background-size:24px 24px;",
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
            Self::Medium => 0,
            Self::Large => 2,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum FontFamily {
    #[default]
    Theme,
    Sans,
    Serif,
    Kai,
}

impl From<&str> for FontFamily {
    fn from(value: &str) -> Self {
        match value {
            "sans" => Self::Sans,
            "serif" => Self::Serif,
            "kai" => Self::Kai,
            _ => Self::Theme,
        }
    }
}

impl FontFamily {
    pub(crate) fn css(self) -> Option<&'static str> {
        match self {
            Self::Theme => None,
            Self::Sans => Some(
                "-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Hiragino Sans GB,Microsoft YaHei,Arial,sans-serif",
            ),
            Self::Serif => {
                Some("Georgia,Songti SC,STSong,SimSun,Noto Serif CJK SC,serif")
            }
            Self::Kai => Some("Kaiti SC,STKaiti,KaiTi,Noto Serif CJK SC,serif"),
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
    /// 文章字體；Theme 表示沿用主題設定。
    pub font_family: FontFamily,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            external_links_as_footnotes: true,
            accent: None,
            background: BackgroundStyle::default(),
            font_size: FontSize::default(),
            font_family: FontFamily::default(),
        }
    }
}
