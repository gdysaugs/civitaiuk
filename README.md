# Civitai UK

Token Invaders for `civitai.uk`.

## Commands

```sh
npm install
npm run build
npm run functions:build
npm run deploy
```

## Runtime

Cloudflare Pages project: `civitaiuk`

Required production secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The app uses the shared `user_tickets` and `ticket_events` tables. One play costs one token.

Stripe webhook URL:

```txt
https://civitai.uk/api/stripe/webhook
```

Webhook event:

```txt
checkout.session.completed
```
