import {
  cleanLongText,
  cleanText,
  json,
  parseBool,
  parseOptionalFloat,
  parseOptionalInt,
  readJson
} from "../../_utils";

type Env = {
  DB: D1Database;
};

type CreatePostPayload = {
  threadId?: number;
  body?: string;
  authorName?: string;
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

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreatePostPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const threadId = parseOptionalInt(payload.threadId);
  const body = cleanLongText(payload.body, 5000);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
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

  if (!threadId || threadId <= 0) return json({ error: "Valid threadId is required." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);

  const thread = await env.DB.prepare(`SELECT id FROM threads WHERE id = ?1`).bind(threadId).first();
  if (!thread) return json({ error: "Thread not found." }, 404);

  const result = await env.DB.prepare(
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

  const postId = Number(result.meta.last_row_id);
  const created = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl, seed, sampler,
            steps, cfg_scale AS cfgScale, width, height, author_name AS authorName,
            nsfw, created_at AS createdAt
     FROM posts
     WHERE id = ?1`
  )
    .bind(postId)
    .first();

  return json({ post: created }, 201);
};