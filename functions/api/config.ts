import { isTurnstileRequired } from "../_security";
import { json, parseOptionalInt } from "../_utils";

type Env = {
  APP_NAME?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_REQUIRED?: string;
  R2_PUBLIC_BASE_URL?: string;
  MAX_UPLOAD_BYTES?: string;
  MEDIA?: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const maxUploadCandidate = parseOptionalInt(env.MAX_UPLOAD_BYTES);
  const maxUploadBytes =
    maxUploadCandidate && maxUploadCandidate > 0 ? maxUploadCandidate : 80 * 1024 * 1024;

  return json({
    appName: env.APP_NAME ?? "AI動画のレシピ",
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
    turnstileRequired: isTurnstileRequired(env),
    uploadsEnabled: Boolean(env.MEDIA),
    publicMediaBaseUrl: env.R2_PUBLIC_BASE_URL ?? null,
    maxUploadBytes
  });
};
