import html
import re
from pathlib import Path


SRC_PATH = Path("/home/adama/civitaiuk/_source_ai_freak_clothing.html")
OUT_PATH = Path("/home/adama/civitaiuk/_post12_body_reedited.md")


TOKEN_JA = {
    "a": "A",
    "accessory": "アクセサリー",
    "and": "アンド",
    "alpaca": "アルパカ",
    "anklet": "アンクレット",
    "asymmetrical": "アシンメトリー",
    "ball": "ボール",
    "balloon": "バルーン",
    "bandage": "バンデージ",
    "bangle": "バングル",
    "bathrobe": "バスローブ",
    "baseball": "ベースボール",
    "beanie": "ビーニー",
    "bell": "ベル",
    "beret": "ベレー",
    "blazer": "ブレザー",
    "blouse": "ブラウス",
    "body": "ボディ",
    "bodycon": "ボディコン",
    "boat": "ボート",
    "bomber": "ボンバー",
    "bonnet": "ボンネット",
    "boyfriend": "ボーイフレンド",
    "bowler": "ボウラー",
    "bracelet": "ブレスレット",
    "bra": "ブラ",
    "brooch": "ブローチ",
    "bulky": "バルキー",
    "bucket": "バケット",
    "button": "ボタン",
    "cable": "ケーブル",
    "camisole": "キャミソール",
    "cap": "キャップ",
    "capri": "カプリ",
    "cardigan": "カーディガン",
    "car": "カー",
    "cashmere": "カシミヤ",
    "checked": "チェック",
    "chester": "チェスター",
    "choker": "チョーカー",
    "chunky": "チャンキー",
    "cloche": "クロッシェ",
    "coat": "コート",
    "collar": "カラー",
    "con": "コン",
    "cowboy": "カウボーイ",
    "crew": "クルー",
    "crop": "クロップ",
    "cropped": "クロップド",
    "culottes": "キュロット",
    "cufflinks": "カフリンクス",
    "denim": "デニム",
    "derby": "ダービー",
    "dolman": "ドルマン",
    "down": "ダウン",
    "draped": "ドレープ",
    "dress": "ドレス",
    "duffle": "ダッフル",
    "earrings": "イヤリング",
    "empire": "エンパイア",
    "fair": "フェア",
    "fedora": "フェドラ",
    "fit": "フィット",
    "flare": "フレア",
    "flared": "フレア",
    "flat": "フラット",
    "fleece": "フリース",
    "flannel": "フランネル",
    "footed": "フーテッド",
    "flight": "フライト",
    "formal": "フォーマル",
    "fur": "ファー",
    "gathered": "ギャザー",
    "gown": "ガウン",
    "hair": "ヘア",
    "hairband": "ヘアバンド",
    "hairclip": "ヘアクリップ",
    "hairpin": "ヘアピン",
    "halter": "ホルター",
    "hat": "ハット",
    "hoodie": "フーディー",
    "isle": "アイル",
    "jacket": "ジャケット",
    "kids": "キッズ",
    "knit": "ニット",
    "lace": "レース",
    "leather": "レザー",
    "leggings": "レギンス",
    "line": "ライン",
    "lingerie": "ランジェリー",
    "long": "ロング",
    "loungewear": "ラウンジウェア",
    "maxi": "マキシ",
    "merino": "メリノ",
    "mini": "ミニ",
    "military": "ミリタリー",
    "mock": "モック",
    "motorcycle": "モーターサイクル",
    "neck": "ネック",
    "necklace": "ネックレス",
    "necktie": "ネクタイ",
    "negligee": "ネグリジェ",
    "newsboy": "ニュースボーイ",
    "nightdress": "ナイトドレス",
    "nightgown": "ナイトガウン",
    "no": "ノー",
    "off": "オフ",
    "onesie": "ワンジー",
    "overcoat": "オーバーコート",
    "oversized": "オーバーサイズ",
    "pajama": "パジャマ",
    "pajamas": "パジャマ",
    "panama": "パナマ",
    "party": "パーティー",
    "patterned": "パターン",
    "peacoat": "ピーコート",
    "peplum": "ペプラム",
    "pencil": "ペンシル",
    "pendant": "ペンダント",
    "piercing": "ピアス",
    "pin": "ピン",
    "pleated": "プリーツ",
    "polo": "ポロ",
    "poncho": "ポンチョ",
    "porkpie": "ポークパイ",
    "pullover": "プルオーバー",
    "puffer": "パファー",
    "quilted": "キルティング",
    "rain": "レイン",
    "raincoat": "レインコート",
    "ribbed": "リブ",
    "ribbon": "リボン",
    "ring": "リング",
    "robe": "ローブ",
    "ruffle": "ラッフル",
    "satin": "サテン",
    "scrunchie": "シュシュ",
    "set": "セット",
    "shawl": "ショール",
    "sheath": "シース",
    "shirt": "シャツ",
    "short": "ショート",
    "shoulder": "ショルダー",
    "silk": "シルク",
    "skirt": "スカート",
    "slip": "スリップ",
    "sleeve": "スリーブ",
    "sleeved": "長袖",
    "straw": "ストロー",
    "striped": "ストライプ",
    "style": "スタイル",
    "sun": "サン",
    "sweater": "セーター",
    "swing": "スイング",
    "t": "T",
    "tank": "タンク",
    "tiara": "ティアラ",
    "tiered": "ティアード",
    "tie": "タイ",
    "top": "トップ",
    "track": "トラック",
    "trench": "トレンチ",
    "trucker": "トラッカー",
    "tulip": "チューリップ",
    "tunic": "チュニック",
    "tube": "チューブ",
    "turtleneck": "タートルネック",
    "ushanka": "ウシャンカ",
    "v": "V",
    "varsity": "バーシティ",
    "vest": "ベスト",
    "waist": "ウエスト",
    "watch": "腕時計",
    "windbreaker": "ウインドブレーカー",
    "winter": "冬用",
    "wool": "ウール",
    "wrap": "ラップ",
}


