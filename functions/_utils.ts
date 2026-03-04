export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}

export function cleanLongText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}

export function cleanUrl(value: unknown, maxLen: number): string | null {
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

export function parseBool(value: unknown): number {
  if (value === true || value === 1 || value === "1" || value === "on") return 1;
  return 0;
}

export function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

export function parseOptionalFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parseLimit(value: string | null, fallback = 50, min = 1, max = 200): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

export function validateMediaType(value: unknown): "image" | "video" | "mixed" {
  if (value === "video" || value === "mixed") return value;
  return "image";
}

export type MediaKind = "none" | "image" | "video" | "unknown";

export function detectMediaKind(mediaUrl: string | null, mediaMime: string | null): MediaKind {
  if (!mediaUrl) return "none";

  const mime = (mediaMime || "").trim().toLowerCase();
  if (mime) {
    if (mime === "image/svg+xml") return "unknown";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    return "unknown";
  }

  const lowerUrl = mediaUrl.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|avif)(\?|#|$)/.test(lowerUrl)) return "image";
  if (/\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/.test(lowerUrl)) return "video";
  return "unknown";
}

export function parseEnvBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function readClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  const first = forwarded.split(",")[0];
  return first ? first.trim() : "";
}

function hexFromBytes(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hexFromBytes(new Uint8Array(digest));
}

export async function buildPosterId(request: Request, now = new Date()): Promise<string> {
  const ip = readClientIp(request);
  const ua = request.headers.get("user-agent")?.trim() ?? "";
  const dayBucket = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  const src = `${ip}|${ua}|${dayBucket}`;
  const digest = await sha256Hex(src);
  return digest.slice(0, 8).toUpperCase();
}

export function createDeleteToken(): string {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`.replace(/-/g, "");
}
