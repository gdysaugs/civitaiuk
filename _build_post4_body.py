from collections import OrderedDict
from pathlib import Path

rows=[]
for ln in Path('/home/adama/civitaiuk/_meta_camp_action_rows.tsv').read_text(encoding='utf-8').splitlines():
    h2,h3,jp,prompt,note = ln.split('\t')
    jp = jp.replace('日本語プロンプトひとこと解説','').strip()
    h2 = ' '.join(h2.split())
    h3 = ' '.join(h3.split())
    jp = ' '.join(jp.split())
    prompt = ' '.join(prompt.split())
    note = ' '.join(note.split())
    prompt = prompt.replace(' とか ', ' / ')
    rows.append((h2,h3,jp,prompt,note))

# Section title remap
h2_map = {
    'お口・舌・胸・指を使った刺激的な行為の基本プロンプト 6選': '基本アクション（6）',
    '口や舌を使った刺激的な行為の応用プロンプト 10選': '口・舌の応用（10）',
    '胸を使った刺激的な行為の応用プロンプト 5選': '胸アクションの応用（5）',
    '手や指を使った刺激的な行為の応用プロンプト 15選': '手・指アクションの応用（15）',
}

sections = OrderedDict()
seen = set()
for h2,h3,jp,prompt,note in rows:
    key = (h2,h3,prompt.lower())
    if key in seen:
        continue
    seen.add(key)
    sections.setdefault(h2, OrderedDict()).setdefault(h3 or '基本', []).append((jp,prompt,note))

lines=[]
lines.append('刺激的な行為タグを、使いやすい順に再編集した実用メモです。')
lines.append('短い基本タグから入れて、必要に応じて複合タグへ広げると崩れにくくなります。')
lines.append('')
lines.append('## 目次')
for h2 in sections:
    lines.append(f"- {h2_map.get(h2,h2)}")
lines.append('- 運用メモ')

for h2, subs in sections.items():
    lines.append('')
    lines.append(f"## {h2_map.get(h2,h2)}")
    for h3, items in subs.items():
        lines.append('')
        if h3 and h3 != '基本':
            lines.append(f"### {h3}")
            lines.append('')
        for jp,prompt,note in items:
            desc = jp
            if note:
                desc = f"{jp}。{note}"
            lines.append(f"- {prompt}\uFF1A{desc}")

lines.append('')
lines.append('## 運用メモ')
lines.append('- まずは単体タグ（`fellatio` など）で骨格を作る')
lines.append('- 次に液体・表情・視線タグを少しずつ追加する')
lines.append('- 破綻したらタグ数を減らし、近い意味の語へ置き換える')

body='\n'.join(lines).strip()+'\n'
Path('/home/adama/civitaiuk/_post4_body_reedited.md').write_text(body, encoding='utf-8')
print('rows',len(rows),'sections',len(sections),'chars',len(body))
