import re, html
from pathlib import Path
s = Path('/home/adama/civitaiuk/_source_meta_camp_sex_action.html').read_text(encoding='utf-8', errors='ignore')
start = s.find('<h2 class="wp-block-heading">お口・舌・胸・指を使った刺激的な行為の基本プロンプト 6選</h2>')
if start == -1:
    raise SystemExit('start not found')
s = s[start:]
end_mark = '<h2 class="wp-block-heading">刺激的な行為と組み合わせたいプロンプト（関連記事）</h2>'
end = s.find(end_mark)
if end != -1:
    s = s[:end]

# token stream: h2, h3, table rows
tok = re.compile(r'(<h2 class="wp-block-heading">.*?</h2>|<h3 class="wp-block-heading">.*?</h3>|<tr><th>.*?</th><td><code>.*?</code>.*?<td>.*?</td></tr>)', re.S)
h2 = ''
h3 = ''
rows = []
for m in tok.finditer(s):
    t = m.group(1)
    if t.startswith('<h2'):
        h2 = html.unescape(re.sub('<.*?>', '', t, flags=re.S)).strip()
        h3 = ''
    elif t.startswith('<h3'):
        h3 = html.unescape(re.sub('<.*?>', '', t, flags=re.S)).strip()
    elif t.startswith('<tr>'):
        mm = re.search(r'<tr><th>(.*?)</th><td><code>(.*?)</code>.*?<td>(.*?)</td></tr>', t, re.S)
        if not mm:
            continue
        jp = html.unescape(re.sub('<.*?>', '', mm.group(1), flags=re.S)).strip()
        prompt = html.unescape(re.sub('<.*?>', '', mm.group(2), flags=re.S)).strip()
        note = html.unescape(re.sub('<.*?>', '', mm.group(3), flags=re.S)).strip()
        rows.append((h2, h3, jp, prompt, note))

Path('/home/adama/civitaiuk/_meta_camp_action_rows.tsv').write_text('\n'.join('\t'.join(r) for r in rows), encoding='utf-8')
print('rows', len(rows))
for r in rows[:30]:
    print(r)
