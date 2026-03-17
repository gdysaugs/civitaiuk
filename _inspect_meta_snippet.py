from pathlib import Path
s=Path('/home/adama/civitaiuk/_source_meta_camp_sex_action.html').read_text(encoding='utf-8',errors='ignore')
needle='お口・舌・胸・指を使った刺激的な行為の基本プロンプト 6選'
i=s.find(needle)
print('idx',i)
print(s[i-800:i+2600])
