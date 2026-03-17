from collections import OrderedDict
from pathlib import Path


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


rows = []
for line in Path("/home/adama/civitaiuk/_meta_camp_camera_rows.tsv").read_text(
    encoding="utf-8"
).splitlines():
    parts = line.split("\t")
    if len(parts) < 6:
        continue
    h2, _h3, prompt, jp_main, jp_sub, _guide = parts
    h2 = clean(h2)
    prompt = clean(prompt)
    jp_main = clean(jp_main)
    jp_sub = clean(jp_sub)
    if not h2 or not prompt:
        continue
    rows.append((h2, prompt, jp_main, jp_sub))

sections = OrderedDict()
seen = set()
for h2, prompt, jp_main, jp_sub in rows:
    key = (h2, prompt.lower())
    if key in seen:
        continue
    seen.add(key)
    sections.setdefault(h2, []).append((prompt, jp_main, jp_sub))

lines = []
lines.append("カメラアングル・構図タグを、実運用しやすい形で再編集した一覧です。")
lines.append("各タグはそのままコピーして使えるように、英語タグ + 日本語訳でまとめています。")
lines.append("")
lines.append("## 目次")
for h2 in sections.keys():
    lines.append(f"- {h2}")
lines.append("")
lines.append("## 使い方のコツ")
lines.append("- まずは1つのアングルタグを軸にする")
lines.append("- 次に構図や視点タグを1〜2個だけ足す")
lines.append("- 破綻したらタグ数を減らして再生成する")

for h2, items in sections.items():
    lines.append("")
    lines.append(f"## {h2}")
    lines.append("")
    for prompt, jp_main, jp_sub in items:
        if jp_sub:
            lines.append(f"- {prompt}：{jp_main}（{jp_sub}）")
        elif jp_main:
            lines.append(f"- {prompt}：{jp_main}")
        else:
            lines.append(f"- {prompt}：構図・視点タグ")

lines.append("")
lines.append("## すぐ使える組み立て例")
lines.append("")
lines.append("- dramatic low angle：`from_below, dutch angle, cinematic shot`")
lines.append("- intimate face framing：`close-up, looking_at_viewer, hand_focus`")
lines.append("- powerful perspective：`foreshortening, dynamic angle, wide shot`")
lines.append("- voyeur mood：`pov_peephole, doorway framing, soft focus`")

body = "\n".join(lines).strip() + "\n"
Path("/home/adama/civitaiuk/_post6_body_reedited.md").write_text(body, encoding="utf-8")
print("sections", len(sections), "rows", len(rows), "chars", len(body))
