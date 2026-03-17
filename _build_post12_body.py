import html
import re
from pathlib import Path


SRC_PATH = Path("/home/adama/civitaiuk/_source_ai_freak_bikini.html")
OUT_PATH = Path("/home/adama/civitaiuk/_post12_body_reedited.md")


def clean_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return " ".join(text.replace("\u3000", " ").split())


def extract_img_urls(block: str) -> list[str]:
    urls: list[str] = []
    for img in re.finditer(r"<img[^>]+>", block, flags=re.S):
        tag = img.group(0)
        data_src = re.search(r'data-src="([^"]+)"', tag)
        src = re.search(r'src="([^"]+)"', tag)
        url = data_src.group(1) if data_src else (src.group(1) if src else "")
        url = html.unescape(url.strip())
        if not url or url.startswith("data:image"):
            continue
        if not url.startswith("http"):
            continue
        if url in urls:
            continue
        urls.append(url)
    return urls


def extract_paragraphs(block: str) -> list[str]:
    paragraphs: list[str] = []
    for p in re.finditer(r"<p[^>]*>(.*?)</p>", block, flags=re.S):
        text = clean_text(p.group(1))
        if text:
            paragraphs.append(text)
    return paragraphs


def extract_sections(segment: str) -> list[dict]:
    sections: list[dict] = []
    h2_matches = list(re.finditer(r"<h2[^>]*>(.*?)</h2>", segment, flags=re.S))

    for idx, h2 in enumerate(h2_matches):
        title = clean_text(h2.group(1))
        block_start = h2.end()
        block_end = h2_matches[idx + 1].start() if idx + 1 < len(h2_matches) else len(segment)
        block = segment[block_start:block_end]

        h3_matches = list(re.finditer(r"<h3[^>]*>(.*?)</h3>", block, flags=re.S))
        intro_block = block[: h3_matches[0].start()] if h3_matches else block
        intro_paragraphs = extract_paragraphs(intro_block)

        items: list[dict] = []
        for jdx, h3 in enumerate(h3_matches):
            prompt = clean_text(h3.group(1))
            item_start = h3.end()
            item_end = h3_matches[jdx + 1].start() if jdx + 1 < len(h3_matches) else len(block)
            item_block = block[item_start:item_end]

            item_paragraphs = extract_paragraphs(item_block)
            meaning = item_paragraphs[0] if item_paragraphs else f"{prompt} の表現。"
            notes = item_paragraphs[1:3]
            images = extract_img_urls(item_block)

            items.append(
                {
                    "prompt": prompt,
                    "meaning": meaning,
                    "notes": notes,
                    "images": images,
                }
            )

        sections.append(
            {
                "title": title,
                "intro": intro_paragraphs,
                "items": items,
            }
        )

    return sections


def build_markdown(sections: list[dict]) -> str:
    lines: list[str] = []
    lines.append("水着・ビキニの形、柄、素材感を整理したプロンプト集です。")
    lines.append("記事内の画像URLは参考ページのものをそのまま掲載しています。")
    lines.append("")
    lines.append("## 使い方")
    lines.append("- `英語プロンプト: 日本語の意味` の形式で掲載しています。")
    lines.append("- 先頭のコピーボタンから英語プロンプトだけをコピーできます。")
    lines.append("- 重み付けや他要素の指定を組み合わせて最終調整してください。")

    for section in sections:
        lines.append("")
        lines.append(f"## {section['title']}")

        if not section["items"]:
            for paragraph in section["intro"]:
                lines.append(paragraph)
            continue

        for paragraph in section["intro"][:2]:
            lines.append(paragraph)

        for item in section["items"]:
            lines.append("")
            lines.append(f"### {item['prompt']}")
            lines.append(f"- {item['prompt']}: {item['meaning']}")
            for note in item["notes"]:
                lines.append(note)
            if item["images"]:
                lines.append("")
                for index, url in enumerate(item["images"], start=1):
                    lines.append(f"![{item['prompt']} {index}]({url})")

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
