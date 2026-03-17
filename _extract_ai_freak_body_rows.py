import html
import re
from collections import OrderedDict
from pathlib import Path


source = Path("/home/adama/civitaiuk/_source_ai_freak_body.html").read_text(
    encoding="utf-8", errors="ignore"
)

start_anchor = source.find("細身の体型を表すプロンプト")
if start_anchor == -1:
    raise SystemExit("start anchor not found")

start = source.rfind("<h2", 0, start_anchor)
if start == -1:
    start = start_anchor

end_match = re.search(r"<h2[^>]*>\s*関連記事\s*</h2>", source[start:], re.S)
if not end_match:
    raise SystemExit("end anchor not found")
end_anchor = start + end_match.start()

segment = source[start:end_anchor]

token = re.compile(r"(<h2[^>]*>.*?</h2>|<div id='gallery-\d+'[^>]*>.*?</div>|<table>.*?</table>)", re.S)


def strip_tags(value: str) -> str:
    text = re.sub(r"<.*?>", "", value, flags=re.S)
    return " ".join(html.unescape(text).replace("\u00a0", " ").split())


current_h2 = ""
rows = []
images_by_h2: dict[str, list[str]] = OrderedDict()

for m in token.finditer(segment):
    chunk = m.group(1)

    if chunk.startswith("<h2"):
        current_h2 = strip_tags(chunk)
        if current_h2 and current_h2 not in images_by_h2:
            images_by_h2[current_h2] = []
        continue

    if not current_h2:
        continue

    if chunk.startswith("<div id='gallery-"):
        # Prefer data-src (lazyload original), fallback to src.
        urls = re.findall(r'data-src="(https://ai-freak\.com/wp-content/uploads/[^"]+)"', chunk)
        if not urls:
            urls = re.findall(r'src="(https://ai-freak\.com/wp-content/uploads/[^"]+)"', chunk)

        seen = set(images_by_h2.get(current_h2, []))
        for u in urls:
            if u in seen:
                continue
            seen.add(u)
            images_by_h2.setdefault(current_h2, []).append(u)
        continue

    if chunk.startswith("<table>"):
        for tr in re.findall(r"<tr>.*?</tr>", chunk, re.S):
            cols = re.findall(r"<t[hd]>(.*?)</t[hd]>", tr, re.S)
            if len(cols) < 2:
                continue
            prompt = strip_tags(cols[0])
            jp = strip_tags(cols[1])
            if not prompt or not jp:
                continue
            if prompt == "プロンプト" and jp == "日本語":
                continue
            if prompt == "プロンプト" and jp in {"説明", "日本語"}:
                continue
            rows.append((current_h2, prompt, jp))

rows_out = Path("/home/adama/civitaiuk/_ai_freak_body_rows.tsv")
rows_out.write_text("\n".join("\t".join(r) for r in rows), encoding="utf-8")

img_lines = []
for h2, urls in images_by_h2.items():
    for u in urls:
        img_lines.append(f"{h2}\t{u}")
Path("/home/adama/civitaiuk/_ai_freak_body_images.tsv").write_text("\n".join(img_lines), encoding="utf-8")

print("sections", len(images_by_h2))
print("rows", len(rows))
print("images", sum(len(v) for v in images_by_h2.values()))
for r in rows[:8]:
    print(r)
