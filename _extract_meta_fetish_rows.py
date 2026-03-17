import html
import re
from pathlib import Path


source = Path("/home/adama/civitaiuk/_source_meta_camp_fetish.html").read_text(
    encoding="utf-8", errors="ignore"
)

anchor = source.find("胸・おっぱいフェチ")
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
    r"(<h2[^>]*wp-block-heading[^>]*>.*?</h2>|<h3[^>]*wp-block-heading[^>]*>.*?</h3>|<tr>.*?</tr>)",
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

    # Skip table headers
    if "<th>日本語</th>" in chunk and "<th>プロンプト</th>" in chunk:
        continue

    th_match = re.search(r"<th>(.*?)</th>", chunk, re.S)
    if not th_match:
        continue
    jp = strip_tags(th_match.group(1))
    if not jp:
        continue

    # Prompt is primarily in input value, fallback to code block text.
    value_match = re.search(r'class="prompt-tag"[^>]*value="(.*?)"', chunk, re.S)
    if value_match:
        prompt = html.unescape(value_match.group(1)).strip()
    else:
        code_match = re.search(r"<code>(.*?)</code>", chunk, re.S)
        prompt = strip_tags(code_match.group(1)) if code_match else ""

    if not prompt:
        continue

    td_list = re.findall(r"<td>(.*?)</td>", chunk, re.S)
    note = ""
    if td_list:
        note = strip_tags(td_list[-1])

    rows.append((h2, h3, jp, prompt, note))

out = Path("/home/adama/civitaiuk/_meta_camp_fetish_rows.tsv")
out.write_text("\n".join("\t".join(r) for r in rows), encoding="utf-8")

print("rows", len(rows))
for r in rows[:12]:
    print(r)
print("...")
for r in rows[-12:]:
    print(r)
