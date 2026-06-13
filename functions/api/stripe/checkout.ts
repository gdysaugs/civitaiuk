import { jsonResponse, optionsResponse, requireGoogleUser, type Env } from '../../_shared/supabase'

const PACKAGES = {
  starter: {
    id: 'starter',
    name: '30トークン',
    tokens: 30,
    priceId: 'price_1Thp2qPPWL4VKmsegxuHcCrm',
  },
  standard: {
    id: 'standard',
    name: '110トークン',
    tokens: 110,
    priceId: 'price_1Thp39PPWL4VKmsecnlqXsOz',
  },
  premium: {
    id: 'premium',
    name: '280トークン',
    tokens: 280,
    priceId: 'price_1Thp3PPPWL4VKmseiOl26yT4',
  },
} as const

type PackageId = keyof typeof PACKAGES

const getPackage = (packageId: unknown) => {
  if (typeof packageId !== 'string') return null
  return PACKAGES[packageId as PackageId] ?? null
}

const parseJson = async (request: Request) => {
  const value = await request.json().catch(() => ({}))
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => optionsResponse(request)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireGoogleUser(request, env)
  if ('response' in auth) return auth.response

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, { error: 'Stripe設定が未完了です。' }, 500)
  }

  const body = await parseJson(request)
  const selected = getPackage(body.packageId)
  if (!selected) {
    return jsonResponse(request, { error: '購入プランを選択してください。' }, 400)
  }

  const origin = new URL(request.url).origin
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('success_url', `${origin}/purchage?checkout=success&session_id={CHECKOUT_SESSION_ID}`)
  params.set('cancel_url', `${origin}/purchage?checkout=cancel`)
  params.set('client_reference_id', auth.user.id)
  params.set('customer_email', auth.user.email ?? '')
  params.set('allow_promotion_codes', 'true')
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price]', selected.priceId)
  params.set('metadata[site]', 'civitai.uk')
  params.set('metadata[package_id]', selected.id)
  params.set('metadata[price_id]', selected.priceId)
  params.set('metadata[user_id]', auth.user.id)
  params.set('metadata[email]', auth.user.email ?? '')
  params.set('metadata[tokens]', String(selected.tokens))
  params.set('payment_intent_data[metadata][site]', 'civitai.uk')
  params.set('payment_intent_data[metadata][package_id]', selected.id)
  params.set('payment_intent_data[metadata][price_id]', selected.priceId)
  params.set('payment_intent_data[metadata][user_id]', auth.user.id)
  params.set('payment_intent_data[metadata][email]', auth.user.email ?? '')
  params.set('payment_intent_data[metadata][tokens]', String(selected.tokens))

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const stripeData = (await stripeResponse.json().catch(() => ({}))) as Record<string, unknown>
  if (!stripeResponse.ok || typeof stripeData.url !== 'string') {
    console.error('[stripe-checkout] failed', {
      status: stripeResponse.status,
      error: stripeData.error,
    })
    return jsonResponse(request, { error: '購入ページの作成に失敗しました。' }, 500)
  }

  return jsonResponse(request, { url: stripeData.url })
}
