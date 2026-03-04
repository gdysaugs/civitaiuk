# civitai.uk board

Cloudflare Pages + Functions + D1 + (optional) R2 で動く、AI画像/動画特化掲示板です。

## 実装済み機能

- 更新順スレ一覧 / スレ詳細 / レス投稿
- NSFW表示トグル
- 通報API（理由付き）+ 管理者向け通報一覧/解決API
- Turnstile検証（投稿・返信・通報）
- R2メディアアップロードAPI（任意）
- Terms / Privacy / Guidelines ページ

## ディレクトリ

- `public/` フロントエンド
- `functions/` Pages Functions API
- `migrations/` D1マイグレーション

## ローカル開発

```bash
npm install
npm run db:migrate:local
npm run dev
```

## Cloudflare セットアップ

1. D1を作成（作成済みなら不要）

```bash
npx wrangler d1 create civitaiuk
```

2. `wrangler.toml` の `database_id` を更新

3. リモートマイグレーション

```bash
npm run db:migrate:remote
```

4. Pagesにデプロイ

```bash
npx wrangler pages deploy public --project-name civitaiuk --branch main
```

## Pages 側の設定

Pagesプロジェクト `civitaiuk` に以下を設定してください。

1. D1 Binding
- Name: `DB`
- Database: `civitaiuk`

2. Variables
- `APP_NAME` (例: `civitai.uk`)
- `TURNSTILE_REQUIRED` (`1` 推奨 / 開発中は `0` 可)
- `MAX_UPLOAD_BYTES` (例: `26214400`)
- `TURNSTILE_SITE_KEY` (公開キー)

3. Secrets
- `TURNSTILE_SECRET`
- `ADMIN_TOKEN` (モデレーションAPI用)

4. Optional: R2 Binding
- Name: `MEDIA`
- Bucket: 任意（例: `civitaiuk-media`）

5. Optional: Variable
- `R2_PUBLIC_BASE_URL`（公開配信ドメインを使う場合）

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/threads`
- `POST /api/threads`
- `GET /api/threads/:id`
- `POST /api/posts`
- `POST /api/media/upload`
- `GET /api/media/object?key=...`
- `POST /api/reports`
- `GET /api/reports` (admin)
- `POST /api/mod/reports/:id/resolve` (admin)

## 管理API認証

`x-admin-token: <ADMIN_TOKEN>` か `Authorization: Bearer <ADMIN_TOKEN>` を付与してください。

管理画面は `/admin` です。`ADMIN_TOKEN` を入力して通報一覧・解決操作を実行できます。

## 本番前チェック

1. Turnstileを有効化 (`TURNSTILE_REQUIRED=1`)
2. `ADMIN_TOKEN` を強固なランダム値に設定
3. 禁止コンテンツポリシー（未成年/非同意/違法）を明記
4. 通報対応フロー（SLA、対応優先度）を運用に落とし込む
