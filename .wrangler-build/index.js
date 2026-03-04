var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _utils.ts
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(json, "json");
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
function cleanText(value, maxLen) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}
__name(cleanText, "cleanText");
function cleanLongText(value, maxLen) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}
__name(cleanLongText, "cleanLongText");
function cleanUrl(value, maxLen) {
  const input = cleanText(value, maxLen);
  if (!input) return null;
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
__name(cleanUrl, "cleanUrl");
function parseBool(value) {
  if (value === true || value === 1 || value === "1" || value === "on") return 1;
  return 0;
}
__name(parseBool, "parseBool");
function parseOptionalInt(value) {
  if (value === null || value === void 0 || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}
__name(parseOptionalInt, "parseOptionalInt");
function parseOptionalFloat(value) {
  if (value === null || value === void 0 || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
__name(parseOptionalFloat, "parseOptionalFloat");
function parseLimit(value, fallback = 50, min = 1, max = 200) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}
__name(parseLimit, "parseLimit");
function validateMediaType(value) {
  if (value === "video" || value === "mixed") return value;
  return "image";
}
__name(validateMediaType, "validateMediaType");
function parseEnvBool(value, fallback = false) {
  if (value === void 0) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
__name(parseEnvBool, "parseEnvBool");
function clampNumber(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
__name(clampNumber, "clampNumber");

// _security.ts
var TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
function readClientIp(request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  const first = forwarded.split(",")[0];
  return first ? first.trim() : "";
}
__name(readClientIp, "readClientIp");
function isTurnstileRequired(env) {
  return parseEnvBool(env.TURNSTILE_REQUIRED, false);
}
__name(isTurnstileRequired, "isTurnstileRequired");
async function verifyTurnstile(request, env, token) {
  const secret = env.TURNSTILE_SECRET?.trim();
  const required = isTurnstileRequired(env);
  if (!secret) {
    if (required) {
      return { ok: false, error: "Turnstile required but TURNSTILE_SECRET is not configured." };
    }
    return { ok: true };
  }
  const normalizedToken = token?.trim();
  if (!normalizedToken) return { ok: false, error: "Turnstile token is missing." };
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", normalizedToken);
  const clientIp = readClientIp(request);
  if (clientIp) body.set("remoteip", clientIp);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body
    });
    if (!response.ok) {
      return { ok: false, error: "Turnstile verification request failed." };
    }
    const result = await response.json();
    if (result.success) return { ok: true };
    return { ok: false, error: "Turnstile verification failed." };
  } catch {
    return { ok: false, error: "Turnstile verification failed." };
  }
}
__name(verifyTurnstile, "verifyTurnstile");
function readBearerToken(request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}
__name(readBearerToken, "readBearerToken");
function requireAdmin(request, env) {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return json({ error: "Admin API is not configured." }, 503);
  }
  const provided = request.headers.get("x-admin-token")?.trim() ?? readBearerToken(request) ?? "";
  if (!provided || provided !== expected) {
    return json({ error: "Unauthorized." }, 401);
  }
  return null;
}
__name(requireAdmin, "requireAdmin");

// api/mod/reports/[id]/resolve.ts
var onRequestPost = /* @__PURE__ */ __name(async ({ env, request, params }) => {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const reportId = Number(params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) return json({ error: "Invalid report id." }, 400);
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const action = cleanText(payload.action, 30) ?? "resolve_only";
  const note = cleanLongText(payload.note, 1200);
  const validAction = /* @__PURE__ */ new Set(["resolve_only", "delete_post", "delete_thread", "lock_thread", "reject"]);
  if (!validAction.has(action)) return json({ error: "Invalid action." }, 400);
  const report = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, post_id AS postId, status
     FROM reports
     WHERE id = ?1`
  ).bind(reportId).first();
  if (!report) return json({ error: "Report not found." }, 404);
  if (report.status !== "open") return json({ error: "Report is already resolved." }, 409);
  let threadTarget = report.threadId;
  if (!threadTarget && report.postId) {
    const postThread = await env.DB.prepare(
      `SELECT thread_id AS threadId
       FROM posts
       WHERE id = ?1`
    ).bind(report.postId).first();
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
  ).bind(resolvedStatus, action, note, "admin", reportId).run();
  return json({
    ok: true,
    reportId,
    status: resolvedStatus,
    action
  });
}, "onRequestPost");

// api/media/object.ts
var onRequestGet = /* @__PURE__ */ __name(async ({ env, request }) => {
  if (!env.MEDIA) return json({ error: "R2 bucket binding MEDIA is not configured." }, 503);
  const key = new URL(request.url).searchParams.get("key")?.trim();
  if (!key) return json({ error: "key is required." }, 400);
  if (key.includes("..")) return json({ error: "Invalid key." }, 400);
  const object = await env.MEDIA.get(key);
  if (!object) return json({ error: "Object not found." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") ?? "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}, "onRequestGet");

// api/media/upload.ts
function sanitizeFilename(name) {
  const base = name.trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "file.bin";
}
__name(sanitizeFilename, "sanitizeFilename");
function createObjectKey(filename) {
  const now = /* @__PURE__ */ new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${dd}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}
__name(createObjectKey, "createObjectKey");
function resolveMediaUrl(baseUrl, key) {
  const base = baseUrl?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return `/api/media/object?key=${encodeURIComponent(key)}`;
}
__name(resolveMediaUrl, "resolveMediaUrl");
var onRequestPost2 = /* @__PURE__ */ __name(async ({ env, request }) => {
  if (!env.MEDIA) return json({ error: "R2 bucket binding MEDIA is not configured." }, 503);
  const maxUploadCandidate = parseOptionalInt(env.MAX_UPLOAD_BYTES);
  const maxUploadBytes = clampNumber(maxUploadCandidate ?? 25 * 1024 * 1024, 1024, 500 * 1024 * 1024);
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid multipart form data." }, 400);
  }
  const token = form.get("turnstileToken");
  const tokenText = typeof token === "string" ? token : token?.toString();
  if (isTurnstileRequired(env) || tokenText?.trim()) {
    const turnstile = await verifyTurnstile(request, env, tokenText);
    if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "file is required." }, 400);
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return json({ error: "Only image/video files are allowed." }, 400);
  }
  if (file.size <= 0) {
    return json({ error: "Empty file is not allowed." }, 400);
  }
  if (file.size > maxUploadBytes) {
    return json({ error: `File is too large. Max ${maxUploadBytes} bytes.` }, 413);
  }
  const key = createObjectKey(file.name || "upload.bin");
  const bytes = await file.arrayBuffer();
  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
  return json(
    {
      key,
      mediaUrl: resolveMediaUrl(env.R2_PUBLIC_BASE_URL, key),
      mimeType: file.type || "application/octet-stream",
      size: file.size
    },
    201
  );
}, "onRequestPost");

// api/threads/[id].ts
var onRequestGet2 = /* @__PURE__ */ __name(async ({ env, params, request }) => {
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId) || threadId <= 0) return json({ error: "Invalid thread id." }, 400);
  const includeNsfw = new URL(request.url).searchParams.get("nsfw") === "include" ? 1 : 0;
  const limit = parseLimit(new URL(request.url).searchParams.get("postLimit"), 200, 1, 500);
  const thread = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, is_locked AS isLocked,
            created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1 AND is_deleted = 0 AND (?2 = 1 OR nsfw = 0)`
  ).bind(threadId, includeNsfw).first();
  if (!thread) return json({ error: "Thread not found." }, 404);
  const { results: posts } = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl,
            media_mime AS mediaMime,
            seed, sampler, steps, cfg_scale AS cfgScale,
            width, height, author_name AS authorName, nsfw,
            created_at AS createdAt
     FROM posts
     WHERE thread_id = ?1 AND is_deleted = 0
     ORDER BY datetime(created_at) ASC
     LIMIT ?2`
  ).bind(threadId, limit).all();
  return json({ thread, posts, postLimit: limit, includeNsfw: includeNsfw === 1 });
}, "onRequestGet");

// api/config.ts
var onRequestGet3 = /* @__PURE__ */ __name(async ({ env }) => {
  const maxUploadCandidate = parseOptionalInt(env.MAX_UPLOAD_BYTES);
  const maxUploadBytes = maxUploadCandidate && maxUploadCandidate > 0 ? maxUploadCandidate : 25 * 1024 * 1024;
  return json({
    appName: env.APP_NAME ?? "civitai.uk",
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    turnstileRequired: isTurnstileRequired(env),
    uploadsEnabled: Boolean(env.MEDIA),
    publicMediaBaseUrl: env.R2_PUBLIC_BASE_URL ?? null,
    maxUploadBytes
  });
}, "onRequestGet");

// api/health.ts
var onRequestGet4 = /* @__PURE__ */ __name(async ({ env }) => {
  try {
    const result = await env.DB.prepare("SELECT 1 as ok").first();
    return json({ ok: true, db: result?.ok === 1 });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
}, "onRequestGet");

// api/posts/index.ts
var onRequestPost3 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const threadId = parseOptionalInt(payload.threadId);
  const body = cleanLongText(payload.body, 5e3);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const nsfw = parseBool(payload.nsfw);
  const mediaUrl = cleanUrl(payload.mediaUrl, 2e3);
  const thumbnailUrl = cleanUrl(payload.thumbnailUrl, 2e3);
  const prompt = cleanLongText(payload.prompt, 4e3);
  const workflowJson = cleanLongText(payload.workflowJson, 2e4);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);
  const mediaMime = cleanText(payload.mediaMime, 120);
  if (!threadId || threadId <= 0) return json({ error: "Valid threadId is required." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);
  if (payload.mediaUrl && !mediaUrl) return json({ error: "mediaUrl must be a valid http/https URL." }, 400);
  if (payload.thumbnailUrl && !thumbnailUrl) {
    return json({ error: "thumbnailUrl must be a valid http/https URL." }, 400);
  }
  const turnstile = await verifyTurnstile(request, env, payload.turnstileToken);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);
  const thread = await env.DB.prepare(
    `SELECT id, is_locked AS isLocked
     FROM threads
     WHERE id = ?1 AND is_deleted = 0`
  ).bind(threadId).first();
  if (!thread) return json({ error: "Thread not found." }, 404);
  if (thread.isLocked === 1) return json({ error: "Thread is locked." }, 403);
  const result = await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      media_mime, seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
  ).bind(
    threadId,
    body,
    prompt,
    workflowJson,
    mediaUrl,
    thumbnailUrl,
    mediaMime,
    seed,
    sampler,
    steps,
    cfgScale,
    width,
    height,
    authorName,
    nsfw
  ).run();
  const postId = Number(result.meta.last_row_id);
  const created = await env.DB.prepare(
    `SELECT id, thread_id AS threadId, body, prompt, workflow_json AS workflowJson,
            media_url AS mediaUrl, thumbnail_url AS thumbnailUrl, media_mime AS mediaMime,
            seed, sampler,
            steps, cfg_scale AS cfgScale, width, height, author_name AS authorName,
            nsfw, created_at AS createdAt
     FROM posts
     WHERE id = ?1`
  ).bind(postId).first();
  return json({ post: created }, 201);
}, "onRequestPost");

// api/reports/index.ts
var REPORT_REASONS = /* @__PURE__ */ new Set([
  "illegal",
  "copyright",
  "non-consensual",
  "minor-suspected",
  "harassment",
  "spam",
  "other"
]);
var onRequestGet5 = /* @__PURE__ */ __name(async ({ env, request }) => {
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
  ).bind(status, limit).all();
  return json({ reports: results, status, limit });
}, "onRequestGet");
var onRequestPost4 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const threadId = parseOptionalInt(payload.threadId);
  const postId = parseOptionalInt(payload.postId);
  const reason = cleanText(payload.reason, 40);
  const details = cleanLongText(payload.details, 2e3);
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
    ).bind(resolvedPostId).first();
    if (!post) return json({ error: "Post not found." }, 404);
    resolvedThreadId = resolvedThreadId ?? post.threadId;
  }
  if (resolvedThreadId) {
    const thread = await env.DB.prepare(
      `SELECT id
       FROM threads
       WHERE id = ?1 AND is_deleted = 0`
    ).bind(resolvedThreadId).first();
    if (!thread) return json({ error: "Thread not found." }, 404);
  }
  const created = await env.DB.prepare(
    `INSERT INTO reports (thread_id, post_id, reason, details)
     VALUES (?1, ?2, ?3, ?4)`
  ).bind(resolvedThreadId, resolvedPostId, reason, details).run();
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
}, "onRequestPost");

// api/threads/index.ts
var onRequestGet6 = /* @__PURE__ */ __name(async ({ env, request }) => {
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
      t.is_locked AS isLocked,
      t.created_at AS createdAt,
      t.updated_at AS updatedAt,
      COUNT(CASE WHEN p.is_deleted = 0 THEN p.id END) AS postCount
    FROM threads t
    LEFT JOIN posts p ON p.thread_id = t.id
    WHERE t.is_deleted = 0
      AND (?1 = 1 OR t.nsfw = 0)
    GROUP BY t.id
    ORDER BY datetime(t.updated_at) DESC
    LIMIT ?2
  `;
  const { results } = await env.DB.prepare(query).bind(includeNsfw, limit).all();
  return json({ threads: results, limit, includeNsfw: includeNsfw === 1 });
}, "onRequestGet");
var onRequestPost5 = /* @__PURE__ */ __name(async ({ env, request }) => {
  const payload = await readJson(request);
  if (!payload) return json({ error: "Invalid JSON body." }, 400);
  const title = cleanText(payload.title, 120);
  const body = cleanLongText(payload.body, 5e3);
  const authorName = cleanText(payload.authorName ?? "anonymous", 40) ?? "anonymous";
  const modelName = cleanText(payload.modelName, 80);
  const mediaType = validateMediaType(payload.mediaType);
  const nsfw = parseBool(payload.nsfw);
  const mediaUrl = cleanUrl(payload.mediaUrl, 2e3);
  const thumbnailUrl = cleanUrl(payload.thumbnailUrl, 2e3);
  const prompt = cleanLongText(payload.prompt, 4e3);
  const workflowJson = cleanLongText(payload.workflowJson, 2e4);
  const seed = parseOptionalInt(payload.seed);
  const sampler = cleanText(payload.sampler, 80);
  const steps = parseOptionalInt(payload.steps);
  const cfgScale = parseOptionalFloat(payload.cfgScale);
  const width = parseOptionalInt(payload.width);
  const height = parseOptionalInt(payload.height);
  const mediaMime = cleanText(payload.mediaMime, 120);
  if (!title || title.length < 3) return json({ error: "Title must be at least 3 chars." }, 400);
  if (!body) return json({ error: "Body is required." }, 400);
  if (payload.mediaUrl && !mediaUrl) return json({ error: "mediaUrl must be a valid http/https URL." }, 400);
  if (payload.thumbnailUrl && !thumbnailUrl) {
    return json({ error: "thumbnailUrl must be a valid http/https URL." }, 400);
  }
  const turnstile = await verifyTurnstile(request, env, payload.turnstileToken);
  if (!turnstile.ok) return json({ error: turnstile.error ?? "Human verification failed." }, 403);
  const threadResult = await env.DB.prepare(
    `INSERT INTO threads (title, author_name, model_name, media_type, nsfw)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(title, authorName, modelName, mediaType, nsfw).run();
  const threadId = Number(threadResult.meta.last_row_id);
  await env.DB.prepare(
    `INSERT INTO posts (
      thread_id, body, prompt, workflow_json, media_url, thumbnail_url,
      media_mime, seed, sampler, steps, cfg_scale, width, height, author_name, nsfw
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
  ).bind(
    threadId,
    body,
    prompt,
    workflowJson,
    mediaUrl,
    thumbnailUrl,
    mediaMime,
    seed,
    sampler,
    steps,
    cfgScale,
    width,
    height,
    authorName,
    nsfw
  ).run();
  const created = await env.DB.prepare(
    `SELECT id, title, author_name AS authorName, model_name AS modelName,
            media_type AS mediaType, nsfw, is_locked AS isLocked,
            created_at AS createdAt, updated_at AS updatedAt
     FROM threads
     WHERE id = ?1`
  ).bind(threadId).first();
  return json({ thread: created }, 201);
}, "onRequestPost");

// _middleware.ts
var onRequest = /* @__PURE__ */ __name(async (context) => {
  if (context.request.method === "OPTIONS") {
    return json({ ok: true });
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}, "onRequest");

// ../.wrangler/tmp/pages-BYNm33/functionsRoutes-0.0992369177588247.mjs
var routes = [
  {
    routePath: "/api/mod/reports/:id/resolve",
    mountPath: "/api/mod/reports/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/media/object",
    mountPath: "/api/media",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/media/upload",
    mountPath: "/api/media",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/threads/:id",
    mountPath: "/api/threads",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/config",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/health",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/posts",
    mountPath: "/api/posts",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api/reports",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api/reports",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/threads",
    mountPath: "/api/threads",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/threads",
    mountPath: "/api/threads",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
