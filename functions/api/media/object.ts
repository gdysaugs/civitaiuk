import { json } from "../../_utils";

type Env = {
  MEDIA?: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
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
};
