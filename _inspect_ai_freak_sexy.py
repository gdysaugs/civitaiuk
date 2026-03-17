import re
from pathlib import Path
s=Path('/home/adama/civitaiuk/_source_ai_freak_sexy.html').read_text(encoding='utf-8',errors='ignore')
print('h2_count',len(re.findall(r'<h2[^>]*>.*?</h2>',s,re.S)))
print('h3_count',len(re.findall(r'<h3[^>]*>.*?</h3>',s,re.S)))
m=re.search(r'<meta[^>]+property=["\']og:image["\'][^>]*>', s)
print('og_meta',m.group(0) if m else 'none')
print('----h2----')
for x in re.finditer(r'<h2[^>]*>.*?</h2>',s,re.S):
    t=re.sub('<.*?>','',x.group(0)).strip()
    if t:
        print(t)
