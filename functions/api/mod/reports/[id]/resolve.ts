import { requireAdmin } from "../../../../_security";
import { cleanLongText, cleanText, json, readJson } from "../../../../_utils";

type Env = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
};

type ResolveReportPayload = {
  action?: "resolve_only" | "delete_post" | "delete_thread" | "lock_thread" | "reject";
  note?: string;
};

type ReportRow = {
  id: number;
  threadId: number | null;
  postId: number | null;
  status: string;
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request, params }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const reportId = Number(params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) return json({ error: "Invalid report id." }, 400);

  const payload = await readJson<ResolveReportPayload>(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);

  const action = cleanText(payload.action, 30) ?? "resolve_only";
  const note = cleanLongText(payload.note, 1200);
  const validAction = new Set(["resolve_only", "delete_post", "delete_thread", "lock_thread", "reject"]);
  if (!validAction.has(action)) return json({ error: "Invalid action." }, 400);

  const report = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, post_id AS postId, status
     FROM reports
     WHERE id = ?1`
  )
    .bind(reportId)
    .first<ReportRow>();

  if (!report) return json({ error: "Report not found." }, 404);
  if (report.status !== "open") return json({ error: "Report is already resolved." }, 409);

  let threadTarget = report.threadId;
  if (!threadTarget && report.postId) {
    const postThread = await env.DB.prepare(
      `SELECT thread_id AS threadId
       FROM posts
       WHERE id = ?1`
    )
      .bind(report.postId)
      .first<{ threadId: number }>();
    threadTarget = postThread?.threadId ?? null;
  }

  if (action === "delete_post") {
    if (!report.postId) return json({ error: "Report has no post target." }, 400);
    await env.DB.prepare("UPDATE posts SET is_deleted = 1 WHERE id = ?1").bind(report.postId).run();
  }

  if (action === "delete_thread") {
    if (!threadTarget) return json({ error: "Report has no thread target." }, 400);
    await env.DB.prepare("UPDATE threads SET is_deleted = 1, is_locked = 1 WHERE id = ?1").bind(threadTarget).run();
  }

  if (action === "lock_thread") {
    if (!threadTarget) return json({ error: "Report has no thread target." }, 400);
    await env.DB.prepare("UPDATE threads SET is_locked = 1 WHERE id = ?1").bind(threadTarget).run();
  }

  const resolvedStatus = action === "reject" ? "rejected" : "resolved";
  await env.DB.prepare(
    `UPDATE reports
     SET status = ?1,
         resolution_action = ?2,
         resolution_note = ?3,
         resolved_by = ?4,
         resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?5`
  )
    .bind(resolvedStatus, action, note, "admin", reportId)
    .run();

  return json({
    ok: true,
    reportId,
    status: resolvedStatus,
    action
  });
};
