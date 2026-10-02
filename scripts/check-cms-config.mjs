#!/usr/bin/env node
/**
 * Validate the Sveltia CMS configuration.
 *
 * Two kinds of check:
 *
 *  1. Offline structure and coverage — required keys, valid widget names, a
 *     valid `auth_scope`, relations that resolve, i18n locales matching the
 *     content (when the site has more than one language), and (the one that
 *     actually prevents data loss) every field present in `content/` being
 *     declared in `config.yml`. Sveltia drops fields it does not know about when
 *     an editor saves, so an undeclared field is silent data loss.
 *  2. `--schema` — validate the whole file against the JSON Schema published
 *     with the CMS package. Needs network access; run it when editing the config.
 *
 *   bun run cms                 # offline checks
 *   bun run cms --schema        # ...plus validation against the official schema
 *
 * Exported so `bun run verify` can run the offline checks as part of the gate.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCHEMA_URL = "https://unpkg.com/@sveltia/cms/schema/sveltia-cms.json";

/** True for a file in the shape Sveltia saves with i18n: `{ en: {…}, fr: {…} }`. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const localeFileTest = (i18n) => (data) =>
  Boolean(i18n) &&
  isRecord(data) &&
  isRecord(data[i18n.default_locale]) &&
  Object.keys(data).every((key) => i18n.locales.includes(key));

/** Widget names taken from the schema published with @sveltia/cms. */
export const WIDGETS = new Set([
  "boolean", "code", "color", "compute", "datetime", "file", "hidden", "image",
  "keyvalue", "list", "map", "markdown", "number", "object", "relation",
  "richtext", "select", "string", "text", "uuid",
]);
export const AUTH_SCOPES = new Set(["repo", "public_repo"]);
export const I18N_STRUCTURES = new Set(["single_file", "multiple_files", "multiple_folders"]);

const fail = (where, message) => console.error(`  ✗ ${where}: ${message}`);

function checkFields(fields, where, problems) {
  if (!Array.isArray(fields)) {
    problems.push(`${where}: fields must be a list`);
    return;
  }
  for (const field of fields) {
    const id = `${where} › ${field?.name ?? "(unnamed)"}`;
    if (!field?.name) problems.push(`${id}: missing name`);
    if (!field?.label) problems.push(`${id}: missing label (every field needs one)`);
    if (!field?.widget) problems.push(`${id}: missing widget`);
    else if (!WIDGETS.has(field.widget)) problems.push(`${id}: unknown widget "${field.widget}"`);
    if (field?.widget === "select") {
      const options = field.options;
      if (!Array.isArray(options) || options.length === 0) {
        problems.push(`${id}: a select needs options`);
      }
    }
    if (field?.widget === "object") checkFields(field.fields, id, problems);
    // A list has `fields`, a single `field`, or neither (a list of strings).
    if (field?.widget === "list" && field.fields) checkFields(field.fields, id, problems);
    if (field?.widget === "list" && field.field) checkFields([field.field], id, problems);
    if (field?.types) for (const type of field.types) checkFields(type.fields, `${id} › ${type.name}`, problems);
  }
}

