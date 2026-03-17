from collections import OrderedDict
from pathlib import Path

rows=[]
for ln in Path('/home/adama/civitaiuk/_meta_camp_position_rows.tsv').read_text(encoding='utf-8').splitlines():
    h2,h3,jp,prompt,note = ln.split('\t')
    jp = jp.replace('日本語プロンプトひとこと解説','').strip()
    h2 = ' '.join(h2.split())
    h3 = ' '.join(h3.split())
    jp = ' '.join(jp.split())
    prompt = ' '.join(prompt.split())
    note = ' '.join(note.split())
    rows.append((h2,h3,jp,prompt,note))

# Remove non-position terms leaked in first block
exclude_in_basic = {'fellatio','cunnilingus','paizuri','handjob','fingering'}
clean=[]
for h2,h3,jp,prompt,note in rows:
    first = prompt.split(',')[0].strip().lower()
    if h2.startswith('体位の基本') and first in exclude_in_basic:
        continue
    clean.append((h2,h3,jp,prompt,note))

h2_map = {
    '体位の基本プロンプト 11選': '体位の基本（11）',
    '体位の応用プロンプト 15選': '体位の応用（15）',
    '体位の変化プロンプト 12選': '体位の変化（12）',
}

sections=OrderedDict()
seen=set()
for h2,h3,jp,prompt,note in clean:
    key=(h2,prompt.lower())
    if key in seen:
        continue
    seen.add(key)
    sections.setdefault(h2,[]).append((jp,prompt,note))

lines=[]
lines.append('セックス体位タグを、基本から変化形まで再編集した一覧です。')
lines.append('まずは基本体位で骨格を作り、必要に応じて変化タグを足すと安定します。')
lines.append('')
lines.append('## 目次')
for h2 in sections.keys():
    lines.append(f"- {h2_map.get(h2,h2)}")
lines.append('- すぐ使える組み立て例')

for h2,items in sections.items():
    lines.append('')
    lines.append(f"## {h2_map.get(h2,h2)}")
    lines.append('')
    for jp,prompt,note in items:
        desc = jp if not note else f"{jp}。{note}"
        lines.append(f"- {prompt}\uFF1A{desc}")

lines.append('')
lines.append('## すぐ使える組み立て例')
lines.append('')
lines.append('- normal missionary：`missionary, hetero, vaginal, penis in pussy, lying on back, spread legs`')
lines.append('- hard doggy：`doggystyle, sex from behind, ass up high, arched back, deep penetration, sweat`')
lines.append('- close lotus：`lotus position, sitting, face to face, straddling, hug, kiss`')
lines.append('- standing carry：`standing missionary, held up, carrying, legs wrapped around waist, deep penetration`')

body='\n'.join(lines).strip()+'\n'
Path('/home/adama/civitaiuk/_post5_body_reedited.md').write_text(body, encoding='utf-8')
print('rows_in',len(rows),'rows_out',len(clean),'sections',len(sections),'chars',len(body))
