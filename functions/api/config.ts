import { jsonResponse, optionsResponse, type Env } from '../_shared/supabase'

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => optionsResponse(request)

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse(request, { error: '設定が未完了です。' }, 500)
  }

  return jsonResponse(request, {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    siteOrigin: 'https://civitai.uk',
  })
}
