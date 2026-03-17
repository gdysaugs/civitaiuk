import { json } from "../../_utils";

type Env = {
  DB: D1Database;
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  return json({ error: "Post deletion by public token is disabled in blog mode." }, 410);
};
