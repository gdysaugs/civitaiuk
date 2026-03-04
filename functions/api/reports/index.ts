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
const AUTO_DELETE_THRESHOLD = 10;
const POSTER_STAGE1_THRESHOLD = 30;
const POSTER_STAGE2_THRESHOLD = 50;

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
  let targetPosterId: string | null = null;

  if (resolvedPostId) {
    const post = await env.DB.prepare(
      `SELECT id, thread_id AS threadId, poster_id AS posterId
       FROM posts
       WHERE id = ?1 AND is_deleted = 0`
    )
      .bind(resolvedPostId)
      .first<{ id: number; threadId: number; posterId: string | null }>();
    if (!post) return json({ error: "Post not found." }, 404);
    targetPosterId = post.posterId ?? null;

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
  let targetPosterUniqueReporterCount = 0;
  let posterSanctionStage = 0;
  let posterWriteBlockedUntil: string | null = null;
  let posterRequireTurnstile = false;

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

    if (uniqueReporterCount >= AUTO_DELETE_THRESHOLD) {
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

    if (targetPosterId) {
      const posterCountRow = await env.DB.prepare(
        `SELECT COUNT(DISTINCT r.reporter_id) AS uniqueReporterCount
         FROM reports r
         INNER JOIN posts p ON p.id = r.post_id
         WHERE p.poster_id = ?1
           AND r.reporter_id IS NOT NULL
           AND datetime(r.created_at) >= datetime('now', '-1 day')`
      )
        .bind(targetPosterId)
        .first<{ uniqueReporterCount: number }>();

      targetPosterUniqueReporterCount = Number(posterCountRow?.uniqueReporterCount || 0);

      if (targetPosterUniqueReporterCount >= POSTER_STAGE1_THRESHOLD) {
        posterSanctionStage =
          targetPosterUniqueReporterCount >= POSTER_STAGE2_THRESHOLD ? 2 : 1;
        const blockHours = posterSanctionStage === 2 ? 72 : 24;
        const reasonLabel =
          posterSanctionStage === 2
            ? "auto-stage2-50-reports"
            : "auto-stage1-30-reports";

        await env.DB.prepare(
          `INSERT INTO poster_sanctions (
             poster_id, write_block_until, require_turnstile, reason, created_at, updated_at
           )
           VALUES (?1, datetime('now', ?2), 1, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(poster_id) DO UPDATE SET
             write_block_until = CASE
               WHEN poster_sanctions.write_block_until IS NULL THEN excluded.write_block_until
               WHEN datetime(excluded.write_block_until) > datetime(poster_sanctions.write_block_until)
                 THEN excluded.write_block_until
               ELSE poster_sanctions.write_block_until
             END,
             require_turnstile = CASE
               WHEN poster_sanctions.require_turnstile = 1 OR excluded.require_turnstile = 1
                 THEN 1
               ELSE 0
             END,
             reason = excluded.reason,
             updated_at = CURRENT_TIMESTAMP`
        )
          .bind(targetPosterId, `+${blockHours} hours`, reasonLabel)
          .run();

        const sanctionRow = await env.DB.prepare(
          `SELECT
             write_block_until AS writeBlockUntil,
             require_turnstile AS requireTurnstile
           FROM poster_sanctions
           WHERE poster_id = ?1`
        )
          .bind(targetPosterId)
          .first<{ writeBlockUntil: string | null; requireTurnstile: number }>();
        posterWriteBlockedUntil = sanctionRow?.writeBlockUntil ?? null;
        posterRequireTurnstile = Number(sanctionRow?.requireTurnstile || 0) === 1;
      }
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
        autoDeleted,
        targetPosterId,
        targetPosterUniqueReporterCount,
        posterSanctionStage,
        posterWriteBlockedUntil,
        posterRequireTurnstile
      }
    },
    201
  );
};
