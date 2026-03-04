import { json, parseLimit } from "../../_utils";

type Env = {
  DB: D1Database;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId) || threadId <= 0) return json({ error: "Invalid thread id." }, 400);

  const includeNsfw = new URL(request.url).searchParams.get("nsfw") === "include" ? 1 : 0;
  const limit = parseLimit(new URL(request.url).searchParams.get("postLimit"), 200, 1, 500);

  const thread = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1 AND (?2 = 1 OR nsfw = 0)`
  )
    .bind(threadId, includeNsfw)
    .first();

  if (!thread) return json({ error: "Thread not found." }, 404);

  const { results: posts } = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl,
            seed, sampler, steps, cfg_scale AS cfgScale,
            width, height, author_name AS authorName, nsfw,
            created_at AS createdAt
     FROM posts
     WHERE thread_id = ?1
     ORDER BY datetime(created_at) ASC
     LIMIT ?2`
  )
    .bind(threadId, limit)
    .all();

  return json({ thread, posts, postLimit: limit, includeNsfw: includeNsfw === 1 });
};