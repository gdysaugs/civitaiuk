# -*- coding: utf-8 -*-
from html.parser import HTMLParser
from pathlib import Path
import html

src = Path('_source_1756.html').read_text(encoding='utf-8', errors='ignore')

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_article = False
        self.article_depth = 0
        self.capture_heading = False
        self.heading_level = None
        self.heading_text = []
        self.current_heading = ''
        self.in_table = False
        self.in_tr = False
        self.in_td = False
        self.current_cell = []
        self.current_row = []
        self.tables = []
        self.table_rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'article' and attrs.get('id') == 'post-1756':
            self.in_article = True
            self.article_depth = 1
            return
        if not self.in_article:
            return

        if tag == 'article':
            self.article_depth += 1

        if tag in ('h2', 'h3', 'h4'):
            self.capture_heading = True
            self.heading_level = tag
            self.heading_text = []

        if tag == 'table':
            self.in_table = True
            self.table_rows = []

        if self.in_table and tag == 'tr':
            self.in_tr = True
            self.current_row = []

        if self.in_tr and tag in ('td', 'th'):
            self.in_td = True
            self.current_cell = []

    def handle_endtag(self, tag):
        if not self.in_article:
            return

        if self.in_td and tag in ('td', 'th'):
            text = ' '.join(''.join(self.current_cell).split())
            text = html.unescape(text)
            self.current_row.append(text)
            self.in_td = False
            self.current_cell = []

        if self.in_tr and tag == 'tr':
            if any(c.strip() for c in self.current_row):
                self.table_rows.append(self.current_row)
            self.in_tr = False

        if self.in_table and tag == 'table':
            rows = [r for r in self.table_rows if len(r) >= 2]
            if rows and rows[0][0] in ('プロンプト', 'Prompt', 'prompt'):
                rows = rows[1:]
            if rows:
                self.tables.append({'heading': self.current_heading, 'rows': rows})
            self.in_table = False
            self.table_rows = []

        if self.capture_heading and tag == self.heading_level:
            text = ' '.join(''.join(self.heading_text).split())
            text = html.unescape(text)
            if text:
                self.current_heading = text
            self.capture_heading = False
            self.heading_level = None
            self.heading_text = []

        if tag == 'article':
            self.article_depth -= 1
            if self.article_depth <= 0:
                self.in_article = False

    def handle_data(self, data):
        if not self.in_article:
            return
        if self.capture_heading:
            self.heading_text.append(data)
        if self.in_td:
            self.current_cell.append(data)

p = Parser()
p.feed(src)

by_head = {t['heading']: t['rows'] for t in p.tables}

order = [
    ('プレイ系', ['体位・挿入系', '前戯系プレイ', 'マルチプレイ', '異種姦']),
    ('体', ['体', '乳首', '男性器', '体液', '射精']),
    ('キャラ属性', ['キャラ属性']),
    ('表情', ['表情']),
    ('ポーズ・行動', ['ポーズ・行動']),
    ('エロ衣装', ['エロ衣装', 'パンツ']),
    ('ボンデージ・SM系', ['ボンデージ・SM系']),
    ('道具', ['道具']),
    ('表現強化', ['状態・シチュ', 'エフェクト・文字', '断面図', 'モザイク', 'カメラワーク']),
]

lines = []
lines.append('成人向け生成で使うプロンプトを、カテゴリ別に和訳付きで再編集した一覧です。')
lines.append('必要なカテゴリだけ選んで組み合わせると、狙った出力に調整しやすくなります。')
lines.append('')
lines.append('## 目次')
for g, _ in order:
    lines.append(f'- {g}')
lines.append('')

for g, subs in order:
    lines.append(f'## {g}')
    lines.append('')
    for sub in subs:
        rows = by_head.get(sub, [])
        if not rows:
            continue
        lines.append(f'### {sub}（{len(rows)}）')
        lines.append('')
        for row in rows:
            prompt = (row[0] or '').strip()
            meaning = (row[1] or '').strip()
            if not prompt:
                continue
            if meaning:
                lines.append(f'- {prompt}：{meaning}')
            else:
                lines.append(f'- {prompt}')
        lines.append('')

lines.append('---')
lines.append('運用メモ')
lines.append('- 最初は「行為 + ポーズ + カメラ」の3カテゴリから始める')
lines.append('- 破綻したら語数を減らし、近い単語に入れ替える')
lines.append('- 利用規約と法令に合わせて利用する')

body = '\n'.join(lines).strip() + '\n'
Path('_post2_body_with_ja.md').write_text(body, encoding='utf-8')

count = sum(1 for ln in lines if ln.startswith('- '))
print('tables', len(p.tables))
print('prompt_count', count)
print('chars', len(body))
