import {
  cleanLongText,
  cleanText,
  json,
  parseBool,
  parseLimit,
  parseOptionalFloat,
  parseOptionalInt,
  readJson,
  validateMediaType
} from "../../_utils";

type Env = {
  DB: D1Database;
};

type CreateThreadPayload = {
  title?: string;
  body?: string;
  authorName?: string;
  modelName?: string;
  mediaType?: "image" | "video" | "mixed";
  nsfw?: boolean;
  mediaUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  workflowJson?: string;
  seed?: number;
  sampler?: string;
  steps?: number;
  cfgScale?: number;
  width?: number;
  height?: number;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const includeNsfw = url.searchParams.get("nsfw") === "include" ? 1 : 0;

  const query = `
    SELECT
      t.id,
      t.title,
      t.author_name AS authorName,
      t.model_name AS modelName,
      t.media_type AS mediaType,
      t.nsfw,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt,
      COUNT(p.id) AS postCount
    FROM threads t
    LEFT JOIN posts p ON p.thread_id = t.id
    WHERE (?1 = 1 OR t.nsfw = 0)
    GROUP BY t.id
    ORDER BY datetime(t.updated_at) DESC
    LIMIT ?2
  `;

  const { results } = await env.DB.prepare(query).bind(includeNsfw, limit).all();
  return json({ threads: results, limit, includeNsfw: includeNsfw === 1 });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreateThreadPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const title = cleanText(payload.title, 120);
  const body = cleanLongText(payload.body, 5000);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const modelName = cleanText(payload.modelName, 80);
  const mediaType = validateMediaType(payload.mediaType);
  const nsfw = parseBool(payload.nsfw);

  const mediaUrl = cleanText(payload.mediaUrl, 2000);
  const thumbnailUrl = cleanText(payload.thumbnailUrl, 2000);
  const prompt = cleanLongText(payload.prompt, 4000);
  const workflowJson = cleanLongText(payload.workflowJson, 20000);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);

  if (!title || title.length < 3) return json({ error: "Title must be at least 3 chars." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);

  const threadResult = await env.DB.prepare(
    `INSERT INTO threads (title, author_name, model_name, media_type, nsfw)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(title, authorName, modelName, mediaType, nsfw)
    .run();

  const threadId = Number(threadResult.meta.last_row_id);

  await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  )
    .bind(
      threadId,
      body,
      prompt,
      workflowJson,
      mediaUrl,
      thumbnailUrl,
      seed,
      sampler,
      steps,
      cfgScale,
      width,
      height,
      authorName,
      nsfw
    )
    .run();

  const created = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1`
  )
    .bind(threadId)
    .first();

  return json({ thread: created }, 201);
};