def clean_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return " ".join(text.replace("\u3000", " ").split())


def extract_url_from_img(tag: str) -> str:
    data_src = re.search(r'data-src="([^"]+)"', tag)
    src = re.search(r'src="([^"]+)"', tag)
    url = data_src.group(1) if data_src else (src.group(1) if src else "")
    url = html.unescape(url.strip())
    if not url or url.startswith("data:image"):
        return ""
    if not url.startswith("http"):
        return ""
    if "/wp-content/uploads/" not in url:
        return ""
    return url


def prompt_from_url(url: str) -> str:
    name = url.split("/")[-1].split("?")[0]
    name = re.sub(r"\.(png|jpg|jpeg|webp|avif)$", "", name, flags=re.I)
    name = re.sub(r"-\d+x\d+$", "", name)
    name = name.replace("_", " ").replace("-", " ")
    return " ".join(name.split())


def translate_prompt(prompt: str) -> str:
    if re.search(r"[ぁ-んァ-ン一-龥]", prompt):
        return prompt

    key = prompt.strip().lower()
    key = key.replace("&", " and ")
    key = re.sub(r"\bbodycon\b", "body con", key)
    key = re.sub(r"\boff the shoulder\b", "off-the-shoulder", key)
    key = re.sub(r"\bv neck\b", "v-neck", key)

    phrase_replacements = {
        "off-the-shoulder": "オフショルダー",
        "v-neck": "Vネック",
        "crew-neck": "クルーネック",
        "boat-neck": "ボートネック",
        "button-down": "ボタンダウン",
        "t-shirt": "Tシャツ",
        "a-line": "Aライン",
        "sun-hat": "サンハット",
    }
    for phrase, jp in phrase_replacements.items():
        key = key.replace(phrase, jp)

    tokens = [token for token in re.split(r"[^a-zA-Z0-9ァ-ヶー一-龥]+", key) if token]
    if not tokens:
        return f"{prompt} の表現"

    jp_parts: list[str] = []
    for token in tokens:
        lower = token.lower()
        jp_parts.append(TOKEN_JA.get(lower, token))

    result = "・".join(jp_parts)
    return result if result else f"{prompt} の表現"


def extract_paragraphs(block: str) -> list[str]:
    paragraphs: list[str] = []
    for paragraph in re.finditer(r"<p[^>]*>(.*?)</p>", block, flags=re.S):
        text = clean_text(paragraph.group(1))
        if text:
            paragraphs.append(text)
    return paragraphs


def extract_gallery_entries(block: str) -> list[dict]:
    entries: list[dict] = []
    seen_urls: set[str] = set()

    for dl in re.finditer(r"<dl class='gallery-item'>(.*?)</dl>", block, flags=re.S):
        chunk = dl.group(1)
        img = re.search(r"<img[^>]+>", chunk, flags=re.S)
        if not img:
            continue
        url = extract_url_from_img(img.group(0))
        if not url or url in seen_urls:
            continue

        caption_match = re.search(r"<dd class='wp-caption-text gallery-caption'[^>]*>(.*?)</dd>", chunk, flags=re.S)
        caption = clean_text(caption_match.group(1)) if caption_match else ""
        if not caption:
            alt_match = re.search(r'alt="([^"]*)"', img.group(0), flags=re.S)
            caption = clean_text(alt_match.group(1)) if alt_match else ""
        if not caption:
            caption = prompt_from_url(url)

        entries.append({"prompt": caption, "url": url})
        seen_urls.add(url)

    if entries:
        return entries

    # Fallback for blocks without gallery markup.
    for img in re.finditer(r"<img[^>]+>", block, flags=re.S):
        tag = img.group(0)
        url = extract_url_from_img(tag)
        if not url or url in seen_urls:
            continue
        alt_match = re.search(r'alt="([^"]*)"', tag, flags=re.S)
        caption = clean_text(alt_match.group(1)) if alt_match else ""
        if not caption:
            caption = prompt_from_url(url)
        entries.append({"prompt": caption, "url": url})
        seen_urls.add(url)

    return entries


