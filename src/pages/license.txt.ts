import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** The licence, served from the repository's LICENSE so the two never differ. */
export const GET: APIRoute = async () => {
  const text = await readFile(path.join(process.cwd(), "LICENSE"), "utf8");
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
