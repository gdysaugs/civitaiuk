import { requireAdmin, verifyTurnstile } from "../../_security";
import { cleanLongText, cleanText, json, parseLimit, parseOptionalInt, readJson } from "../../_utils";

type Env = {
  DB: D1Database;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
  ADMIN_TOKEN?: string;
};

type CreateReportPayload = {
  threadId?: number;
  postId?: number;
  reason?: string;
  details?: string;
  turnstileToken?: string;
};

const REPORT_REASONS = new Set([
  "illegal",
  "copyright",
  "non-consensual",
  "minor-suspected",
  "harassment",
  "spam",
  "other"
]);

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const status = cleanText(url.searchParams.get("status"), 20) ?? "open";
  const limit = parseLimit(url.searchParams.get("limit"), 100, 1, 500);

  const { results } = await env.DB.prepare(
    `SELECT
       r.id,
       r.thread_id AS threadId,
       r.post_id AS postId,
       r.reason,
       r.details,
       r.status,
       r.resolution_action AS resolutionAction,
       r.resolution_note AS resolutionNote,
       r.resolved_by AS resolvedBy,
       r.resolved_at AS resolvedAt,
       r.created_at AS createdAt,
       t.title AS threadTitle
     FROM reports r
     LEFT JOIN threads t ON t.id = r.thread_id
     WHERE (?1 = 'all' OR r.status = ?1)
     ORDER BY datetime(r.created_at) DESC
     LIMIT ?2`
  )
    .bind(status, limit)
    .all();

  return json({ reports: results, status, limit });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const payload = await readJson<CreateReportPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const threadId = parseOptionalInt(payload.threadId);
  const postId = parseOptionalInt(payload.postId);
  const reason = cleanText(payload.reason, 40);
  const details = cleanLongText(payload.details, 2000);

  if (!threadId && !postId) return json({ error: "threadId or postId is required." }, 400);
  if (!reason || !REPORT_REASONS.has(reason)) return json({ error: "Invalid reason." }, 400);

  const turnstile = await verifyTurnstile(request, env, payload.turnstileToken);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);

  let resolvedThreadId = threadId ?? null;
  let resolvedPostId = postId ?? null;

  if (resolvedPostId) {
    const post = await env.DB.prepare(
      `SELECT id, thread_id AS threadId
       FROM posts
       WHERE id = ?1 AND is_deleted = 0`
    )
      .bind(resolvedPostId)
      .first<{ id: number; threadId: number }>();
    if (!post) return json({ error: "Post not found." }, 404);
    resolvedThreadId = resolvedThreadId ?? post.threadId;
  }

  if (resolvedThreadId) {
    const thread = await env.DB.prepare(
      `SELECT id
       FROM threads
       WHERE id = ?1 AND is_deleted = 0`
    )
      .bind(resolvedThreadId)
      .first();
    if (!thread) return json({ error: "Thread not found." }, 404);
  }

  const created = await env.DB.prepare(
    `INSERT INTO reports (thread_id, post_id, reason, details)
     VALUES (?1, ?2, ?3, ?4)`
  )
    .bind(resolvedThreadId, resolvedPostId, reason, details)
    .run();

  return json(
    {
      report: {
        id: Number(created.meta.last_row_id),
        threadId: resolvedThreadId,
        postId: resolvedPostId,
        reason,
        status: "open"
      }
    },
    201
  );
};
