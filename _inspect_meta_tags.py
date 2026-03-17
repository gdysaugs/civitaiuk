import re
from pathlib import Path
s = Path('/home/adama/civitaiuk/_source_meta_camp_sex_action.html').read_text(encoding='utf-8', errors='ignore')
for pat in [r'<h2[^>]*>', r'<h3[^>]*>', r'<dt[^>]*>', r'<pre[^>]*><code>']:
    print(pat, len(re.findall(pat, s)))

for m in re.finditer(r'<h2[^>]*>.*?</h2>', s, re.S):
    t=re.sub('<.*?>','',m.group(0))
    if t.strip():
        print('H2:',t.strip()[:120])
        
print('--- sample dt')
for m in re.finditer(r'<dt[^>]*>.*?</dt>', s, re.S):
    t=re.sub('<.*?>','',m.group(0)).strip()
    if t:
        print(t)
        if len(t)>0:
            pass
        if sum(1 for _ in [1])>0 and False:
            break
        
print('done')
