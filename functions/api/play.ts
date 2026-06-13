import { jsonResponse, optionsResponse, requireGoogleUser, spendTicket, type Env } from '../_shared/supabase'

const PLAY_COST = 1

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => optionsResponse(request)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireGoogleUser(request, env)
  if ('response' in auth) return auth.response

  const result = await spendTicket(auth.admin, auth.user, PLAY_COST)
  if (result.error || !result.data) {
    console.error('[play] failed', result.error)
    return jsonResponse(request, { error: 'プレイ開始に失敗しました。' }, 500)
  }

  if (!result.data.ok) {
    return jsonResponse(
      request,
      {
        error: 'トークンが不足しています。',
        tickets: result.data.tickets,
        cost: PLAY_COST,
      },
      402,
    )
  }

  return jsonResponse(request, {
    playId: result.data.usageId,
    tickets: result.data.tickets,
    cost: PLAY_COST,
  })
}
