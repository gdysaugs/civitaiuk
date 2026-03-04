import { isTurnstileRequired, verifyTurnstile } from "../../_security";
import { clampNumber, json, parseOptionalInt } from "../../_utils";
import { createTmpObjectKey, resolveMediaUrl } from "../../_media";

type Env = {
  MEDIA?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  MAX_UPLOAD_BYTES?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
};

const DEFAULT_MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

function guessMimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg)$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.gif$/.test(lower)) return "image/gif";
  if (/\.webp$/.test(lower)) return "image/webp";
  if (/\.avif$/.test(lower)) return "image/avif";
  if (/\.bmp$/.test(lower)) return "image/bmp";
  if (/\.mp4$/.test(lower)) return "video/mp4";
  if (/\.webm$/.test(lower)) return "video/webm";
  if (/\.mov$/.test(lower)) return "video/quicktime";
  if (/\.m4v$/.test(lower)) return "video/x-m4v";
  if (/\.mkv$/.test(lower)) return "video/x-matroska";
  return null;
}

function resolveAllowedMime(file: File): string | null {
  const mime = file.type?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/") || mime.startsWith("video/")) return mime;
  return guessMimeFromFilename(file.name || "");
}

function sanitizeFilename(name: string): string {
  const base = name.trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "file.bin";
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.MEDIA) return json({ error: "R2 bucket binding MEDIA is not configured." }, 503);

  const maxUploadCandidate = parseOptionalInt(env.MAX_UPLOAD_BYTES);
  const maxUploadBytes = clampNumber(maxUploadCandidate ?? DEFAULT_MAX_UPLOAD_BYTES, 1024, 120 * 1024 * 1024);

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

  const resolvedMimeType = resolveAllowedMime(file);
  if (!resolvedMimeType) {
    return json({ error: "Only image/video files are allowed." }, 400);
  }

  if (file.size <= 0) {
    return json({ error: "Empty file is not allowed." }, 400);
  }

  if (file.size > maxUploadBytes) {
    return json({ error: `File is too large. Max ${maxUploadBytes} bytes.` }, 413);
  }

  const key = createTmpObjectKey(sanitizeFilename(file.name || "upload.bin"));
  const body = file.stream();

  await env.MEDIA.put(key, body, {
    httpMetadata: {
      contentType: resolvedMimeType,
      cacheControl: "public, max-age=86400"
    }
  });

  return json(
    {
      key,
      mediaKey: key,
      mediaUrl: resolveMediaUrl(env.R2_PUBLIC_BASE_URL, request.url, key),
      mimeType: resolvedMimeType,
      size: file.size
    },
    201
  );
};
