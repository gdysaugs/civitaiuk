import { json } from "../../_utils";

type Env = {
  DB: D1Database;
};

export const onRequestPost: PagesFunction<Env> = async () => {
  return json({ error: "Public posting is disabled." }, 403);
};
