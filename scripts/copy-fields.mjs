#!/usr/bin/env node
/**
 * Write the CMS fields for content/copy.json into public/admin/config.yml.
 *
 *   bun run cms:copy
 *
 * Each page gets one collapsed object, with a text field per key. A key whose
 * text holds placeholders such as {count} gets a hint naming them, so editors
 * keep them. The fields go between the `copy-fields:start` and
 * `copy-fields:end` markers; everything else in config.yml is left alone. Run
 * it after adding or removing a key in copy.json, then `bun run cms`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG = path.join(ROOT, "public/admin/config.yml");
const START = "# copy-fields:start";
const END = "# copy-fields:end";

/** Names for the page blocks; anything else is labelled from its key. */
const GROUPS = {
  a11y: "Screen readers",
  nav: "Navigation",
  footer: "Footer",
  home: "Home page",
  onward: "Onward links (one line of data per page)",
  story: "Story page",
  grows: "What grows page",
  farming: "Farming page",
  photos: "Photos page",
  about: "About page",
  notFound: "Page not found",
};

/** "primaryNav" → "Primary nav". */
const labelOf = (key) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function field(key, value, groupLabel) {
  const label = key === "self" ? groupLabel : labelOf(key);
  if (typeof value === "object" && value !== null) {
    return {
      label,
      name: key,
      widget: "object",
      collapsed: true,
      i18n: true,
      fields: Object.entries(value).map(([k, v]) => field(k, v, label)),
    };
  }
  const out = { label, name: key, widget: String(value).length > 90 ? "text" : "string", i18n: true };
  const placeholders = [...new Set(String(value).match(/\{\w+\}/g) ?? [])];
  if (placeholders.length) out.hint = `Keep ${placeholders.join(", ")} as written; the site fills ${placeholders.length > 1 ? "them" : "it"} in.`;
  return out;
}

const copy = JSON.parse(await readFile(path.join(ROOT, "content/copy.json"), "utf8"));
const base = copy.en ?? copy;
const fields = Object.entries(base).map(([key, value]) => {
  const out = field(key, value, GROUPS[key] ?? labelOf(key));
  out.label = GROUPS[key] ?? out.label;
  return out;
});

const config = await readFile(CONFIG, "utf8");
const start = config.indexOf(START);
const end = config.indexOf(END);
if (start < 0 || end < start) {
  console.error(`✗ ${path.relative(ROOT, CONFIG)} needs "${START}" and "${END}" marker lines`);
  process.exit(1);
}
// Indent to match the marker line.
const lineStart = config.lastIndexOf("\n", start) + 1;
const indent = config.slice(lineStart, start);
const yaml = YAML.stringify(fields, { lineWidth: 0 })
  .trimEnd()
  .split("\n")
  .map((line) => indent + line)
  .join("\n");
const next = `${config.slice(0, start)}${START}\n${yaml}\n${indent}${config.slice(end)}`;
if (next === config) console.log("✓ copy fields already up to date");
else {
  await writeFile(CONFIG, next);
  console.log(`✓ wrote ${fields.length} copy groups to ${path.relative(ROOT, CONFIG)}`);
}
