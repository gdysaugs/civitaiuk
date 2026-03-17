import re
from pathlib import Path
s=Path('/home/adama/civitaiuk/_source_meta_camp_camera_angle.html').read_text(encoding='utf-8',errors='ignore')
for m in re.finditer(r'<h2[^>]*>.*?</h2>', s, re.S):
    t=re.sub('<.*?>','',m.group(0)).strip()
    if t:
        print(t)
