import html
import re
from pathlib import Path

source = Path("/home/adama/civitaiuk/_source_meta_camp_camera_angle.html").read_text(
    encoding="utf-8", errors="ignore"
)

anchor = source.find("アングル (28件)")
if anchor == -1:
    raise SystemExit("start marker not found")
start = source.rfind("<h2", 0, anchor)
if start == -1:
    start = anchor

end = source.find("他のV3対象ページからプロンプトを探す", start)
if end == -1:
    end = len(source)

segment = source[start:end]

token = re.compile(
    r"(<h2[^>]*wp-block-heading[^>]*>.*?</h2>|<h3[^>]*wp-block-heading[^>]*>.*?</h3>|<tr class=\"main-row\">.*?</tr>|<tr class=\"guide-row\">.*?</tr>)",
    re.S,
)


def strip_tags(value: str) -> str:
    return html.unescape(re.sub(r"<.*?>", "", value, flags=re.S)).strip()


h2 = ""
h3 = ""
rows = []
for match in token.finditer(segment):
    chunk = match.group(1)

    if chunk.startswith("<h2"):
        h2 = strip_tags(chunk)
        h3 = ""
        continue

    if chunk.startswith("<h3"):
        h3 = strip_tags(chunk)
        continue

    if chunk.startswith('<tr class="main-row">'):
        prompt = ""
        dm = re.search(r'data-copy="(.*?)"', chunk, re.S)
        if dm:
            prompt = html.unescape(dm.group(1)).strip()

        if not prompt:
            cm = re.search(r'<div class="tag-code">(.*?)</div>', chunk, re.S)
            if cm:
                prompt = strip_tags(cm.group(1))

        alias_main = ""
        alias_sub = ""
        am = re.search(r'<div class="alias-main">(.*?)</div>', chunk, re.S)
        if am:
            alias_main = strip_tags(am.group(1))
        asm = re.search(r'<div class="alias-sub">(.*?)</div>', chunk, re.S)
        if asm:
            alias_sub = strip_tags(asm.group(1))

        rows.append([h2, h3, prompt, alias_main, alias_sub, ""])
        continue

    if chunk.startswith('<tr class="guide-row">') and rows:
        gm = re.search(r'<span class="guide-text">(.*?)</span>', chunk, re.S)
        if gm:
            rows[-1][5] = strip_tags(gm.group(1))

out = Path("/home/adama/civitaiuk/_meta_camp_camera_rows.tsv")
out.write_text("\n".join("\t".join(row) for row in rows), encoding="utf-8")
print("rows", len(rows))
for row in rows[:10]:
    print(tuple(row))
print("...")
for row in rows[-10:]:
    print(tuple(row))
