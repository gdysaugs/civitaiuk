import html
import re
from pathlib import Path


SRC_PATH = Path("/home/adama/civitaiuk/_source_ai_freak_hair_style.html")
OUT_PATH = Path("/home/adama/civitaiuk/_post11_body_reedited.md")


def clean_text(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html.unescape(text)
    return " ".join(text.replace("\u3000", " ").split())


def normalize_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


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


def parse_table_rows(block: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    table_match = re.search(r"<table[^>]*>(.*?)</table>", block, flags=re.S)
    if not table_match:
        return rows

    table_html = table_match.group(1)
    for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_html, flags=re.S):
        tr_html = tr.group(1)
        th = re.search(r"<th[^>]*>(.*?)</th>", tr_html, flags=re.S)
        td = re.search(r"<td[^>]*>(.*?)</td>", tr_html, flags=re.S)
        if not th or not td:
            continue
        prompt = clean_text(th.group(1))
        ja = clean_text(td.group(1))
        if not prompt or not ja:
            continue
        rows.append((prompt, ja))
    return rows


def split_prompt_and_ja(title: str, prompt_map: dict[str, str]) -> tuple[str, str]:
    norm_title = normalize_key(title)

    # Prefer exact/prefix matches from table prompts.
    for prompt in sorted(prompt_map.keys(), key=len, reverse=True):
        norm_prompt = normalize_key(prompt)
        if norm_prompt and norm_title.startswith(norm_prompt):
            return prompt, prompt_map[prompt]

    # Fallback: split by visual separators used in headings.
    for sep in [" – ", " - ", "ー", "―", "—", "−"]:
        if sep in title:
            left, right = title.split(sep, 1)
            prompt = left.strip()
            ja = right.strip()
            if prompt and ja:
                return prompt, ja

    return title.strip(), prompt_map.get(title.strip(), "見出しに準拠")


def extract_sections(segment: str) -> list[dict]:
    sections: list[dict] = []
    parts = re.split(r"(?=<h2[^>]*>)", segment)

    for part in parts:
        h2_match = re.search(r"<h2[^>]*>(.*?)</h2>", part, flags=re.S)
        if not h2_match:
            continue

        title = clean_text(h2_match.group(1))
        if not title:
            continue

        body = part[h2_match.end() :]
        rows = parse_table_rows(body)
        prompt_map = {prompt: ja for prompt, ja in rows}

        h3_parts = re.split(r"(?=<h3[^>]*>)", body)
        section_images = extract_img_urls(h3_parts[0] if h3_parts else body)

        samples = []
        for h3_block in h3_parts[1:]:
            h3_match = re.search(r"<h3[^>]*>(.*?)</h3>", h3_block, flags=re.S)
            if not h3_match:
                continue
            h3_title = clean_text(h3_match.group(1))
            if not h3_title:
                continue
            prompt, ja = split_prompt_and_ja(h3_title, prompt_map)
            samples.append(
                {
                    "title": h3_title,
                    "prompt": prompt,
                    "ja": ja,
                    "images": extract_img_urls(h3_block),
                }
            )

        sections.append(
            {
                "title": title,
                "rows": rows,
                "section_images": section_images,
                "samples": samples,
            }
        )

    return sections


def build_markdown(sections: list[dict]) -> str:
    lines: list[str] = []
    lines.append("髪の長さ・髪質・髪型・髪色のプロンプトを、使いやすい形に再編集しました。")
    lines.append("参照元ページのサムネイルURLと記事内画像URLをそのまま掲載しています。")
    lines.append("")
    lines.append("## 使い方")
    lines.append("- `プロンプト一覧（和訳）` からそのままコピー")
    lines.append("- 必要に応じて `サンプル見出し別` の語句を追加")
    lines.append("- 服装・表情・背景タグと組み合わせて調整")

    for section in sections:
        lines.append("")
        lines.append(f"## {section['title']}")

        if section["section_images"]:
            lines.append("")
            lines.append("### セクション画像")
            lines.append("")
            for idx, url in enumerate(section["section_images"], start=1):
                lines.append(f"![{section['title']} {idx}]({url})")

        if section["rows"]:
            lines.append("")
            lines.append("### プロンプト一覧（和訳）")
            lines.append("")
            for prompt, ja in section["rows"]:
                lines.append(f"- {prompt}：{ja}")

        if section["samples"]:
            lines.append("")
            lines.append("### サンプル見出し別")
            for sample in section["samples"]:
                lines.append("")
                lines.append(f"#### {sample['title']}")
                lines.append("")
                for idx, url in enumerate(sample["images"], start=1):
                    lines.append(f"![{sample['title']} {idx}]({url})")
                lines.append("")
                lines.append(f"- {sample['prompt']}：{sample['ja']}")

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