export async function checkCmsConfig({ root = ROOT } = {}) {
  const problems = [];
  const notes = [];
  const configPath = path.join(root, "public/admin/config.yml");
  const config = YAML.parse(await readFile(configPath, "utf8"));

  // --- backend -------------------------------------------------------------
  const backend = config.backend ?? {};
  if (backend.name !== "github") problems.push(`backend.name is "${backend.name}", expected "github"`);
  if (!backend.repo || !/^[\w.-]+\/[\w.-]+$/.test(backend.repo)) {
    problems.push(`backend.repo "${backend.repo}" is not OWNER/REPO`);
  }
  if (!backend.branch) problems.push("backend.branch is missing");
  if (!AUTH_SCOPES.has(backend.auth_scope)) {
    problems.push(`backend.auth_scope "${backend.auth_scope}" must be one of ${[...AUTH_SCOPES].join(", ")}`);
  }
  if (backend.base_url === "") problems.push("backend.base_url is an empty string; remove the key or set a URL");

  // --- media ---------------------------------------------------------------
  if (!config.media_folder) problems.push("media_folder is missing");
  if (!config.public_folder) problems.push("public_folder is missing");

  // --- i18n ----------------------------------------------------------------
  // A site in one language has no i18n block.
  const isLocaleFile = localeFileTest(config.i18n);
  if (config.i18n) {
    if (!I18N_STRUCTURES.has(config.i18n.structure)) {
      problems.push(`i18n.structure "${config.i18n.structure}" is not a known value`);
    }
    const contentLocales = new Set();
    const copy = JSON.parse(await readFile(path.join(root, "content/copy.json"), "utf8").catch(() => "{}"));
    for (const locale of Object.keys(copy)) contentLocales.add(locale);
    for (const locale of config.i18n.locales ?? []) {
      if (contentLocales.size && !contentLocales.has(locale)) {
        problems.push(`i18n locale "${locale}" has no block in content/copy.json`);
      }
    }
    if (!config.i18n.locales?.includes(config.i18n.default_locale)) {
      problems.push("i18n.default_locale is not in i18n.locales");
    }
  }

  // --- collections ---------------------------------------------------------
  if (!Array.isArray(config.collections) || config.collections.length === 0) {
    problems.push("collections is missing or empty");
  }
  const names = new Set();
  for (const collection of config.collections ?? []) {
    const where = `collection "${collection.name ?? "?"}"`;
    if (!collection.name) problems.push(`${where}: missing name`);
    if (names.has(collection.name)) problems.push(`${where}: duplicate collection name`);
    names.add(collection.name);
    if (!collection.label) problems.push(`${where}: missing label`);
    if (collection.folder) {
      if (!collection.format) problems.push(`${where}: a folder collection needs a format`);
      if (!collection.identifier_field) problems.push(`${where}: set identifier_field`);
      checkFields(collection.fields, where, problems);
    } else if (collection.files) {
      for (const file of collection.files) {
        if (!file.file) problems.push(`${where} › "${file.name}": missing file path`);
        if ("description" in file) problems.push(`${where} › "${file.name}": a file entry can't have a description`);
        checkFields(file.fields, `${where} › ${file.name}`, problems);
      }
    } else {
      problems.push(`${where}: needs a folder or files`);
    }
  }

  // --- relations point at a collection (and file) that exists --------------
  const relations = (fields, where) => {
    for (const field of fields ?? []) {
      const id = `${where} › ${field.name}`;
      if (field.widget === "relation") {
        const target = (config.collections ?? []).find((c) => c.name === field.collection);
        if (!target) problems.push(`${id}: relation to unknown collection "${field.collection}"`);
        else if (field.file && !target.files?.some((f) => f.name === field.file)) {
          problems.push(`${id}: relation to unknown file "${field.collection}/${field.file}"`);
        }
        if (!field.value_field) problems.push(`${id}: a relation needs value_field`);
      }
      relations(field.fields, id);
      for (const type of field.types ?? []) relations(type.fields, `${id} › ${type.name}`);
    }
  };
  for (const collection of config.collections ?? []) {
    relations(collection.fields, collection.name);
    for (const file of collection.files ?? []) relations(file.fields, `${collection.name} › ${file.name}`);
  }

  // --- coverage: every content field must be declared ----------------------
  // Files keep one block per locale; each block is checked against the fields,
  // down through objects and lists.
  const undeclared = (data, fields, where, out) => {
    if (typeof data !== "object" || data === null || Array.isArray(data)) return;
    for (const [key, value] of Object.entries(data)) {
      const field = (fields ?? []).find((f) => f.name === key);
      if (!field) {
        out.add(`${where}"${key}"`);
        continue;
      }
      if (field.widget === "object") undeclared(value, field.fields, `${where}${key}.`, out);
      const itemFields = field.fields ?? (field.field?.widget === "object" ? field.field.fields : null);
      if (field.widget === "list" && itemFields && Array.isArray(value)) {
        for (const item of value) undeclared(item, itemFields, `${where}${key}[].`, out);
      }
    }
  };
  const blocks = (data) => (isLocaleFile(data) ? Object.values(data) : [data]);

  for (const collection of config.collections ?? []) {
    const entries = collection.files
      ? collection.files.map((file) => ({ path: file.file, fields: file.fields, label: file.file }))
      : (await readdir(path.join(root, collection.folder)).catch(() => []))
          .filter((f) => f.endsWith(".json"))
          .map((f) => ({ path: path.join(collection.folder, f), fields: collection.fields, label: collection.name }));
    const found = new Map();
    for (const entry of entries) {
      const data = JSON.parse(await readFile(path.join(root, entry.path), "utf8"));
      if (collection.i18n && config.i18n && !isLocaleFile(data)) {
        problems.push(`${entry.path}: not in the per-locale shape the CMS saves ({ <locale>: … })`);
      }
      const out = found.get(entry.label) ?? new Set();
      for (const block of blocks(data)) undeclared(block, entry.fields, "", out);
      found.set(entry.label, out);
    }
    for (const [label, keys] of found) {
      for (const key of keys) problems.push(`${label}: ${key} is not declared, so a save would drop it`);
    }
    if (collection.folder) notes.push(`${collection.name}: ${entries.length} files, ${collection.fields.length} declared fields`);
  }

  return { problems, notes, config, configPath };
}

async function validateAgainstSchema(config) {
  const { default: Ajv } = await import("ajv");
  const response = await fetch(SCHEMA_URL);
  if (!response.ok) throw new Error(`could not fetch the schema (${response.status})`);
  const schema = await response.json();
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const validate = ajv.compile(schema);
  if (validate(config)) return [];
  const seen = new Set();
  const out = [];
  for (const error of validate.errors) {
    const key = `${error.instancePath} ${error.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const allowed = error.params?.allowedValues ? ` (allowed: ${error.params.allowedValues.slice(0, 8).join(", ")})` : "";
    out.push(`${error.instancePath || "(root)"} ${error.message}${allowed}`);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, notes, config } = await checkCmsConfig();
  for (const note of notes) console.log(`  · ${note}`);
  for (const problem of problems) fail("config.yml", problem);

  if (process.argv.includes("--schema")) {
    try {
      const schemaProblems = await validateAgainstSchema(config);
      for (const problem of schemaProblems) fail("schema", problem);
      if (schemaProblems.length === 0) console.log("  · valid against the official Sveltia schema");
      problems.push(...schemaProblems);
    } catch (error) {
      console.error(`  ! schema validation skipped: ${error.message}`);
    }
  }

  if (problems.length) {
    console.error(`\n✗ cms: ${problems.length} problem(s)\n`);
    process.exit(1);
  }
  console.log("\n✓ cms: config valid\n");
}
