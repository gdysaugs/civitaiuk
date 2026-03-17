import html
import re
from pathlib import Path


source = Path("/home/adama/civitaiuk/_source_ai_freak_sexy.html").read_text(
    encoding="utf-8", errors="ignore"
)

start_anchor = source.find("足を広げる系のプロンプト")
if start_anchor == -1:
    raise SystemExit("start anchor not found")

start = source.rfind("<h2", 0, start_anchor)
if start == -1:
    start = start_anchor

end_match = re.search(
    r"<h2[^>]*>\s*なかなか上手くAI画像生成ができません.*?</h2>", source[start:], re.S
)
if not end_match:
    raise SystemExit("end marker not found")
end = start + end_match.start()

segment = source[start:end]

h2h3_pat = re.compile(r"<h2[^>]*>.*?</h2>|<h3[^>]*>.*?</h3>", re.S)
cap_pat = re.compile(
    r'<div class="cap_box is-style-small_ttl">.*?<div class="cap_box_ttl">(.*?)</div>.*?<div class="cap_box_content">(.*?)</div>\s*</div>',
    re.S,
)

events = []
for m in h2h3_pat.finditer(segment):
    text = html.unescape(re.sub(r"<.*?>", "", m.group(0), flags=re.S)).strip()
    if not text:
        continue
    tag = "h2" if m.group(0).startswith("<h2") else "h3"
    events.append((m.start(), tag, text, ""))

for m in cap_pat.finditer(segment):
    cap_ttl = html.unescape(re.sub(r"<.*?>", "", m.group(1), flags=re.S)).strip()
    cap_content = html.unescape(re.sub(r"<.*?>", "", m.group(2), flags=re.S)).strip()
    cap_content = " ".join(cap_content.replace("\u00a0", " ").split())
    if not cap_content:
        continue
    events.append((m.start(), "cap", cap_ttl, cap_content))

events.sort(key=lambda x: x[0])

current_h2 = ""
current_h3 = ""
rows = []
for _, typ, a, b in events:
    if typ == "h2":
        current_h2 = a
        current_h3 = ""
        continue
    if typ == "h3":
        current_h3 = a
        continue
    if typ == "cap" and current_h2 and current_h3:
        rows.append((current_h2, current_h3, a, b))

out = Path("/home/adama/civitaiuk/_ai_freak_sexy_prompts.tsv")
out.write_text("\n".join("\t".join(r) for r in rows), encoding="utf-8")

print("rows", len(rows))
for r in rows[:10]:
    print(r)
print("...")
for r in rows[-10:]:
    print(r)
