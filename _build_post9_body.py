from collections import OrderedDict
from pathlib import Path


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


rows = []
for line in Path("/home/adama/civitaiuk/_ai_freak_body_rows.tsv").read_text(
    encoding="utf-8"
).splitlines():
    parts = line.split("\t")
    if len(parts) != 3:
        continue
    h2, prompt, jp = (clean(x) for x in parts)
    if not h2 or not prompt or not jp:
        continue
    rows.append((h2, prompt, jp))

images = OrderedDict()
for line in Path("/home/adama/civitaiuk/_ai_freak_body_images.tsv").read_text(
    encoding="utf-8"
).splitlines():
    parts = line.split("\t")
    if len(parts) != 2:
        continue
    h2, url = (clean(x) for x in parts)
    if not h2 or not url:
        continue
    images.setdefault(h2, [])
    if url not in images[h2]:
        images[h2].append(url)

sections = OrderedDict()
seen = set()
for h2, prompt, jp in rows:
    key = (h2, prompt.lower())
    if key in seen:
        continue
    seen.add(key)
    sections.setdefault(h2, []).append((prompt, jp))

lines = []
lines.append("体型・身長・胸サイズの表現で使えるプロンプトを、画像付きで再編集した記事です。")
lines.append("各単語はそのままコピーして使えるよう、英語タグと日本語訳を1行で整理しています。")
lines.append("")
lines.append("## 目次")
for h2 in sections.keys():
    lines.append(f"- {h2}")
lines.append("")
lines.append("## 使い方")
lines.append("- まずは体型タグを1つ選ぶ")
lines.append("- 次に胸サイズや身長タグを追加する")
lines.append("- 破綻したらタグ数を減らして再生成する")

for h2, items in sections.items():
    lines.append("")
    lines.append(f"## {h2}")
    if images.get(h2):
        lines.append("")
        lines.append("### サンプル画像")
        lines.append("")
        for idx, url in enumerate(images[h2], start=1):
            lines.append(f"![{h2} {idx}]({url})")
    lines.append("")
    lines.append("### プロンプト一覧")
    lines.append("")
    for prompt, jp in items:
        lines.append(f"- {prompt}：{jp}")

lines.append("")
lines.append("## すぐ使える組み立て例")
lines.append("")
lines.append("- 細身＋長身：`Slim Body, Tall Height, Long-legged Height`")
lines.append("- ふくよか＋巨乳：`Curvy Body, Full-Figured Body, Huge Breasts`")
lines.append("- 小柄＋華奢：`Petite Body, Petite Height, Slight Body`")
lines.append("- 高身長モデル体型：`Statuesque Height, Svelte Body, Balanced build`")

body = "\n".join(lines).strip() + "\n"
Path("/home/adama/civitaiuk/_post9_body_reedited.md").write_text(body, encoding="utf-8")
print("sections", len(sections), "rows", len(rows), "chars", len(body))
