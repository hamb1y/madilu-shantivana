import copy from "../../content/copy.json";

/**
 * Interface text lives in content/copy.json so editors can change it in the
 * CMS. The file keeps one block per locale; keys are dotted paths into it,
 * e.g. "home.title". A field named `self` is the label of its own group, so
 * "nav.work.self" is read as "nav.work".
 *
 * One language: the file has no locale blocks, so use
 * `UIKey = Paths<typeof copy>` and `dictionaries = { en: flatten(copy) }`.
 */
type Locale = keyof typeof copy;

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? K extends "self"
      ? Prefix extends `${infer Parent}.`
        ? Parent
        : never
      : `${Prefix}${K}`
    : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type UIKey = Paths<(typeof copy)["en"]>;

function flatten(node: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") out[prefix] = node;
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      flatten(value, key === "self" ? prefix : prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

export const dictionaries = Object.fromEntries(
  Object.entries(copy).map(([locale, block]) => [locale, flatten(block)]),
) as Record<Locale, Record<string, string>>;
