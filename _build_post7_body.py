from collections import OrderedDict
from pathlib import Path


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


rows = []
for line in Path("/home/adama/civitaiuk/_meta_camp_fetish_rows.tsv").read_text(
    encoding="utf-8"
).splitlines():
    parts = line.split("\t")
    if len(parts) != 5:
        continue
    h2, h3, jp, prompt, note = (clean(x) for x in parts)
    if not h2 or not h3 or not prompt:
        continue
    rows.append((h2, h3, jp, prompt, note))

sections: OrderedDict[str, OrderedDict[str, list[tuple[str, str, str]]]] = OrderedDict()
for h2, h3, jp, prompt, note in rows:
    sections.setdefault(h2, OrderedDict()).setdefault(h3, []).append((jp, prompt, note))

lines = []
lines.append("NSFWフェチ系タグを、部位・質感・シチュ別に再編集した実用一覧です。")
lines.append("英語タグをそのままコピーできる形式で、各単語の和訳も併記しています。")
lines.append("")
lines.append("## 目次")
for h2 in sections.keys():
    lines.append(f"- {h2}")
lines.append("")
lines.append("## 使い方のコツ")
lines.append("- まずは部位タグを1つ決める")
lines.append("- 次に衣装や質感タグを2〜3個足す")
lines.append("- 最後に視線・構図タグで印象を調整する")

for h2, groups in sections.items():
    lines.append("")
    lines.append(f"## {h2}")
    for h3, items in groups.items():
        lines.append("")
        lines.append(f"### {h3}")
        lines.append("")
        for jp, prompt, note in items:
            desc = jp
            if note:
                desc = f"{jp}。{note}"
            lines.append(f"- {prompt}：{desc}")

lines.append("")
lines.append("## すぐ使える組み立て例")
lines.append("")
lines.append("- 胸強調：`huge_breasts, cleavage, glossy_breasts, front_view_breasts`")
lines.append("- 脚強調：`beautiful_legs, thigh_focus, pantyhose, crossed_legs`")
lines.append("- 尻強調：`big_ass, ass_focus, tight_skirt, from_behind`")
lines.append("- 口元強調：`plump_lips, glossy_lips, close-up_lips, looking_at_viewer`")

body = "\n".join(lines).strip() + "\n"
Path("/home/adama/civitaiuk/_post7_body_reedited.md").write_text(body, encoding="utf-8")
print("sections", len(sections), "rows", len(rows), "chars", len(body))
