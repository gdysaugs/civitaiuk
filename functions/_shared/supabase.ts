import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type Env = {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

type TicketRow = {
  id: string
  user_id: string | null
  email: string | null
  tickets: number | null
  created_at: string | null
}

type AuthSuccess = {
  admin: SupabaseClient
  user: User
}

type AuthFailure = {
  response: Response
}

const SIGNUP_TICKET_GRANT = 3
const AUTH_REQUIRED = 'ログインが必要です。'
const AUTH_FAILED = '認証に失敗しました。'
const GOOGLE_ONLY = 'Googleログインのみ対応しています。'
const SERVER_NOT_READY = 'サーバー設定が未完了です。'

const allowedOrigins = [
  'https://civitai.uk',
  'https://www.civitai.uk',
  'https://civitaiuk.pages.dev',
]

export const jsonResponse = (request: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      ...extraHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

export const corsHeaders = (request: Request) => {
  const origin = request.headers.get('Origin') || ''
  const allowOrigin =
    allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.civitaiuk\.pages\.dev$/i.test(origin)
      ? origin
      : ''

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin
    headers.Vary = 'Origin'
  }
  return headers
}

export const optionsResponse = (request: Request) => new Response(null, { headers: corsHeaders(request) })

export const getAdminClient = (env: Env) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const extractBearerToken = (request: Request) => {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/Bearer\s+(.+)/i)
  return match ? match[1] : ''
}

const isGoogleUser = (user: User) => {
  if (user.app_metadata?.provider === 'google') return true
  if (Array.isArray(user.identities)) {
    return user.identities.some((identity) => identity.provider === 'google')
  }
  return false
}

export const requireGoogleUser = async (request: Request, env: Env): Promise<AuthSuccess | AuthFailure> => {
  const token = extractBearerToken(request)
  if (!token) {
    return { response: jsonResponse(request, { error: AUTH_REQUIRED }, 401) }
  }

  const admin = getAdminClient(env)
  if (!admin) {
    return { response: jsonResponse(request, { error: SERVER_NOT_READY }, 500) }
  }

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    return { response: jsonResponse(request, { error: AUTH_FAILED }, 401) }
  }
  if (!isGoogleUser(data.user)) {
    return { response: jsonResponse(request, { error: GOOGLE_ONLY }, 403) }
  }

  return { admin, user: data.user }
}

const isUniqueViolation = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === '23505')

