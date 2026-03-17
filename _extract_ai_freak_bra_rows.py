import html
import re
from pathlib import Path


SRC = Path("/home/adama/civitaiuk/_source_ai_freak_bra.html")
ROWS_OUT = Path("/home/adama/civitaiuk/_ai_freak_bra_rows.tsv")
IMAGES_OUT = Path("/home/adama/civitaiuk/_ai_freak_bra_images.tsv")


def clean_text(value: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", value or "")
    unescaped = html.unescape(no_tags)
    return " ".join(unescaped.split())


def unique_urls(block: str) -> list[str]:
    urls: list[str] = []
    for match in re.finditer(r'data-src="(https://[^"]+)"', block):
        url = html.unescape(match.group(1).strip())
        if not url or url in urls:
            continue
        urls.append(url)
    return urls


def extract() -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    source = SRC.read_text(encoding="utf-8", errors="ignore")
    segment_match = re.search(
        r'<div class="post_content">(.*?)<h2 class="l-articleBottom__title c-secTitle">関連記事</h2>',
        source,
        flags=re.S,
    )
    if not segment_match:
        raise RuntimeError("article segment not found")

    segment = segment_match.group(1)
    blocks = re.split(r"(?=<h3[^>]*>)", segment)

    rows: list[tuple[str, str]] = []
    images: list[tuple[str, str]] = []

    for block in blocks:
        heading_match = re.search(r"<h3[^>]*>(.*?)</h3>", block, flags=re.S)
        if not heading_match:
            continue

        heading = clean_text(heading_match.group(1))
        if not heading:
            continue

        prompt_match = re.search(
            r'<div class="cap_box_content">\s*<p[^>]*>(.*?)</p>',
            block,
            flags=re.S,
        )
        prompt = clean_text(prompt_match.group(1)) if prompt_match else ""
        if not prompt:
            continue

        rows.append((heading, prompt))
        for url in unique_urls(block):
            images.append((heading, url))

    return rows, images


def main() -> None:
    rows, images = extract()

    ROWS_OUT.write_text(
        "\n".join(f"{heading}\t{prompt}" for heading, prompt in rows) + "\n",
        encoding="utf-8",
    )
    IMAGES_OUT.write_text(
        "\n".join(f"{heading}\t{url}" for heading, url in images) + "\n",
        encoding="utf-8",
    )
    print("rows", len(rows), "images", len(images))


if __name__ == "__main__":
    main()
