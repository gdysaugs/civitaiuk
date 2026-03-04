import { isTurnstileRequired, verifyTurnstile } from "../../_security";
import { clampNumber, json, parseOptionalInt } from "../../_utils";

type Env = {
  MEDIA?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  MAX_UPLOAD_BYTES?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
};

function sanitizeFilename(name: string): string {
  const base = name.trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "file.bin";
}

function createObjectKey(filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${dd}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

function resolveMediaUrl(baseUrl: string | undefined, key: string): string {
  const base = baseUrl?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return `/api/media/object?key=${encodeURIComponent(key)}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.MEDIA) return json({ error: "R2 bucket binding MEDIA is not configured." }, 503);

  const maxUploadCandidate = parseOptionalInt(env.MAX_UPLOAD_BYTES);
  const maxUploadBytes = clampNumber(maxUploadCandidate ?? 25 * 1024 * 1024, 1024, 500 * 1024 * 1024);

  let form: FormData;
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
};
