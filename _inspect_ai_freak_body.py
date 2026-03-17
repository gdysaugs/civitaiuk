import re
from pathlib import Path
s=Path('/home/adama/civitaiuk/_source_ai_freak_body.html').read_text(encoding='utf-8',errors='ignore')
print('h2',len(re.findall(r'<h2[^>]*>.*?</h2>',s,re.S)))
print('h3',len(re.findall(r'<h3[^>]*>.*?</h3>',s,re.S)))
for m in re.finditer(r'<h2[^>]*>.*?</h2>',s,re.S):
    t=re.sub('<.*?>','',m.group(0)).strip()
    if t:
        print(t)
print('--- og/twitter image ---')
for pat in [r'<meta[^>]+property=["\']og:image["\'][^>]*>', r'<meta[^>]+name=["\']twitter:image["\'][^>]*>']:
    mm=re.search(pat,s,re.S)
    if mm: print(mm.group(0))
