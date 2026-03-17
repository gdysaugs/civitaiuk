import re, html
from pathlib import Path
src = Path('/home/adama/civitaiuk/_source_meta_camp_sex_action.html').read_text(encoding='utf-8', errors='ignore')
# Focus main post area if present
start = src.find('<div class="post_content">')
if start != -1:
    src = src[start:]
end = src.find('<h2 class="wp-block-heading">まとめ</h2>')
if end != -1:
    src = src[:end]

pat = re.compile(r'(<h2 class="wp-block-heading">.*?</h2>|<h3 class="wp-block-heading">.*?</h3>|<dt class="swell-block-dl__dt">.*?</dt>|<pre class="wp-block-code[^>]*><code>.*?</code></pre>)', re.S)
items = []
h2 = ''
h3 = ''
pending = None
for m in pat.finditer(src):
    tok = m.group(1)
    if tok.startswith('<h2'):
        h2 = html.unescape(re.sub('<.*?>', '', tok, flags=re.S)).strip()
        h3 = ''
    elif tok.startswith('<h3'):
        h3 = html.unescape(re.sub('<.*?>', '', tok, flags=re.S)).strip()
    elif tok.startswith('<dt'):
        pending = html.unescape(re.sub('<.*?>', '', tok, flags=re.S)).strip()
    elif tok.startswith('<pre') and pending:
        mcode = re.search(r'<code>(.*?)</code>', tok, re.S)
        code = html.unescape(mcode.group(1)).strip() if mcode else ''
        items.append((h2, h3, pending, code))
        pending = None

Path('/home/adama/civitaiuk/_meta_camp_pairs.tsv').write_text('\n'.join('\t'.join(x) for x in items), encoding='utf-8')
print('pairs', len(items))
for row in items[:40]:
    print(row)
