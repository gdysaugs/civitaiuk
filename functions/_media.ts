import { cleanText } from "./_utils";

type MediaStorageEnv = {
  MEDIA?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
};

type ResolveCommittedMediaInput = {
  requestUrl: string;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaKey: string | null;
};

type ResolveCommittedMediaResult = {
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaKey: string | null;
};

function sanitizeFilename(name: string): string {
  const base = name.trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "file.bin";
}

function buildDatedKey(prefix: "tmp" | "media", filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${prefix}/${yyyy}/${mm}/${dd}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

function basenameFromKey(key: string): string {
  const idx = key.lastIndexOf("/");
  const name = idx >= 0 ? key.slice(idx + 1) : key;
  return sanitizeFilename(name);
}

function isAllowedMediaKey(key: string): boolean {
  if (!key) return false;
  if (key.includes("..")) return false;
  if (key.startsWith("/") || key.startsWith("\\")) return false;
  if (key.length > 500) return false;
  return key.startsWith("tmp/") || key.startsWith("media/") || key.startsWith("uploads/");
}

export function cleanMediaKey(value: unknown): string | null {
  const key = cleanText(value, 500);
  if (!key) return null;
  return isAllowedMediaKey(key) ? key : null;
}

export function createTmpObjectKey(filename: string): string {
  return buildDatedKey("tmp", filename);
}

export function createMediaObjectKey(filename: string): string {
  return buildDatedKey("media", filename);
}

export function resolveMediaUrl(baseUrl: string | undefined, requestUrl: string, key: string): string {
  const base = baseUrl?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  const fallback = `/api/media/object?key=${encodeURIComponent(key)}`;
  return new URL(fallback, requestUrl).toString();
}

export async function resolveCommittedMedia(
  env: MediaStorageEnv,
  input: ResolveCommittedMediaInput
): Promise<ResolveCommittedMediaResult> {
  const normalizedKey = input.mediaKey?.trim() ?? "";
  if (!normalizedKey) {
    return {
      mediaUrl: input.mediaUrl,
      mediaMime: input.mediaMime,
      mediaKey: null
    };
  }

  if (!isAllowedMediaKey(normalizedKey)) {
    throw new Error("Invalid mediaKey.");
  }

  if (!env.MEDIA) {
    throw new Error("R2 media storage is not configured.");
  }

  if (normalizedKey.startsWith("media/") || normalizedKey.startsWith("uploads/")) {
    return {
      mediaUrl: resolveMediaUrl(env.R2_PUBLIC_BASE_URL, input.requestUrl, normalizedKey),
      mediaMime: input.mediaMime,
      mediaKey: normalizedKey
    };
  }

  if (!normalizedKey.startsWith("tmp/")) {
    throw new Error("Invalid mediaKey.");
  }

  const object = await env.MEDIA.get(normalizedKey);
  if (!object) {
    throw new Error("Uploaded media was not found. Please upload again.");
  }

  const destinationKey = createMediaObjectKey(basenameFromKey(normalizedKey));
  const body = object.body;
  if (!body) {
    throw new Error("Uploaded media body is missing. Please upload again.");
  }
  const resolvedMime = object.httpMetadata?.contentType?.trim() || input.mediaMime || null;

  await env.MEDIA.put(destinationKey, body, {
    httpMetadata: {
      contentType: resolvedMime ?? undefined,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  try {
    await env.MEDIA.delete(normalizedKey);
  } catch {
    // Best effort cleanup: tmp object is also cleaned by lifecycle rules.
  }

  return {
    mediaUrl: resolveMediaUrl(env.R2_PUBLIC_BASE_URL, input.requestUrl, destinationKey),
    mediaMime: resolvedMime,
    mediaKey: destinationKey
  };
}
