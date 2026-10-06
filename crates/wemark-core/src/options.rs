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
            // 底色一律取無彩色（r=g=b）：公眾號深色模式對帶色偏的近白底色
            // 改寫失敗，會留在淺灰而文字被提亮，導致對比度掉到 1.3:1。
            Self::Warm => "background-color:#fafafa;",
            Self::Grid => "background-color:#ffffff;background-image:linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px);background-size:24px 24px;",
            Self::None => "",
        }
    }

    /// 根節點額外屬性。方格紙必須以漸層繪製，文字壓在漸層上會觸發公眾號
    /// 「文字背景尽量不要使用渐变」提示；深色模式下格線消失但文字可讀
    /// （已以官方 mp-darkmode 驗證），依規範 #4.6 以 data-ignore-dm 聲明。
    pub(crate) fn root_attrs(self) -> &'static str {
        match self {
            Self::Grid => " data-ignore-dm=\"text-bg-gradient\"",
            Self::Warm | Self::None => "",
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

/// 輸出文字（腳註、參考連結標題等）使用的中文字形。
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Locale {
    /// 繁體中文
    #[default]
    Hant,
    /// 簡體中文
    Hans,
}

impl From<&str> for Locale {
    fn from(value: &str) -> Self {
        match value {
            "hans" => Self::Hans,
            _ => Self::Hant,
        }
    }
}

impl Locale {
    pub(crate) fn references_title(self) -> &'static str {
        match self {
            Self::Hant => "參考連結",
            Self::Hans => "参考链接",
        }
    }

    pub(crate) fn notes_title(self) -> &'static str {
        match self {
            Self::Hant => "註釋",
            Self::Hans => "注释",
        }
    }

    pub(crate) fn note_label(self) -> &'static str {
        match self {
            Self::Hant => "註",
            Self::Hans => "注",
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
    /// 腳註與參考連結標題的字形。
    pub locale: Locale,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            external_links_as_footnotes: true,
            accent: None,
            background: BackgroundStyle::default(),
            font_size: FontSize::default(),
            font_family: FontFamily::default(),
            locale: Locale::default(),
        }
    }
}
