//! 微信公眾號深色模式的顏色提示。
//!
//! 公眾號會在深色模式下重新計算 inline style 的顏色。暖白底搭配中灰字
//! 容易被平台一起壓成低對比度的灰色，因此輸出明確的 `data-darkmode-*`
//! 顏色，讓深色模式保留足夠的閱讀對比。

const DARK_BACKGROUND: &str = "#191919";

/// 為輸出 HTML 中的每個 inline style 補上深色模式前景／背景提示。
///
/// 渲染器和語法高亮器都會產生 style 屬性，因此在完整 HTML 生成後統一處理，
/// 可避免漏掉程式碼 token 或容器外殼。
pub(crate) fn annotate_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len() + html.len() / 8);
    let mut cursor = 0;

    while let Some(relative_start) = html[cursor..].find('<') {
        let start = cursor + relative_start;
        out.push_str(&html[cursor..start]);

        let Some(relative_end) = html[start..].find('>') else {
            out.push_str(&html[start..]);
            return out;
        };
        let end = start + relative_end;
        out.push_str(&annotate_tag(&html[start..=end]));
        cursor = end + 1;
    }

    out.push_str(&html[cursor..]);
    out
}

fn annotate_tag(tag: &str) -> String {
    let Some(style_start) = tag.find(" style=\"") else {
        return tag.to_string();
    };
    let value_start = style_start + " style=\"".len();
    let Some(relative_end) = tag[value_start..].find('"') else {
        return tag.to_string();
    };
    let value_end = value_start + relative_end;
    let style = &tag[value_start..value_end];
    let attrs = attributes_for_style(style);
    if attrs.is_empty() {
        return tag.to_string();
    }

    let mut out = String::with_capacity(tag.len() + attrs.len());
    out.push_str(&tag[..=value_end]);
    out.push_str(&attrs);
    out.push_str(&tag[value_end + 1..]);
    out
}

fn attributes_for_style(style: &str) -> String {
    let mut text_color = None;
    let mut background_color = None;

    for declaration in style.split(';') {
        let Some((property, value)) = declaration.split_once(':') else {
            continue;
        };
        let property = property.trim();
        let value = value.trim();
        match property {
            "color" | "-webkit-text-fill-color" => text_color = Some(value),
            "background" | "background-color" | "background-image" => {
                background_color = Some(value)
            }
            _ => {}
        }
    }

    let dark_text = text_color.and_then(dark_text_color);
    let dark_background = background_color.and_then(dark_background_color);
    if dark_text.is_none() && dark_background.is_none() {
        return String::new();
    }

    let mut attrs = String::new();
    if let Some(color) = dark_text {
        attrs.push_str(" data-darkmode-color=\"");
        attrs.push_str(&color);
        attrs.push('"');
    }
    if let Some(color) = dark_background {
        attrs.push_str(" data-darkmode-bgcolor=\"");
        attrs.push_str(&color);
        attrs.push('"');
    }
    attrs
}

fn dark_text_color(value: &str) -> Option<String> {
    let rgb = parse_rgb(value)?;
    let dark = match rgb {
        [44, 44, 46] => [163, 163, 163],    // theme text
        [104, 104, 107] => [143, 143, 147], // muted text
        [81, 81, 84] => [184, 184, 186],    // quote text
        [22, 119, 255] => [102, 163, 255],  // accent blue
        [180, 35, 93] => [242, 120, 167],   // inline code
        [255, 255, 255] => [255, 255, 255],
        _ if perceived_brightness(rgb) < 96 => lighten_for_dark_mode(rgb),
        _ => rgb,
    };
    Some(hex(dark))
}

fn dark_background_color(value: &str) -> Option<String> {
    if value.contains("gradient") {
        return Some(DARK_BACKGROUND.to_string());
    }

    let rgb = parse_rgb(value)?;
    let dark = match rgb {
        [247, 247, 245] | [255, 255, 255] => [25, 25, 25], // article/card background
        [240, 241, 245] => [42, 42, 42],                   // code background
        [241, 245, 250] | [247, 248, 252] => [36, 41, 49], // quote/callout background
        [238, 243, 251] => [42, 48, 60],                   // table header
        _ if perceived_brightness(rgb) > 190 => mix_with_dark_background(rgb),
        _ => rgb,
    };
    Some(hex(dark))
}

fn parse_rgb(value: &str) -> Option<[u8; 3]> {
    let value = value.trim();
    if let Some(hex_value) = value.strip_prefix('#') {
        return match hex_value.len() {
            3 => Some([
                u8::from_str_radix(&hex_value[0..1].repeat(2), 16).ok()?,
                u8::from_str_radix(&hex_value[1..2].repeat(2), 16).ok()?,
                u8::from_str_radix(&hex_value[2..3].repeat(2), 16).ok()?,
            ]),
            6 => Some([
                u8::from_str_radix(&hex_value[0..2], 16).ok()?,
                u8::from_str_radix(&hex_value[2..4], 16).ok()?,
                u8::from_str_radix(&hex_value[4..6], 16).ok()?,
            ]),
            _ => None,
        };
    }

    let channels = value
        .strip_prefix("rgb(")
        .and_then(|value| value.strip_suffix(')'))?
        .split(',')
        .map(|channel| channel.trim().parse::<u8>().ok())
        .collect::<Option<Vec<_>>>()?;
    (channels.len() == 3).then(|| [channels[0], channels[1], channels[2]])
}

fn perceived_brightness([r, g, b]: [u8; 3]) -> u16 {
    ((u32::from(r) * 299 + u32::from(g) * 587 + u32::from(b) * 114) / 1000) as u16
}

fn lighten_for_dark_mode(rgb: [u8; 3]) -> [u8; 3] {
    let brightness = perceived_brightness(rgb);
    let target = 165u16;
    let denominator = 255u16.saturating_sub(brightness).max(1);
    let amount = target.saturating_sub(brightness).min(denominator);
    rgb.map(|channel| {
        let channel = u16::from(channel);
        (channel + (255 - channel) * amount / denominator) as u8
    })
}

fn mix_with_dark_background(rgb: [u8; 3]) -> [u8; 3] {
    rgb.map(|channel| {
        let channel = u16::from(channel);
        ((channel * 18 + 25 * 82) / 100) as u8
    })
}

fn hex([r, g, b]: [u8; 3]) -> String {
    format!("#{r:02x}{g:02x}{b:02x}")
}

#[cfg(test)]
mod tests {
    use super::annotate_html;

    #[test]
    fn annotates_style_without_touching_text_content() {
        let html =
            r#"<p style="color:#2c2c2e;background-color:#f7f7f5;">文字： style="不要當成屬性"</p>"#;
        let result = annotate_html(html);

        assert_eq!(result.matches("data-darkmode-color=").count(), 1);
        assert_eq!(result.matches("data-darkmode-bgcolor=").count(), 1);
        assert!(result.contains("文字： style=\"不要當成屬性\""));
    }

    #[test]
    fn annotates_gradient_with_a_dark_background() {
        let result = annotate_html(
            r#"<h2 style="color:#ffffff;background:linear-gradient(135deg,#1677ff,#ef5b9c);">標題</h2>"#,
        );

        assert!(result.contains("data-darkmode-color=\"#ffffff\""));
        assert!(result.contains("data-darkmode-bgcolor=\"#191919\""));
    }
}
