export const onRequestGet: PagesFunction = async ({ params, request }) => {
  const idText = String(params.id ?? "").trim();
  if (!/^\d+$/.test(idText)) {
    return new Response("Invalid post id.", { status: 400 });
  }

  const url = new URL(request.url);
  url.pathname = "/post";
  url.search = "";
  url.searchParams.set("id", idText);
  return Response.redirect(url.toString(), 301);
};
