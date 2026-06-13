import { getAdminClient, grantPurchasedTickets, type Env } from '../../_shared/supabase'

type StripeCheckoutSession = {
  id?: string
  payment_status?: string
  amount_total?: number
  currency?: string
  customer_email?: string
  metadata?: Record<string, string | undefined>
}

type StripeEvent = {
  id?: string
  type?: string
  data?: {
    object?: unknown
  }
}

const encoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}

const hmacSha256 = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

const verifyStripeSignature = async (rawBody: string, signatureHeader: string, secret: string) => {
  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!timestamp || signatures.length === 0) return false

  const timestampMs = Number(timestamp) * 1000
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false

  const expected = await hmacSha256(secret, `${timestamp}.${rawBody}`)
  return signatures.some((signature) => constantTimeEqual(signature, expected))
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const asCheckoutSession = (value: unknown): StripeCheckoutSession | null => {
  if (!isObject(value)) return null
  return value as StripeCheckoutSession
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Webhook secret is not configured.' }, 500)
  }

  const rawBody = await request.text()
  const signature = request.headers.get('Stripe-Signature') || ''
  const verified = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  if (!verified) {
    return json({ error: 'Invalid signature.' }, 400)
  }

  const event = JSON.parse(rawBody) as StripeEvent
  if (event.type !== 'checkout.session.completed') {
    return json({ received: true })
  }

  const session = asCheckoutSession(event.data?.object)
  if (!session?.id) {
    return json({ error: 'Invalid checkout session.' }, 400)
  }

  if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return json({ received: true, skipped: 'payment_not_paid' })
  }

  const metadata = session.metadata ?? {}
  const userId = metadata.user_id ?? ''
  const email = metadata.email ?? session.customer_email ?? ''
  const tokens = Number(metadata.tokens ?? 0)

  const admin = getAdminClient(env)
  if (!admin) {
    return json({ error: 'Supabase is not configured.' }, 500)
  }

  const grant = await grantPurchasedTickets(admin, {
    usageId: `stripe_checkout:${session.id}`,
    userId,
    email,
    amount: tokens,
    metadata: {
      site: 'civitai.uk',
      stripe_event_id: event.id ?? null,
      stripe_checkout_session_id: session.id,
      package_id: metadata.package_id ?? null,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
    },
  })

  if (grant.error || !grant.data) {
    console.error('[stripe-webhook] grant failed', grant.error)
    return json({ error: 'Grant failed.' }, 500)
  }

  return json({
    received: true,
    tickets: grant.data.tickets,
    alreadyProcessed: grant.data.alreadyProcessed,
  })
}
