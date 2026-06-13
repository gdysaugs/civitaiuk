import { ensureTicketRow, jsonResponse, optionsResponse, requireGoogleUser, type Env } from '../_shared/supabase'

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => optionsResponse(request)

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireGoogleUser(request, env)
  if ('response' in auth) return auth.response

  const row = await ensureTicketRow(auth.admin, auth.user)
  if (row.error || !row.data) {
    console.error('[tickets] failed', row.error)
    return jsonResponse(request, { error: 'トークン情報の取得に失敗しました。' }, 500)
  }

  return jsonResponse(request, {
    email: auth.user.email ?? '',
    tickets: Number(row.data.tickets ?? 0),
  })
}
