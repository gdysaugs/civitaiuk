import { json } from "../_utils";

type Env = {
  DB: D1Database;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    return json({ ok: true, db: result?.ok === 1 });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};