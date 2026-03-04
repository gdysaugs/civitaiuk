# civitai.uk board (Cloudflare Pages MVP)

This is a starter project for an AI image/video board deployed on Cloudflare Pages.

## Stack

- Cloudflare Pages (static frontend + Functions)
- Cloudflare D1 (threads/posts metadata)
- Optional Cloudflare R2 for media files (store URL in posts.media_url)

## Directory

- `public/` : frontend
- `functions/` : Pages Functions API
- `migrations/` : D1 schema

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create D1 database:

```bash
npx wrangler d1 create civitaiuk
```

3. Put returned `database_id` into `wrangler.toml`.

4. Apply migrations locally:

```bash
npm run db:migrate:local
```

5. Run local dev server:

```bash
npm run dev
```

## Cloudflare Pages deploy

1. Push this directory to `https://github.com/gdysaugs/civitaiuk`.
2. In Cloudflare dashboard, create a Pages project from that repo.
3. Build command: none
4. Build output directory: `public`
5. Add D1 binding:
   - Variable name: `DB`
   - Database: `civitaiuk`
6. Run remote migration:

```bash
npm run db:migrate:remote
```

## API

- `GET /api/threads`
- `POST /api/threads`
- `GET /api/threads/:id`
- `POST /api/posts`
- `GET /api/health`

## Important next steps

- Add Turnstile verification for posting
- Add report + moderation workflow
- Add R2 direct upload + signed URL
- Add legal policy pages and abuse handling flow