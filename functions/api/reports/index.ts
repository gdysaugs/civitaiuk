import { requireAdmin, verifyTurnstileWhen } from "../../_security";
import {
  buildPosterId,
  cleanLongText,
  cleanText,
  json,
  parseLimit,
  parseOptionalInt,
  readJson
} from "../../_utils";

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
const GLOBAL_REPORT_WINDOW_MINUTES = 10;
const GLOBAL_REPORT_LIMIT = 20;

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
       r.reporter_id AS reporterId,
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

  // Keep report Turnstile optional so TURNSTILE_REQUIRED=1 does not break reporting UI.
  const turnstile = await verifyTurnstileWhen(request, env, payload.turnstileToken, false);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);

  const reporterId = await buildPosterId(request);
  const globalRate = await env.DB.prepare(
    `SELECT COUNT(*) AS recentCount
     FROM reports
     WHERE reporter_id = ?1
       AND datetime(created_at) >= datetime('now', ?2)`
  )
    .bind(reporterId, `-${GLOBAL_REPORT_WINDOW_MINUTES} minutes`)
    .first<{ recentCount: number }>();
  const recentReportCount = Number(globalRate?.recentCount || 0);
  if (recentReportCount >= GLOBAL_REPORT_LIMIT) {
    return json(
      { error: `通報が多すぎます。${GLOBAL_REPORT_WINDOW_MINUTES}分ほど待ってから再度お試しください。` },
      429
    );
  }

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

    const latestReport = await env.DB.prepare(
      `SELECT id
       FROM reports
       WHERE post_id = ?1
         AND reporter_id = ?2
         AND datetime(created_at) > datetime('now', '-2 minutes')
       ORDER BY datetime(created_at) DESC
       LIMIT 1`
    )
      .bind(resolvedPostId, reporterId)
      .first();
    if (latestReport) {
      return json({ error: "この投稿は2分に1回まで通報できます。" }, 429);
    }

    const alreadyReported = await env.DB.prepare(
      `SELECT id
       FROM reports
       WHERE post_id = ?1
         AND reporter_id = ?2
         AND datetime(created_at) >= datetime('now', '-1 day')
       LIMIT 1`
    )
      .bind(resolvedPostId, reporterId)
      .first();
    if (alreadyReported) {
      return json({ error: "この投稿はすでに通報済みです。" }, 409);
    }
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

  if (!resolvedPostId && resolvedThreadId) {
    const latestThreadReport = await env.DB.prepare(
      `SELECT id
       FROM reports
       WHERE thread_id = ?1
         AND post_id IS NULL
         AND reporter_id = ?2
         AND datetime(created_at) > datetime('now', '-2 minutes')
       ORDER BY datetime(created_at) DESC
       LIMIT 1`
    )
      .bind(resolvedThreadId, reporterId)
      .first();
    if (latestThreadReport) {
      return json({ error: "このスレッドは2分に1回まで通報できます。" }, 429);
    }

    const alreadyReportedThread = await env.DB.prepare(
      `SELECT id
       FROM reports
       WHERE thread_id = ?1
         AND post_id IS NULL
         AND reporter_id = ?2
         AND datetime(created_at) >= datetime('now', '-1 day')
       LIMIT 1`
    )
      .bind(resolvedThreadId, reporterId)
      .first();
    if (alreadyReportedThread) {
      return json({ error: "このスレッドはすでに通報済みです。" }, 409);
    }
  }

  const created = await env.DB.prepare(
    `INSERT INTO reports (thread_id, post_id, reporter_id, reason, details)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(resolvedThreadId, resolvedPostId, reporterId, reason, details)
    .run();

  let uniqueReporterCount = 0;
  let autoDeleted = false;

  if (resolvedPostId) {
    const countRow = await env.DB.prepare(
      `SELECT COUNT(DISTINCT reporter_id) AS uniqueReporterCount
       FROM reports
       WHERE post_id = ?1
         AND reporter_id IS NOT NULL
         AND datetime(created_at) >= datetime('now', '-1 day')`
    )
      .bind(resolvedPostId)
      .first<{ uniqueReporterCount: number }>();

    uniqueReporterCount = Number(countRow?.uniqueReporterCount || 0);

    if (uniqueReporterCount >= 10) {
      const updated = await env.DB.prepare(
        `UPDATE posts
         SET is_deleted = 1
         WHERE id = ?1
           AND is_deleted = 0`
      )
        .bind(resolvedPostId)
        .run();
      autoDeleted = Number(updated.meta.changes || 0) > 0;
    }
  }

  return json(
    {
      report: {
        id: Number(created.meta.last_row_id),
        threadId: resolvedThreadId,
        postId: resolvedPostId,
        reporterId,
        reason,
        status: "open"
      },
      moderation: {
        uniqueReporterCount,
        autoDeleted
      }
    },
    201
  );
};
