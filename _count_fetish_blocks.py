import re
from pathlib import Path
s = Path('/home/adama/civitaiuk/_source_meta_camp_fetish.html').read_text(encoding='utf-8', errors='ignore')
start = s.find('胸・おっぱいフェチ')
end = s.find('他のV3対象ページからプロンプトを探す', start)
seg = s[start:end]
print('segment_len', len(seg))
print('main_rows', len(re.findall(r'<tr class="main-row">', seg)))
print('guide_rows', len(re.findall(r'<tr class="guide-row">', seg)))
print('h2', len(re.findall(r'<h2[^>]*wp-block-heading[^>]*>', seg)))
print('h3', len(re.findall(r'<h3[^>]*wp-block-heading[^>]*>', seg)))
