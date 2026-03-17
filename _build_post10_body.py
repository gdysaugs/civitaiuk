import re
from collections import OrderedDict
from pathlib import Path


ROWS_PATH = Path("/home/adama/civitaiuk/_ai_freak_bra_rows.tsv")
IMAGES_PATH = Path("/home/adama/civitaiuk/_ai_freak_bra_images.tsv")
OUT_PATH = Path("/home/adama/civitaiuk/_post10_body_reedited.md")


PHRASE_JA = {
    "Bustier with garters and thong set": "ガーター付きバスチェとTバックセット",
    "Off-the-shoulder sheer nightie with matching garter belt": "おそろいガーターベルト付きオフショルダーのシアーナイティ",
    "Embroidered teddy and silk briefs": "刺繍入りテディとシルクブリーフ",
    "Fishnet bodystocking": "フィッシュネットのボディストッキング",
    "Frilly babydoll and matching shorts": "フリル付きベビードールとおそろいショーツ",
    "Halter neck lace teddy with peek-a-boo cups": "ピーカブーカップ付きホルターネックのレーステディ",
    "High-leg lace bodysuit with deep V-back": "深いVバックのハイレグレースボディスーツ",
    "Mesh panel nightie and hipster briefs": "メッシュパネルのナイティとヒップスターブリーフ",
    "Satin corset and lace-up (back panties)": "サテンのコルセットとレースアップバックのパンティ",
    "Velvet camisole and lace boyshorts": "ベルベットのキャミソールとレースのボーイショーツ",
    "Velvet plunge bodysuit with cutout details": "カットアウトディテール入りベルベットのプランジボディスーツ",
}


WORD_JA = {
    "bustier": "バスチェ",
    "with": "〜付き",
    "garters": "ガーター",
    "and": "〜と〜",
    "thong": "Tバック",
    "set": "セット",
    "off-the-shoulder": "オフショルダー",
    "sheer": "透け感のある",
    "nightie": "ナイティ",
    "matching": "おそろいの",
    "garter": "ガーター",
    "belt": "ベルト",
    "embroidered": "刺繍入り",
    "teddy": "テディ",
    "silk": "シルク",
    "briefs": "ブリーフ",
    "fishnet": "フィッシュネット",
    "bodystocking": "ボディストッキング",
    "frilly": "フリル付き",
    "babydoll": "ベビードール",
    "shorts": "ショーツ",
    "halter": "ホルター",
    "neck": "ネック",
    "lace": "レース",
    "peek-a-boo": "ピーカブー",
    "cups": "カップ",
    "high-leg": "ハイレグ",
    "bodysuit": "ボディスーツ",
    "deep": "深い",
    "v-back": "Vバック",
    "mesh": "メッシュ",
    "panel": "パネル",
    "hipster": "ヒップスター",
    "satin": "サテン",
    "corset": "コルセット",
    "lace-up": "レースアップ",
    "back": "バック",
    "panties": "パンティ",
    "velvet": "ベルベット",
    "camisole": "キャミソール",
    "boyshorts": "ボーイショーツ",
    "plunge": "プランジ",
    "cutout": "カットアウト",
    "details": "ディテール",
}


def clean(value: str) -> str:
    return " ".join((value or "").strip().split())


def read_rows() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line in ROWS_PATH.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        heading, prompt = (clean(x) for x in parts)
        if not heading or not prompt:
            continue
        rows.append((heading, prompt))
    return rows


def read_images() -> dict[str, list[str]]:
    images: OrderedDict[str, list[str]] = OrderedDict()
    for line in IMAGES_PATH.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) != 2:
            continue
        heading, url = (clean(x) for x in parts)
        if not heading or not url:
            continue
        images.setdefault(heading, [])
        if url not in images[heading]:
            images[heading].append(url)
    return images


def extract_terms(prompt: str) -> list[str]:
    terms = re.findall(r"[A-Za-z][A-Za-z'-]*", prompt)
    unique: list[str] = []
    seen = set()
    for term in terms:
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(term)
    return unique


def phrase_ja(prompt: str, heading: str) -> str:
    return PHRASE_JA.get(prompt, heading)


def build() -> str:
    rows = read_rows()
    images = read_images()

    lines: list[str] = []
    lines.append("女性用下着系の英語プロンプトを、使いやすい形で再編集しました。")
    lines.append("記事内の画像URLは参照元と同じものを掲載しています。")
    lines.append("")
    lines.append("## 使い方")
    lines.append("- まずは `プロンプト（和訳）` の1行をそのままコピー")
    lines.append("- 必要に応じて `単語訳（コピー用）` から語句を追加")
    lines.append("- 服装・体型・背景タグと組み合わせて調整")

    for heading, prompt in rows:
        lines.append("")
        lines.append(f"## {heading}")
        if images.get(heading):
            lines.append("")
            lines.append("### サンプル画像")
            lines.append("")
            for idx, url in enumerate(images[heading], start=1):
                lines.append(f"![{heading} {idx}]({url})")

        lines.append("")
        lines.append("### プロンプト（和訳）")
        lines.append("")
        lines.append(f"- {prompt}：{phrase_ja(prompt, heading)}")

        terms = extract_terms(prompt)
        if terms:
            lines.append("")
            lines.append("### 単語訳（コピー用）")
            lines.append("")
            for term in terms:
                ja = WORD_JA.get(term.lower(), "文脈で調整")
                lines.append(f"- {term}：{ja}")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    body = build()
    OUT_PATH.write_text(body, encoding="utf-8")
    print("chars", len(body))


if __name__ == "__main__":
    main()
