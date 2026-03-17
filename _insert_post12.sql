INSERT INTO threads (title, author_name, media_type, nsfw, is_locked, is_deleted)
VALUES ('水着・ビキニプロンプト集', 'owner', 'image', 0, 1, 0);

INSERT INTO posts (
  thread_id,
  body,
  media_url,
  thumbnail_url,
  media_mime,
  author_name,
  nsfw,
  is_deleted
) VALUES (
  last_insert_rowid(),
  '水着・ビキニの形、柄、素材感を整理したプロンプト集です。
記事内の画像URLは参考ページのものをそのまま掲載しています。

## 使い方
- `英語プロンプト: 日本語の意味` の形式で掲載しています。
- 先頭のコピーボタンから英語プロンプトだけをコピーできます。
- 重み付けや他要素の指定を組み合わせて最終調整してください。

## 水着・ビキニの形についてのプロンプト
まずは 水着の形に関するプロンプト です。
カラーはDeep Greenを適用していますが、勿論他のカラーに変更していただいても構いません。

### bandeau bikini
- bandeau bikini: こちらは 肩に紐などが無いタイプの水着 です。
海外ではかなりポピュラーな水着ですが、数年前から日本でもブームになりました。
体に巻きつけるブラで、プロンプトの再現性は非常に高いです。

![bandeau bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/bandeau-bikini-1-683x1024.png)
![bandeau bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/bandeau-bikini_3-683x1024.png)
![bandeau bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/bandeau-bikini_2-683x1024.png)

### cross-halter-bikini
- cross-halter-bikini: 首元から、胸にかけて、交差するような形の水着です。
通常のビキニよりも、 少しエレガントな雰囲気 になります。

![cross-halter-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/cross-halter-bikini_1-683x1024.png)
![cross-halter-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/cross-halter-bikini_2-683x1024.png)
![cross-halter-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/cross-halter-bikini_3-683x1024.png)

### micro bikini
- micro bikini: こちらは英語の意味の通りですが、小さめの面積の水着姿が生成されます。
強調度合いを、1.3としていますが、強調率をあげると より小さい面積で水着を生成してくれます 。

![micro bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/micro-bikini_1-683x1024.png)
![micro bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/micro-bikini_2-683x1024.png)
![micro bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/micro-bikini_3-683x1024.png)

### Tank-top-Bikini
- Tank-top-Bikini: 上部の水着をタンクトップのような形で生成してくれます。
セクシーすぎない感じのAI写真集を作る際などには、とても適したプロンプトです。

![Tank-top-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Tank-top-Bikini_1-683x1024.png)
![Tank-top-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Tank-top-Bikini_2-683x1024.png)
![Tank-top-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Tank-top-Bikini_3-683x1024.png)

### High-waist-bikini
- High-waist-bikini: こちらは再現度があまり高く無いのですが、ハイウエストの水着が生成されます。
韓国でブームになった水着のイメージがあるので、韓国系の顔立ちとはフィットすると思います。

![High-waist-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/High-waist-bikini_1-683x1024.png)
![High-waist-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/High-waist-bikini_2-683x1024.png)
![High-waist-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/High-waist-bikini_3-683x1024.png)

### monokini
- monokini: 一枚布でできた水着を表します。
deep greenで指定してるはずなのですが、明るめに生成されました。
また特に指定をしないと、柄が出てくるようなので、無地が良いという方は別途プロンプトで指定する必要がありそうです。

![monokini 1](https://ai-freak.com/wp-content/uploads/2023/12/monokini_1-683x1024.png)
![monokini 2](https://ai-freak.com/wp-content/uploads/2023/12/monokini_2-683x1024.png)
![monokini 3](https://ai-freak.com/wp-content/uploads/2023/12/monokini_3-683x1024.png)

### Short-pants-bikini
- Short-pants-bikini: こちらはショートパンツを指示するプロンプトになります。
水着を着たカットの後に、こういった写真があれば、撮影のストーリー感も見せられて良いプロンプトかと思います。

![Short-pants-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Short-pants-bikini_1-683x1024.png)
![Short-pants-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Short-pants-bikini_2-683x1024.png)
![Short-pants-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Short-pants-bikini_3-683x1024.png)

### Skirt-style-bikini
- Skirt-style-bikini: ショートパンツと同じ要領で、スカートにすることもできます。
こちらもセクシーすぎない感じが、とても使いやすいプロンプトだと個人的に思います。

![Skirt-style-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Skirt-style-bikini_2-683x1024.png)
![Skirt-style-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Skirt-style-bikini_3-683x1024.png)
![Skirt-style-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Skirt-style-bikini_4-683x1024.png)

### one-piece-swimsuit
- one-piece-swimsuit: ワンピース型の水着という指定をしてみました。
スクール水着のような形が生成されやすいのですが、写真右側のようにオリジナル性の高い水着を生成してくれることもあります。
ガチャ要素が少し強いプロンプトです。

![one-piece-swimsuit 1](https://ai-freak.com/wp-content/uploads/2023/12/one-piece-swimsuit_1-683x1024.png)
![one-piece-swimsuit 2](https://ai-freak.com/wp-content/uploads/2023/12/one-piece-swimsuit_2-683x1024.png)
![one-piece-swimsuit 3](https://ai-freak.com/wp-content/uploads/2023/12/one-piece-swimsuit_3-683x1024.png)

### plunging
- plunging: 胸元を深いVネックの形状にしてくれるのが、こちらのプロンプトです。
こちらもランダム性が高いので、ユニークな水着を生成したい方はぜひ活用してみて下さい。

![plunging 1](https://ai-freak.com/wp-content/uploads/2023/12/plunging_1-683x1024.png)
![plunging 2](https://ai-freak.com/wp-content/uploads/2023/12/plunging_2-683x1024.png)
![plunging 3](https://ai-freak.com/wp-content/uploads/2023/12/plunging_3-683x1024.png)

### Sarong-pass
- Sarong-pass: 腰に布を巻いた姿を表すプロンプトです。
バリなどの海外ビーチと一緒に使うと、とても雰囲気が出るプロンプトだと思います。
違う色を指定するなどして、色々と試してみて下さい。

![Sarong-pass 1](https://ai-freak.com/wp-content/uploads/2023/12/Sarong-pass_1-683x1024.png)
![Sarong-pass 2](https://ai-freak.com/wp-content/uploads/2023/12/Sarong-pass_2-683x1024.png)
![Sarong-pass 3](https://ai-freak.com/wp-content/uploads/2023/12/Sarong-pass_3-683x1024.png)

### Rash-guard
- Rash-guard: ラッシュガードを表すプロンプトです。
デフォルトだとロゴが出てくることもあるので、不要な方はフォトショップで加工するか、プロンプトで制御して下さい。

![Rash-guard 1](https://ai-freak.com/wp-content/uploads/2023/12/Rash-guard_1-683x1024.png)
![Rash-guard 2](https://ai-freak.com/wp-content/uploads/2023/12/Rash-guard_2-683x1024.png)
![Rash-guard 3](https://ai-freak.com/wp-content/uploads/2023/12/Rash-guard_3-683x1024.png)

### Wetsuit
- Wetsuit: こちらもウェットスーツと同様ですが、ロゴが出てきてしまいがちです。
サーフィンのプロンプトと一緒に活用すると、さらにウェットスーツを正確に表現してくれるイメージがあります。

![Wetsuit 1](https://ai-freak.com/wp-content/uploads/2023/12/Wetsuit_1-683x1024.png)
![Wetsuit 2](https://ai-freak.com/wp-content/uploads/2023/12/Wetsuit_2-683x1024.png)
![Wetsuit 3](https://ai-freak.com/wp-content/uploads/2023/12/Wetsuit_3-683x1024.png)

## 柄を表現するプロンプト
お次は柄を表すプロンプトです。
先ほどまではdeep greenで色を固定していましたが、今回は色の指定はしていません。

### Polka-dot-bikini
- Polka-dot-bikini: こちらは水玉模様の柄を表すプロンプトです。
デフォルトだと、赤や青系で生成してくれることが多かったです。
なぜか顔にもドットが反映されてしまうことがあったので、ネガティブプロンプトで調整するか、フォトショなどで加工することをお勧めします

![Polka-dot-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Polka-dot-bikini_1-683x1024.png)
![Polka-dot-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Polka-dot-bikini_2-683x1024.png)
![Polka-dot-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Polka-dot-bikini_3-683x1024.png)

### Striped-bikini
- Striped-bikini: こちらはストライプ模様を表現するプロンプトです。
ストライプは定番なので、かなりしっかりと水着に反映されています。
こちらも青系で生成されています。

![Striped-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Striped-bikini_1-683x1024.png)
![Striped-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Striped-bikini_2-683x1024.png)
![Striped-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Striped-bikini_3-683x1024.png)

### Chevron-pattern-bikini
- Chevron-pattern-bikini: こちらはストライプでも、ジグザグにしたような模様が特徴です。
ただのストライプよりも、少し工夫をしたい場合には使いやすいプロンプトです。

![Chevron-pattern-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Chevron-pattern-bikini_1-683x1024.png)
![Chevron-pattern-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Chevron-pattern-bikini_2-683x1024.png)
![Chevron-pattern-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Chevron-pattern-bikini_3-683x1024.png)

### Tropical-pattern-bikini
- Tropical-pattern-bikini: 南国っぽい柄を表現してくれるのが、こちらのプロンプトです。
海外のビーチ系との相性は抜群です。

![Tropical-pattern-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Tropical-pattern-bikini_1-683x1024.png)
![Tropical-pattern-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Tropical-pattern-bikini_2-683x1024.png)
![Tropical-pattern-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Tropical-pattern-bikini_3-683x1024.png)

### Aztec-inspired-bikini
- Aztec-inspired-bikini: 英語の意味は『 先住民のパターンとシンボル』という感じなのですが、それがうまく反映されているように思えます。
ただの無地の色味だったり、定番の柄物以外を生成したいという人には、とてもおすすめです。

![Aztec-inspired-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Aztec-inspired-bikini_1-683x1024.png)
![Aztec-inspired-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Aztec-inspired-bikini_2-683x1024.png)
![Aztec-inspired-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Aztec-inspired-bikini_3-683x1024.png)

### Gingham-print-bikini
- Gingham-print-bikini: こちらは定番のギンガムチェック柄の水着です。
デフォルトだと、少し彩度を薄めに生成してくれるようです。

![Gingham-print-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Gingham-print-bikini_1-683x1024.png)
![Gingham-print-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Gingham-print-bikini_3-683x1024.png)
![Gingham-print-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Gingham-print-bikini_2-683x1024.png)

### Tie-dye-bikini
- Tie-dye-bikini: タイダイ柄を表現するプロンプトです。
タイダイ柄とは、1枚づつ手作業で作ることが基本なので、1枚1枚違うデザインを表現してくれます。

![Tie-dye-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Paisley-print-bikini_1-683x1024.png)
![Tie-dye-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Tie-dye-bikini_2-683x1024.png)
![Tie-dye-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Tie-dye-bikini_1-683x1024.png)

### Geometric-print-bikini
- Geometric-print-bikini: 幾何学模様を表すプロンプトでも生成してみました。
普通のビキニではあまりみないかもしれませんが、このように気になる柄があれば試してみるのも良いと思います。
ユニークな柄を作りたい人は、ぜひ色々試してみて下さい。

![Geometric-print-bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Geometric-print-bikini_1-683x1024.png)
![Geometric-print-bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Geometric-print-bikini_2-683x1024.png)
![Geometric-print-bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Geometric-print-bikini_3-683x1024.png)

## 水着の素材感を表現するプロンプト
お次は水着の素材感について。
色は同じでも、素材を変えるだけでかなり雰囲気が変わります。

### Knit-Bikini
- Knit-Bikini: こちらはニット素材の水着です。
通常の素材よりも、よりカジュアルで、お洒落な印象を与えることができます。
柔らかい色味になるので、全体的にもふんわりした画像が出来上がります。

![Knit-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Knit-Bikini_1-683x1024.png)
![Knit-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Knit-Bikini_2-683x1024.png)
![Knit-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Knit-Bikini_3-683x1024.png)

### Crochet-Bikini
- Crochet-Bikini: 繊細なレース編みのデザインです。
先ほどご紹介したニットよりも、さらに精巧な水着のような印象があります。
シンプルにしたい時はニット、よりゴージャスにしたい時にはこちらのプロンプト、というような使い分けもおすすめです。

![Crochet-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Crochet-Bikini_1-683x1024.png)
![Crochet-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Crochet-Bikini_4-683x1024.png)
![Crochet-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Crochet-Bikini_3-683x1024.png)

### Leather-Bikini
- Leather-Bikini: レザー素材のニットです。
デフォルトだと、黒色で生成されるようです。
少しワイルドな印象になるので、少女系の顔よりは、大人っぽい顔立ちに適した水着かと思います。

![Leather-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Leather-Bikini_1-683x1024.png)
![Leather-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Leather-Bikini_2-683x1024.png)
![Leather-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Leather-Bikini_3-683x1024.png)

### Satin-Bikini
- Satin-Bikini: サテン素材のビキニです。
光沢感を表園したい時にはピッタリのプロンプトになります。

![Satin-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Satin-Bikini_1-683x1024.png)
![Satin-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Satin-Bikini_2-683x1024.png)
![Satin-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Satin-Bikini_3-683x1024.png)

### Velvet-Bikini
- Velvet-Bikini: 豪華なベルベット素材を使った水着です。
エレガントな雰囲気を出したい時におすすめ。

![Velvet-Bikini 1](https://ai-freak.com/wp-content/uploads/2023/12/Velvet-Bikini_1-683x1024.png)
![Velvet-Bikini 2](https://ai-freak.com/wp-content/uploads/2023/12/Velvet-Bikini_2-683x1024.png)
![Velvet-Bikini 3](https://ai-freak.com/wp-content/uploads/2023/12/Velvet-Bikini_3-683x1024.png)

## 水着のプロンプトまとめ
今回は水着の種類や柄についてのプロンプトをご紹介しました。
冒頭でもお伝えしましたが、それぞれを組み合わせるなどして、理想の画像を生成してみて下さい。
尚、本記事は新しいプロンプトを発見したらどんどん追加していく予定ですので、また復習がてら覗いてみて下さい。
',
  NULL,
  'https://ai-freak.com/wp-content/uploads/2023/12/swim.jpg',
  'image/jpeg',
  'owner',
  0,
  0
);
