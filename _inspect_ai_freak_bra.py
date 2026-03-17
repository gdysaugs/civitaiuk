import re
from pathlib import Path
s=Path('/home/adama/civitaiuk/_source_ai_freak_bra.html').read_text(encoding='utf-8',errors='ignore')
print('h2',len(re.findall(r'<h2[^>]*>.*?</h2>',s,re.S)))
print('h3',len(re.findall(r'<h3[^>]*>.*?</h3>',s,re.S)))
print('---h2---')
for m in re.finditer(r'<h2[^>]*>.*?</h2>',s,re.S):
    t=re.sub('<.*?>','',m.group(0)).strip()
    if t:
        print(t)
thumb=re.search(r'<figure class="p-articleThumb"><img[^>]+src="([^"]+)"',s,re.S)
print('thumb',thumb.group(1) if thumb else 'none')
