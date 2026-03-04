import { json } from "./_utils";

export const onRequest: PagesFunction = async (context) => {
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
};