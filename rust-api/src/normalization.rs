pub fn normalize_arabic(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    let mut last_was_space = true;

    for ch in input.chars() {
        if is_removed_mark(ch) {
            continue;
        }

        let mapped = map_char(ch);
        if mapped == '\0' {
            continue;
        }

        if mapped.is_whitespace() {
            if !last_was_space {
                normalized.push(' ');
                last_was_space = true;
            }
            continue;
        }

        if should_keep_char(mapped) {
            normalized.push(mapped);
            last_was_space = false;
        } else if !last_was_space {
            normalized.push(' ');
            last_was_space = true;
        }
    }

    normalized.trim().to_string()
}

fn map_char(ch: char) -> char {
    match ch {
        'أ' | 'إ' | 'آ' | 'ٱ' => 'ا',
        'ى' | 'ی' => 'ي',
        'ؤ' => 'و',
        'ئ' => 'ي',
        'ة' => 'ه',
        'ك' | 'ک' => 'ك',
        'ـ' => '\0',
        _ => ch,
    }
}

fn should_keep_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch.is_alphanumeric() || is_arabic_letter(ch)
}

fn is_arabic_letter(ch: char) -> bool {
    matches!(
        ch as u32,
        0x0621..=0x063A | 0x0641..=0x064A | 0x066E..=0x06D3 | 0x06FA..=0x06FF
    )
}

fn is_removed_mark(ch: char) -> bool {
    matches!(
        ch as u32,
        0x0610..=0x061A
            | 0x064B..=0x065F
            | 0x0670
            | 0x06D6..=0x06ED
            | 0x08D3..=0x08FF
    )
}

#[cfg(test)]
mod tests {
    use super::normalize_arabic;

    #[test]
    fn strips_diacritics_and_tatweel() {
        let input = "ٱلْحَمْـدُ لِلَّٰهِ";
        assert_eq!(normalize_arabic(input), "الحمد لله");
    }

    #[test]
    fn normalizes_alef_forms_and_ya() {
        let input = "إِنَّ ٱلْهُدَىٰ هُدَى ٱللَّهِ";
        assert_eq!(normalize_arabic(input), "ان الهدي هدي الله");
    }

    #[test]
    fn condenses_whitespace_and_punctuation() {
        let input = "الرَّحْمٰنِ،  الرَّحِيمِ";
        assert_eq!(normalize_arabic(input), "الرحمن الرحيم");
    }
}