def prompt_rows(entries: list[dict]) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        prompt = entry["prompt"].strip()
        if not prompt:
            continue
        key = prompt.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append((prompt, translate_prompt(prompt)))
    return rows


def extract_sections(segment: str) -> list[dict]:
    sections: list[dict] = []
    h2_matches = list(re.finditer(r"<h2[^>]*>(.*?)</h2>", segment, flags=re.S))

    for idx, h2 in enumerate(h2_matches):
        section_title = clean_text(h2.group(1))
        section_start = h2.end()
        section_end = h2_matches[idx + 1].start() if idx + 1 < len(h2_matches) else len(segment)
        section_block = segment[section_start:section_end]

        h3_matches = list(re.finditer(r"<h3[^>]*>(.*?)</h3>", section_block, flags=re.S))

        if not h3_matches:
            entries = extract_gallery_entries(section_block)
            sections.append(
                {
                    "title": section_title,
                    "intro": extract_paragraphs(section_block),
                    "items": [
                        {
                            "title": section_title,
                            "paragraphs": [],
                            "entries": entries,
                            "rows": prompt_rows(entries),
                        }
                    ],
                }
            )
            continue

        intro_block = section_block[: h3_matches[0].start()]
        section_items: list[dict] = []

        for jdx, h3 in enumerate(h3_matches):
            item_title = clean_text(h3.group(1))
            item_start = h3.end()
            item_end = h3_matches[jdx + 1].start() if jdx + 1 < len(h3_matches) else len(section_block)
            item_block = section_block[item_start:item_end]

            entries = extract_gallery_entries(item_block)
            section_items.append(
                {
                    "title": item_title,
                    "paragraphs": extract_paragraphs(item_block),
                    "entries": entries,
                    "rows": prompt_rows(entries),
                }
            )

        sections.append(
            {
                "title": section_title,
                "intro": extract_paragraphs(intro_block),
                "items": section_items,
            }
        )

    return sections


def build_markdown(sections: list[dict]) -> str:
    lines: list[str] = []
    lines.append("服装プロンプトをカテゴリ別に整理した実用ガイドです。")
    lines.append("サムネと記事内画像は参考ページのURLをそのまま使用しています。")
    lines.append("")
    lines.append("## 使い方")
    lines.append("- `英語プロンプト: 日本語の意味` の形式です。")
    lines.append("- 各行のコピーボタンで英語プロンプトだけをコピーできます。")
    lines.append("- 素材や色の語句を追加して、最終イメージを調整してください。")

    for section in sections:
        lines.append("")
        lines.append(f"## {section['title']}")

        if "まとめ" in section["title"]:
            for text in section["intro"]:
                lines.append(text)
            continue

        for text in section["intro"][:3]:
            lines.append(text)

        for item in section["items"]:
            lines.append("")
            lines.append(f"### {item['title']}")

            if item["rows"]:
                for prompt, meaning in item["rows"]:
                    lines.append(f"- {prompt}: {meaning}")

            for text in item["paragraphs"][:3]:
                lines.append(text)

            if item["entries"]:
                lines.append("")
                for idx, entry in enumerate(item["entries"], start=1):
                    lines.append(f"![{item['title']} {idx}]({entry['url']})")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    source = SRC_PATH.read_text(encoding="utf-8", errors="ignore")
    start_marker = '<div class="post_content">'
    end_marker = '<div class="p-articleFoot">'
    start = source.find(start_marker)
    end = source.find(end_marker)
    if end < 0:
        end = source.find('<section class="l-articleBottom__section -related">')
    if start < 0 or end < 0 or end <= start:
        raise RuntimeError("Could not locate article body range")

    segment = source[start + len(start_marker) : end]
    sections = extract_sections(segment)
    body = build_markdown(sections)
    OUT_PATH.write_text(body, encoding="utf-8")
    print("sections", len(sections), "chars", len(body))


if __name__ == "__main__":
    main()
