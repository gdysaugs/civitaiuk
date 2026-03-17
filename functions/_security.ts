import { json, parseEnvBool } from "./_utils";

type SecurityEnv = {
  TURNSTILE_SECRET?: string;
  TURNSTILE_REQUIRED?: string;
  ADMIN_TOKEN?: string;
};

type TurnstileResult = {
  ok: boolean;
  error?: string;
};

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function readClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "";
  const first = forwarded.split(",")[0];
  return first ? first.trim() : "";
}

export function isTurnstileRequired(env: SecurityEnv): boolean {
  return parseEnvBool(env.TURNSTILE_REQUIRED, false);
}

async function verifyTurnstileWithRequirement(
  request: Request,
  env: SecurityEnv,
  token: string | null | undefined,
  required: boolean
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET?.trim();

  if (!secret) {
    if (required) {
      return { ok: false, error: "Turnstile required but TURNSTILE_SECRET is not configured." };
    }
    return { ok: true };
  }

  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    if (required) return { ok: false, error: "Turnstile token is missing." };
    return { ok: true };
  }

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

    const result = (await response.json()) as { success?: boolean };
    if (result.success) return { ok: true };
    return { ok: false, error: "Turnstile verification failed." };
  } catch {
    return { ok: false, error: "Turnstile verification failed." };
  }
}

export async function verifyTurnstile(
  request: Request,
  env: SecurityEnv,
  token: string | null | undefined
): Promise<TurnstileResult> {
  return verifyTurnstileWithRequirement(request, env, token, isTurnstileRequired(env));
}

export async function verifyTurnstileWhen(
  request: Request,
  env: SecurityEnv,
  token: string | null | undefined,
  required: boolean
): Promise<TurnstileResult> {
  return verifyTurnstileWithRequirement(request, env, token, required);
}

function readBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

export function requireAdmin(request: Request, env: SecurityEnv): Response | null {
  const expected = env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return json({ error: "Admin API is not configured." }, 503);
  }

  const provided =
    request.headers.get("x-admin-token")?.trim() ?? readBearerToken(request) ?? "";

  if (!provided || provided !== expected) {
    return json({ error: "Unauthorized." }, 401);
  }

  return null;
}