const fetchTicketRowByUser = async (admin: SupabaseClient, userId: string, email: string) => {
  const byUser = await admin
    .from('user_tickets')
    .select('id, user_id, email, tickets, created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (byUser.error) return { data: null as TicketRow | null, error: byUser.error }
  if (byUser.data) return { data: byUser.data as TicketRow, error: null }
  if (!email) return { data: null as TicketRow | null, error: null }

  const byEmail = await admin
    .from('user_tickets')
    .select('id, user_id, email, tickets, created_at')
    .ilike('email', email)
    .maybeSingle()

  if (byEmail.error) return { data: null as TicketRow | null, error: byEmail.error }
  return { data: (byEmail.data as TicketRow | null) ?? null, error: null }
}

export const ensureTicketRowByUser = async (admin: SupabaseClient, userId: string, email: string) => {
  const existing = await fetchTicketRowByUser(admin, userId, email)
  if (existing.error) return existing
  if (existing.data) {
    if (existing.data.user_id !== userId) {
      const relink = await admin
        .from('user_tickets')
        .update({ user_id: userId, email })
        .eq('id', existing.data.id)
        .select('id, user_id, email, tickets, created_at')
        .maybeSingle()
      if (relink.error) return { data: existing.data, error: null }
      if (relink.data) return { data: relink.data as TicketRow, error: null }
    }
    return existing
  }

  const inserted = await admin
    .from('user_tickets')
    .insert({ user_id: userId, email, tickets: 0 })
    .select('id, user_id, email, tickets, created_at')
    .maybeSingle()

  if (inserted.error || !inserted.data) {
    const retry = await fetchTicketRowByUser(admin, userId, email)
    if (retry.data || isUniqueViolation(inserted.error)) return retry
    return { data: null as TicketRow | null, error: inserted.error ?? new Error('TICKET_ROW_CREATE_FAILED') }
  }

  return { data: inserted.data as TicketRow, error: null }
}

export const fetchTicketRow = async (admin: SupabaseClient, user: User) => {
  const byUser = await admin
    .from('user_tickets')
    .select('id, user_id, email, tickets, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (byUser.error) return { data: null as TicketRow | null, error: byUser.error }
  if (byUser.data) return { data: byUser.data as TicketRow, error: null }

  const email = user.email ?? ''
  if (!email) return { data: null as TicketRow | null, error: null }

  const byEmail = await admin
    .from('user_tickets')
    .select('id, user_id, email, tickets, created_at')
    .ilike('email', email)
    .maybeSingle()

  if (byEmail.error) return { data: null as TicketRow | null, error: byEmail.error }
  return { data: (byEmail.data as TicketRow | null) ?? null, error: null }
}

export const ensureTicketRow = async (admin: SupabaseClient, user: User) => {
  const email = user.email ?? ''
  if (!email) return { data: null as TicketRow | null, error: new Error('EMAIL_MISSING') }

  const existing = await fetchTicketRow(admin, user)
  if (existing.error) return existing
  if (existing.data) {
    if (existing.data.user_id !== user.id) {
      const relink = await admin
        .from('user_tickets')
        .update({ user_id: user.id, email })
        .eq('id', existing.data.id)
        .select('id, user_id, email, tickets, created_at')
        .maybeSingle()
      if (relink.error) return { data: existing.data, error: null }
      if (relink.data) return { data: relink.data as TicketRow, error: null }
    }
    return existing
  }

  const inserted = await admin
    .from('user_tickets')
    .insert({ email, user_id: user.id, tickets: SIGNUP_TICKET_GRANT })
    .select('id, user_id, email, tickets, created_at')
    .maybeSingle()

  if (inserted.error || !inserted.data) {
    const retry = await fetchTicketRow(admin, user)
    if (retry.data || isUniqueViolation(inserted.error)) return retry
    return { data: null as TicketRow | null, error: inserted.error ?? new Error('TICKET_ROW_CREATE_FAILED') }
  }

  await admin.from('ticket_events').insert({
    usage_id: `signup_bonus:${user.id}`,
    user_id: user.id,
    email,
    delta: SIGNUP_TICKET_GRANT,
    reason: 'signup_bonus',
    metadata: { source: 'civitai.uk' },
  })

  return { data: inserted.data as TicketRow, error: null }
}

export const spendTicket = async (admin: SupabaseClient, user: User, amount: number) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rowResult = await ensureTicketRow(admin, user)
    if (rowResult.error || !rowResult.data) return { data: null, error: rowResult.error ?? new Error('TICKET_ROW_MISSING') }

    const row = rowResult.data
    const currentTickets = Number(row.tickets ?? 0)
    if (!Number.isFinite(currentTickets) || currentTickets < amount) {
      return { data: { ok: false as const, tickets: Math.max(0, currentTickets || 0), usageId: '' }, error: null }
    }

    const usageId = `civitaiuk_play:${user.id}:${crypto.randomUUID()}`
    const eventInsert = await admin.from('ticket_events').insert({
      usage_id: usageId,
      user_id: user.id,
      email: user.email ?? '',
      delta: -amount,
      reason: 'civitaiuk_play',
      metadata: { site: 'civitai.uk', game: 'invaders' },
    })
    if (eventInsert.error) return { data: null, error: eventInsert.error }

    const update = await admin
      .from('user_tickets')
      .update({ tickets: currentTickets - amount, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('tickets', currentTickets)
      .select('tickets')
      .maybeSingle()

    if (update.error) {
      await admin.from('ticket_events').delete().eq('usage_id', usageId)
      return { data: null, error: update.error }
    }

    if (update.data) {
      return {
        data: { ok: true as const, tickets: Number(update.data.tickets), usageId },
        error: null,
      }
    }

    await admin.from('ticket_events').delete().eq('usage_id', usageId)
  }

  return { data: null, error: new Error('TICKET_UPDATE_CONFLICT') }
}

export const grantPurchasedTickets = async (
  admin: SupabaseClient,
  input: {
    usageId: string
    userId: string
    email: string
    amount: number
    metadata: Record<string, unknown>
  },
) => {
  if (!input.userId || !input.email || !Number.isInteger(input.amount) || input.amount <= 0) {
    return { data: null as { tickets: number; alreadyProcessed: boolean } | null, error: new Error('INVALID_PURCHASE_GRANT') }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rowResult = await ensureTicketRowByUser(admin, input.userId, input.email)
    if (rowResult.error || !rowResult.data) {
      return { data: null as { tickets: number; alreadyProcessed: boolean } | null, error: rowResult.error ?? new Error('TICKET_ROW_MISSING') }
    }

    const row = rowResult.data
    const eventInsert = await admin.from('ticket_events').insert({
      usage_id: input.usageId,
      user_id: input.userId,
      email: input.email,
      delta: input.amount,
      reason: 'stripe_purchase',
      metadata: input.metadata,
    })

    if (eventInsert.error) {
      if (isUniqueViolation(eventInsert.error)) {
        return { data: { tickets: Number(row.tickets ?? 0), alreadyProcessed: true }, error: null }
      }
      return { data: null as { tickets: number; alreadyProcessed: boolean } | null, error: eventInsert.error }
    }

    const currentTickets = Number(row.tickets ?? 0)
    const update = await admin
      .from('user_tickets')
      .update({ tickets: currentTickets + input.amount, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('tickets', currentTickets)
      .select('tickets')
      .maybeSingle()

    if (update.error) {
      await admin.from('ticket_events').delete().eq('usage_id', input.usageId)
      return { data: null as { tickets: number; alreadyProcessed: boolean } | null, error: update.error }
    }

    if (update.data) {
      return { data: { tickets: Number(update.data.tickets), alreadyProcessed: false }, error: null }
    }

    await admin.from('ticket_events').delete().eq('usage_id', input.usageId)
  }

  return { data: null as { tickets: number; alreadyProcessed: boolean } | null, error: new Error('TICKET_UPDATE_CONFLICT') }
}
