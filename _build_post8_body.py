from collections import OrderedDict
from pathlib import Path
import re


def clean(value: str) -> str:
    return " ".join((value or "").replace("\u00a0", " ").strip().split())


TRANSLATE = {
    "sitting with knees up on bed": "ベッドで膝を立てて座る",
    "sitting with knees up on sofa at living": "リビングのソファで膝を立てる",
    "spread legs": "脚を開く",
    "cowgirl position": "騎乗位ポーズ",
    "open legs": "脚を開いた姿勢",
    "on bed": "ベッド上",
    "crawling position on their hands and knees": "四つん這い姿勢",
    "seductively posing on all fours on a bed": "ベッドで誘惑的に四つん這いポーズ",
    "looking up flirtatiously": "挑発的に見上げる",
    "leaning forward": "前傾姿勢",
    "hands on knees": "膝に手を置く",
    "nsfw": "成人向け表現",
    "breast squeeze": "胸を寄せる・掴む",
    "mini skirt": "ミニスカート",
    "skirt lift": "スカートをたくし上げる",
    "from bottom": "下からのアングル",
    "wearing knit sweater & miniskirt": "ニットとミニスカを着る",
    "flirtingly lifting her skirt to show her panties": "挑発的にスカートを上げて下着を見せる",
    "spread pussy": "秘部を開く表現",
    "back pose": "後ろ向きポーズ",
    "back view": "後ろ姿",
    "stick out butt": "お尻を突き出す",
    "show your butt hole": "お尻の穴を見せる",
    "nude": "裸",
    "wearing fishnet bodystocking": "網タイツのボディストッキング着用",
    "wearing frilly babydoll and matching shorts": "フリルのベビードールとおそろいショーツ",
    "wearing halter neck lace teddy with peek-a-boo cups": "ホルターネックのレーステディ（胸開き）",
    "embarrassed": "恥ずかしそう",
    "blush": "赤面",
    "half closed eyes": "半目",
    "orgasm face": "絶頂顔",
}


def strip_weight(token: str) -> str:
    t = token.strip()
    # (term:1.3) -> term
    m = re.match(r"^\((.+?):\s*[\d.]+\)$", t)
    if m:
        return m.group(1).strip()
    return t


def split_tokens(prompt: str) -> list[str]:
    text = prompt.replace(" or ", ", ")
    parts = [clean(p) for p in text.split(",")]
    tokens = []
    for p in parts:
        if not p:
            continue
        p = strip_weight(p)
        if p and p not in tokens:
            tokens.append(p)
    return tokens


rows = []
for line in Path("/home/adama/civitaiuk/_ai_freak_sexy_prompts.tsv").read_text(
    encoding="utf-8"
).splitlines():
    parts = line.split("\t")
    if len(parts) != 4:
        continue
    h2, h3, _kind, prompt = (clean(x) for x in parts)
    rows.append((h2, h3, prompt))

sections: OrderedDict[str, list[tuple[str, str]]] = OrderedDict()
for h2, h3, prompt in rows:
    sections.setdefault(h2, []).append((h3, prompt))

lines = []
lines.append("セクシー寄りの演出で使えるプロンプトを、ブログ形式で再編集した実用メモです。")
lines.append("まずは1つの構図を決めてから、服装・表情タグを少しずつ足すと破綻しにくくなります。")
lines.append("")
lines.append("## 目次")
for h2 in sections.keys():
    lines.append(f"- {h2}")
lines.append("")
lines.append("## 使い方")
lines.append("- 1つの見出しにつき「本命プロンプト」を最初に使う")
lines.append("- うまく出ない時は重み `:1.2` 〜 `:1.5` を段階的に調整する")
lines.append("- 露出を抑えたい場合は `nude` を外して衣装タグを残す")

for h2, items in sections.items():
    lines.append("")
    lines.append(f"## {h2}")
    lines.append("")
    for h3, prompt in items:
        lines.append(f"### {h3}")
        lines.append("")
        lines.append(f"- {prompt}：基本形。{h3}を狙うときの軸プロンプト")
        for token in split_tokens(prompt):
            key = token.lower()
            jp = TRANSLATE.get(key, "構図・演出タグ")
            lines.append(f"- {token}：{jp}")
        lines.append("")

lines.append("## すぐ使える組み立て例")
lines.append("")
lines.append("- 角度つきパンチラ：`mini skirt, (skirt lift:1.3), (from bottom:1.3), blush`")
lines.append("- 後ろ姿強調：`(stick out butt:1.3), (back view:1.8), looking_at_viewer`")
lines.append("- 色気の四つん這い：`crawling position on their hands and knees, looking up flirtatiously`")
lines.append("- 控えめセクシー：`wearing knit sweater & miniskirt, embarrassed, blush`")

body = "\n".join(lines).strip() + "\n"
Path("/home/adama/civitaiuk/_post8_body_reedited.md").write_text(body, encoding="utf-8")
print("sections", len(sections), "rows", len(rows), "chars", len(body))
