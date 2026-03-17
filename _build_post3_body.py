from collections import OrderedDict
from pathlib import Path

rows = []
for ln in Path('_today_okazu_pairs.tsv').read_text(encoding='utf-8').splitlines():
    h2, h3, jp, en = ln.split('\t')
    h2 = ' '.join(h2.split())
    h3 = ' '.join(h3.split())
    jp = ' '.join(jp.split())
    en = ' '.join(en.split())
    if not en:
        continue
    rows.append((h2, h3, jp, en))

sections = OrderedDict()
seen = set()
for h2, h3, jp, en in rows:
    key = (h2, h3, en.lower())
    if key in seen:
        continue
    seen.add(key)
    sections.setdefault(h2, OrderedDict()).setdefault(h3 or 'basic', []).append((en, jp))

lines = []
lines.append('R-18 prompt reference (re-edited).')
lines.append('Use: position + motion + effect + contact in this order.')
lines.append('')
lines.append('## Index')
for h2 in sections.keys():
    lines.append(f'- {h2}')
lines.append('- Quick Templates')

for h2, subs in sections.items():
    lines.append('')
    lines.append(f'## {h2}')
    for h3, pairs in subs.items():
        lines.append('')
        if h3 and h3 != 'basic':
            lines.append(f'### {h3}')
            lines.append('')
        for en, jp in pairs:
            lines.append(f'- {en}\uFF1A{jp}')

lines.append('')
lines.append('## Quick Templates')
lines.append('')
lines.append('- normal setup\uFF1A1girl, 1boy, sex, missionary, penetration, thrusting, sweat')
lines.append('- cowgirl setup\uFF1A1girl, 1boy, cowgirl position, bouncing, grabbing hips, flushed skin')
lines.append('- back setup\uFF1A1girl, 1boy, doggystyle, rear entry, fast thrust, grabbing ass')
lines.append('- group setup\uFF1A1girl, 2boys, gangbang, spitroast, motion blur, heavy breathing')

body = '\n'.join(lines).strip() + '\n'
Path('_post3_body_reedited.md').write_text(body, encoding='utf-8')
print('wrote _post3_body_reedited.md', 'chars', len(body), 'lines', len(lines))
