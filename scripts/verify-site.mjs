#!/usr/bin/env node
/**
 * Browser verification. A 200 response proves nothing, so this drives a real
 * Chromium against the built output and asserts observable behaviour.
 *
 *   bun run build && bun run verify
 *   bun run verify --shots      # also writes screenshots/ at 1440 and 390
 *
 * Exits non-zero on any failure. Add the site's own interactions (filters,
 * forms) at the end of main().
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { checkCmsConfig } from "./check-cms-config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.VERIFY_PORT ?? 4399);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WANT_SHOTS = process.argv.includes("--shots");
const SHOT_DIR = path.join(ROOT, "screenshots");
const VIEWPORTS = [320, 390, 1440];
// The production origin, from `site` in astro.config.mjs: links elsewhere are external.
const SITE = await readFile(path.join(ROOT, "astro.config.mjs"), "utf8")
  .then((text) => /\bsite:\s*["'`]([^"'`]+)/.exec(text)?.[1] ?? "")
  .catch(() => "");
const SITE_HOST = SITE ? new URL(SITE).host.replace(/^www\./, "") : "";

const CHROME = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean).find((candidate) => existsSync(candidate));

if (!CHROME) {
  console.error("No Chromium found. Set CHROME_PATH.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const problems = [];
const notes = [];
const fail = (route, message) => problems.push(`${route} :: ${message}`);

function startServer() {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
    const candidates = [path.join(DIST, pathname), `${path.join(DIST, pathname)}.html`];
    for (const candidate of candidates) {
      try {
        const info = await stat(candidate);
        const file = info.isDirectory() ? path.join(candidate, "index.html") : candidate;
        const body = await readFile(file);
        res.writeHead(200, {
          "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
        });
        res.end(body);
        return;
      } catch {
        // try the next candidate
      }
    }
    const body = await readFile(path.join(DIST, "404.html")).catch(() => Buffer.from("Not found"));
    res.writeHead(404, { "content-type": MIME[".html"] });
    res.end(body);
  });
  return new Promise((resolve, reject) => {
    server.once("error", (error) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(`port ${PORT} is in use (a preview server left running?). Stop it or set VERIFY_PORT.`)
          : error,
      ),
    );
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

/** Islands must actually hydrate — a rendered island that never wakes up is the
 *  single most common silent failure. */
async function waitForHydration(page, timeout = 8000) {
  await page
    .waitForFunction(
      () => {
        const islands = [...document.querySelectorAll("astro-island")];
        // No islands on this page: nothing to wait for.
        if (islands.length === 0) return true;
        return islands.every((el) => !el.hasAttribute("ssr"));
      },
      { timeout, polling: 100 },
    )
    .catch(() => {});
}

async function discoverRoutes() {
  const routes = new Set(["/"]);
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.name === "index.html") {
        if (full.startsWith(path.join(DIST, "admin"))) continue;
        const rel = path.relative(DIST, path.dirname(full));
        routes.add(rel === "" ? "/" : `/${rel.split(path.sep).join("/")}`);
      } else if (item.name === "404.html") {
        const rel = path.relative(DIST, path.dirname(full));
        routes.add(rel === "" ? "/404" : `/${rel.split(path.sep).join("/")}/404`);
      }
    }
  }
  if (existsSync(DIST)) await walk(DIST);
  return [...routes].sort();
}

/** In-page audit: structure, images, overflow, typography and colour. */
const AUDIT = () => {
  const out = {
    islands: 0,
    hydrated: 0,
    brokenImages: [],
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    h1Count: document.querySelectorAll("h1").length,
    headingJumps: [],
    longMeasures: [],
    contrastFailures: [],
    gradients: [],
    clippedText: [],
    thickEdges: [],
    borderAndShadow: [],
    radii: [],
    uppercaseCopy: [],
    transformedImages: [],
    animatedElements: [],
    letterSpacing: getComputedStyle(document.body).letterSpacing,
  };

  const islands = [...document.querySelectorAll("astro-island")];
  out.islands = islands.length;
  out.hydrated = islands.filter((el) => !el.hasAttribute("ssr")).length;

  for (const img of document.images) {
    if (!img.complete || img.naturalWidth === 0) out.brokenImages.push(img.currentSrc || img.src);
  }

  let previous = 0;
  for (const heading of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) {
      out.headingJumps.push(`${heading.tagName} after H${previous}: ${heading.textContent?.slice(0, 40)}`);
    }
    previous = level;
  }

  const parse = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(value);
    if (!match) return null;
    const parts = match[1].split(",").map((n) => Number.parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const backgroundOf = (el) => {
    let node = el;
    while (node) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.5) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const chCache = new Map();
  const chWidthOf = (style) => {
    const key = `${style.fontSize}|${style.fontFamily}|${style.fontWeight}|${style.letterSpacing}`;
    if (chCache.has(key)) return chCache.get(key);
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};letter-spacing:${style.letterSpacing}`;
    probe.textContent = "0".repeat(50);
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width / 50 || style.fontSize * 0.5;
    probe.remove();
    chCache.set(key, width);
    return width;
  };

  for (const el of document.querySelectorAll("p, li, figcaption, dd, dt, span, a, h1, h2, h3, h4")) {
    const text = (el.textContent ?? "").trim();
    if (text === "" || el.children.length > 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;

    const size = Number.parseFloat(style.fontSize);
    if (size < 13) out.longMeasures.push(`tiny text ${size}px: ${text.slice(0, 30)}`);

    const color = parse(style.color);
    if (color) {
      const bg = backgroundOf(el);
      const c = ratio(color, bg);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (c < (large ? 3 : 4.5)) {
        out.contrastFailures.push(`${c.toFixed(2)}:1 ${size}px “${text.slice(0, 30)}”`);
      }
    }

    if (style.textTransform === "uppercase" && text.includes(" ")) {
      out.uppercaseCopy.push(text.slice(0, 40));
    }

    if (el.tagName === "P" && text.length > 120) {
      const width = el.getBoundingClientRect().width;
      const ch = width / chWidthOf(style);
      if (ch > 78 && width > 300) out.longMeasures.push(`${ch.toFixed(0)}ch paragraph`);
    }

    // A gradient of one colour is a solid fill (often an animated underline).
    const stops = new Set(style.backgroundImage.match(/rgba?\([^)]+\)/g) ?? []);
    if (style.backgroundImage.includes("gradient") && stops.size > 1) {
      out.gradients.push(style.backgroundImage.slice(0, 60));
    }
    if (style.backgroundClip === "text") {
      out.clippedText.push(text.slice(0, 30));
    }

    const left = Number.parseFloat(style.borderLeftWidth) || 0;
    const top = Number.parseFloat(style.borderTopWidth) || 0;
    const borderColor = parse(style.borderLeftColor);
    if ((left >= 4 || top >= 4) && borderColor && borderColor.a > 0.3) {
      out.thickEdges.push(`${left}px/${top}px on ${el.tagName} “${text.slice(0, 24)}”`);
    }
  }

  for (const el of document.querySelectorAll("*")) {
    const style = getComputedStyle(el);
    const bw = Number.parseFloat(style.borderTopWidth) || 0;
    const shadow = style.boxShadow;
    if (bw > 0 && shadow !== "none") {
      let max = 0;
      for (const part of shadow.split(" ")) {
        if (part.endsWith("px")) max = Math.max(max, Number.parseFloat(part) || 0);
      }
      if (max > 16) out.borderAndShadow.push(`${el.tagName} ${shadow.slice(0, 50)}`);
    }
    const radius = style.borderTopLeftRadius;
    if (radius && radius !== "0px") out.radii.push(radius);
    if (style.animationName !== "none" && !el.classList.contains("status")) {
      out.animatedElements.push(`${el.tagName} ${style.animationName}`);
    }
  }

  // Hover transforms on images, read from the same-origin stylesheets.
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!rule.selectorText?.includes(":hover")) continue;
      if (!/scale\(|rotate\(|transform\s*:/.test(rule.style?.cssText ?? "")) continue;
      if (/img|image|figure|thumb|photo/i.test(rule.selectorText)) {
        out.transformedImages.push(rule.selectorText.slice(0, 60));
      }
    }
  }

  out.radii = [...new Set(out.radii)];

  return out;
};

async function auditRoute(page, route, viewport, { navigate = true } = {}) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  const onConsole = (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error) => pageErrors.push(error.message);
  const onRequestFailed = (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText}`);
  const onResponse = (response) => {
    const url = response.url();
    if (response.status() >= 400 && /\.(webp|png|jpe?g|svg|gif|avif)$/i.test(url)) {
      badResponses.push(`${response.status()} ${url}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  await page.setViewport({ width: viewport, height: 900 });
  if (navigate) {
    await page.goto(`${ORIGIN}${route}`, { waitUntil: "load", timeout: 30000 });
    // Force lazy images to load, then let them settle.
    await page.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 120));
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    await page.evaluate(() => document.fonts?.ready);
    await waitForHydration(page);
  } else {
    // Same document, narrower viewport: layout-only re-measure.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  }

  const audit = await page.evaluate(AUDIT);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);
  page.off("response", onResponse);

  for (const message of consoleErrors) fail(route, `console error: ${message}`);
  for (const message of pageErrors) fail(route, `page error: ${message}`);
  for (const message of failedRequests) fail(route, `request failed: ${message}`);
  for (const message of badResponses) fail(route, `image response: ${message}`);

  if (audit.islands !== audit.hydrated) {
    fail(route, `${audit.islands - audit.hydrated} island(s) did not hydrate`);
  }
  if (audit.brokenImages.length) fail(route, `broken images: ${audit.brokenImages.join(", ")}`);
  if (navigate && audit.h1Count !== 1) fail(route, `expected exactly one h1, found ${audit.h1Count}`);
  if (navigate && audit.headingJumps.length) {
    fail(route, `heading level skipped: ${audit.headingJumps.join("; ")}`);
  }
  if (audit.overflow) fail(route, `horizontal overflow at ${viewport}px`);
  if (navigate) {
    if (audit.contrastFailures.length) fail(route, `contrast: ${audit.contrastFailures.join("; ")}`);
    if (audit.longMeasures.length) fail(route, `typography: ${audit.longMeasures.join("; ")}`);
    if (audit.gradients.length) fail(route, `gradient: ${audit.gradients.join("; ")}`);
    if (audit.clippedText.length) fail(route, `background-clip text: ${audit.clippedText.join("; ")}`);
    if (audit.thickEdges.length) fail(route, `thick coloured edge: ${audit.thickEdges.join("; ")}`);
    if (audit.borderAndShadow.length) fail(route, `border and wide shadow: ${audit.borderAndShadow.join("; ")}`);
    if (audit.uppercaseCopy.length) fail(route, `uppercase copy: ${audit.uppercaseCopy.join("; ")}`);
    if (audit.transformedImages.length) fail(route, `image hover transform: ${audit.transformedImages.join("; ")}`);
    if (audit.animatedElements.length) fail(route, `animation: ${audit.animatedElements.join("; ")}`);
    if (audit.radii.length > 4) fail(route, `too many radii: ${audit.radii.join(", ")}`);
    const ls = Number.parseFloat(audit.letterSpacing);
    if (Number.isFinite(ls) && (ls < -1 || ls > 1)) fail(route, `body letter-spacing ${audit.letterSpacing}`);
  }

  return audit;
}

/** Interface text has no empty strings, and every locale has every key. */
async function auditDictionaries(i18n) {
  const file = path.join(ROOT, "content/copy.json");
  if (!existsSync(file)) return;
  const copy = JSON.parse(await readFile(file, "utf8"));
  const flatten = (node, prefix = "", out = new Map()) => {
    if (typeof node === "string") out.set(prefix, node.trim());
    else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  };
  const LOCALES = i18n?.locales;
  const blocks = LOCALES ? LOCALES.map((locale) => [locale, flatten(copy[locale] ?? {})]) : [["", flatten(copy)]];
  const [, base] = blocks[0];
  for (const [locale, keys] of blocks) {
    for (const [key, value] of keys) {
      if (value === "") fail("content/copy.json", `${locale ? `${locale}.` : ""}${key} is empty`);
    }
    for (const key of base.keys()) {
      if (!keys.has(key)) fail("content/copy.json", `${locale}.${key} is missing`);
    }
  }
  notes.push(`dictionaries: ${base.size} keys${LOCALES ? ` × ${LOCALES.length} locales` : ""}`);
}

/** The CMS config must stay valid, and must declare every content field. */
async function auditCms() {
  const result = await checkCmsConfig({ root: ROOT });
  for (const problem of result.problems) fail("public/admin/config.yml", problem);
  for (const cmsNote of result.notes) notes.push(cmsNote);
  return result.config;
}

/** robots.txt must exist and point at the sitemap, and the sitemap must not
 *  carry the `noindex` 404 pages. */
async function auditSeo() {
  const robots = path.join(DIST, "robots.txt");
  if (!existsSync(robots)) {
    fail("robots.txt", "missing from the build");
  } else {
    const text = await readFile(robots, "utf8");
    if (!/^Sitemap:\s*https?:\/\/\S+/m.test(text)) {
      fail("robots.txt", "has no absolute Sitemap: line");
    }
    if (!/^Disallow:\s*\/admin\//m.test(text)) {
      fail("robots.txt", "does not disallow /admin/");
    }
  }

  const sitemap = path.join(DIST, "sitemap-0.xml");
  if (!existsSync(sitemap)) {
    fail("sitemap", "sitemap-0.xml not found in the build");
    return;
  }
  const xml = await readFile(sitemap, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const noindex = urls.filter((url) => /\/404\/?$/.test(url));
  if (noindex.length) fail("sitemap", `contains noindex pages: ${noindex.join(", ")}`);
  else notes.push(`sitemap: ${urls.length} urls, no 404 pages`);
}

async function main() {
  if (!existsSync(DIST)) {
    console.error("dist/ not found. Run `bun run build` first.");
    process.exit(1);
  }

  const config = await auditCms();
  await auditDictionaries(config.i18n);
  await auditSeo();

  const server = await startServer();
  const routes = await discoverRoutes();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  let audited = 0;
  const internalLinks = new Set();
  // Every page carries the header links the home page has, in its own locale.
  // Links to another locale (a language switch) differ per page, so are left out.
  const others = (config.i18n?.locales ?? []).filter((l) => l !== config.i18n?.default_locale);
  const trim = (href) => href.replace(/(.)\/$/, "$1");
  const localeOf = (route) => others.find((l) => route === `/${l}` || route.startsWith(`/${l}/`));
  const localise = (href, locale) => (locale ? (href === "/" ? `/${locale}` : `/${locale}${href}`) : href);
  let navHrefs = null;
  const page = await browser.newPage();

  for (const route of routes) {
    // One navigation per route; narrower viewports only re-measure layout.
    try {
      await auditRoute(page, route, 1440, { navigate: true });
      await auditRoute(page, route, 320, { navigate: false });
      await auditRoute(page, route, 390, { navigate: false });

      const found = await page.evaluate(() => ({
        links: [...document.querySelectorAll("a[href]")].map((a) => ({
          href: a.getAttribute("href"),
          blank: a.target === "_blank",
          noopener: /noopener/.test(a.rel),
        })),
        nav: [...document.querySelectorAll("header a[href]")].map((a) => a.getAttribute("href")),
        og: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
      }));
      const isOwn = (url) => SITE_HOST !== "" && new URL(url).host.replace(/^www\./, "") === SITE_HOST;
      for (const { href, blank, noopener } of found.links) {
        if (href?.startsWith("/")) internalLinks.add(href.split("#")[0]);
        // Links out of the site open in a new tab; links within it don't.
        if (/^https?:\/\//.test(href ?? "") && !isOwn(href) && !(blank && noopener)) {
          fail(route, `external link without target="_blank" rel="noopener": ${href}`);
        }
        if (href?.startsWith("/") && blank && !/\.(pdf|jpe?g|png|webp)$/i.test(href)) {
          fail(route, `internal page opens in a new tab: ${href}`);
        }
      }
      // The social card must resolve too; it is often generated at build time.
      if (/^https?:\/\//.test(found.og) && isOwn(found.og)) internalLinks.add(new URL(found.og).pathname);

      const nav = found.nav.map(trim);
      navHrefs ??= nav.filter((href) => href.startsWith("/") && !localeOf(href));
      for (const target of navHrefs.map((href) => localise(href, localeOf(route)))) {
        if (!nav.includes(target)) fail(route, `nav link missing: ${target}`);
      }

      if (WANT_SHOTS) {
        await mkdir(SHOT_DIR, { recursive: true });
        const name = route === "/" ? "home" : route.replaceAll("/", "-").replace(/^-/, "");
        await page.setViewport({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(SHOT_DIR, `${name}-1440.png`), fullPage: true });
        await page.setViewport({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(SHOT_DIR, `${name}-390.png`), fullPage: true });
      }
    } catch (error) {
      fail(route, `audit crashed: ${error.message}`);
    }

    audited += 1;
  }

  // Internal links must not 404. Checked over HTTP rather than by navigating,
  // so the crawl stays cheap.
  for (const href of [...internalLinks].sort()) {
    const response = await fetch(`${ORIGIN}${href}`).catch(() => null);
    const status = response?.status ?? 0;
    if (status >= 400 && !trim(href).endsWith("/404")) {
      fail(href, `internal link returned ${status}`);
    }
  }

  // Interactions. Add the site's own (filters, forms) here.
  const interactions = await browser.newPage();
  await interactions.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await interactions.setViewport({ width: 390, height: 844 });
  const mobileNav = await interactions.evaluate(async () => {
    // The mobile menu is a <details> in the header.
    const details = [...document.querySelectorAll("header details")].find(
      (el) => el.getBoundingClientRect().height > 0,
    );
    const summary = details?.querySelector("summary");
    if (!details || !summary) return { found: false };
    details.open = true;
    await new Promise((resolve) => setTimeout(resolve, 80));

    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
    };
    const panel = box(details.querySelector(":scope > :not(summary)"));
    const button = box(summary);
    const brand = box(document.querySelector('header a[href="/"]') ?? summary);
    const covers = (a, b) =>
      !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);

    const links = [...details.querySelectorAll("a")].filter(
      (a) => a.getBoundingClientRect().height > 0,
    );
    return {
      found: true,
      open: details.open,
      visibleLinks: links.length,
      panelOffscreen: panel.top < 0,
      panelAboveButton: panel.top < button.bottom - 1,
      panelCoversBrand: covers(panel, brand),
      panel,
      button,
    };
  });
  if (!mobileNav.found) notes.push("mobile nav: no <details> menu in the header at 390px");
  else if (!mobileNav.open || mobileNav.visibleLinks === 0) {
    fail("/", `mobile nav did not reveal links (${JSON.stringify(mobileNav)})`);
  } else if (mobileNav.panelOffscreen) {
    fail("/", `mobile menu list starts off-screen (top ${mobileNav.panel.top}px)`);
  } else if (mobileNav.panelAboveButton) {
    fail(
      "/",
      `mobile menu list starts at ${mobileNav.panel.top}px, above the ${mobileNav.button.bottom}px bottom of its toggle`,
    );
  } else if (mobileNav.panelCoversBrand) {
    fail("/", "mobile menu list covers the logo");
  } else {
    notes.push(`mobile nav: ${mobileNav.visibleLinks} links, list below the bar`);
  }

  // Planting map: hovering a place names it, and the key filters by group.
  await interactions.setViewport({ width: 1440, height: 900 });
  await interactions.goto(`${ORIGIN}/grows/`, { waitUntil: "load" });
  await interactions.waitForSelector("astro-island:not([ssr])", { timeout: 5000 }).catch(() => {});
  const place = await interactions.$('.bands [data-id]:not([data-id="."])');
  if (!place) fail("/grows/", "planting map has no places");
  else {
    await place.hover();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const tip = await interactions.$eval(".tip", (el) => el.textContent.trim()).catch(() => "");
    if (!tip) fail("/grows/", "hovering a place on the planting map shows no label");
    const keys = await interactions.$$(".legend button[aria-pressed]");
    if (keys.length === 0) fail("/grows/", "planting map key has no group buttons");
    else {
      await keys[0].click();
      // The marks fade in a sweep across each band; let it finish.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const faded = await interactions.$$eval(".bands [data-id]", (rects) =>
        rects.filter((r) => Number(getComputedStyle(r).opacity) < 0.5).length,
      );
      const pressed = await keys[0].evaluate((el) => el.getAttribute("aria-pressed"));
      if (pressed !== "true" || faded === 0) fail("/grows/", "planting map key does not filter");
      else notes.push(`planting map: label on hover, key filter fades ${faded} places`);
    }
  }

  // Photo viewer: opens on a photo, steps with the arrow keys, closes on Escape.
  await interactions.goto(`${ORIGIN}/photos/`, { waitUntil: "load" });
  await interactions.waitForSelector("astro-island:not([ssr])", { timeout: 5000 }).catch(() => {});
  const thumbs = await interactions.$$("main .year button");
  if (thumbs.length === 0) fail("/photos/", "no photo buttons");
  else {
    const state = () =>
      interactions.$eval("dialog", (d) => ({ open: d.open, label: d.getAttribute("aria-label") ?? "" }));
    await thumbs[0].click();
    const opened = await state();
    await interactions.keyboard.press("ArrowRight");
    const stepped = await state();
    await interactions.keyboard.press("Escape");
    const closed = await state();
    if (!opened.open) fail("/photos/", "photo viewer did not open");
    else if (stepped.label === opened.label) fail("/photos/", "arrow key did not move to the next photo");
    else if (closed.open) fail("/photos/", "Escape did not close the photo viewer");
    else notes.push("photo viewer: opens, steps with arrow keys, closes on Escape");
  }

  // Planting map: finding a kind names where it grows.
  await interactions.goto(`${ORIGIN}/grows/`, { waitUntil: "load" });
  await interactions.waitForSelector("astro-island:not([ssr])", { timeout: 5000 }).catch(() => {});
  const kind = await interactions.$eval("#find-kind option:nth-child(2)", (o) => o.value).catch(() => "");
  if (!kind) fail("/grows/", "find-a-kind list is empty");
  else {
    await interactions.select("#find-kind", kind);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const found = await interactions.$eval(".found", (el) => el.textContent.trim());
    if (!found) fail("/grows/", "finding a kind shows no result");
    else notes.push(`find a kind: “${found}”`);
  }

  // Story: a topic shows its entries alone, and the count says so.
  await interactions.goto(`${ORIGIN}/story/`, { waitUntil: "load" });
  const topics = await interactions.$$(".topics button[data-topic]");
  if (topics.length < 2) fail("/story/", "story has no topic switches");
  else {
    const before = await interactions.$eval(".shown", (el) => el.textContent.trim());
    await topics[1].click();
    const after = await interactions.$eval(".shown", (el) => el.textContent.trim());
    const hidden = await interactions.$$eval(".entry[hidden]", (els) => els.length);
    if (before === after || hidden === 0) fail("/story/", "topic switch does not filter the story");
    else notes.push(`story topics: “${after}”`);
  }

  // Home: the then-and-now slider moves the line.
  await interactions.goto(`${ORIGIN}/`, { waitUntil: "load" });
  const slider = await interactions.$("[data-then-now] input");
  if (!slider) fail("/", "then-and-now slider missing");
  else {
    await slider.focus();
    for (let i = 0; i < 5; i++) await interactions.keyboard.press("ArrowRight");
    const pos = await interactions.$eval("[data-then-now]", (el) => el.style.getPropertyValue("--pos"));
    if (pos !== "55%") fail("/", `then-and-now slider did not move (${pos})`);
    else notes.push("then-and-now slider moves with the arrow keys");
  }

  await interactions.close();

  // The CMS admin must render its login screen with a valid config.yml.
  const adminPage = await browser.newPage();
  const adminErrors = [];
  adminPage.on("console", (message) => {
    if (message.type() === "error") adminErrors.push(message.text());
  });
  adminPage.on("pageerror", (error) => adminErrors.push(`pageerror: ${error.message}`));
  await adminPage.goto(`${ORIGIN}/admin/`, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const admin = await adminPage.evaluate(() => {
    const el = document.querySelector("sveltia-cms, [class*=sveltia], div");
    const text = (document.body.innerText || "").trim();
    return { hasApp: Boolean(el), text: text.slice(0, 400) };
  });
  for (const message of adminErrors) fail("/admin/", `console error: ${message}`);
  if (!admin.hasApp) fail("/admin/", "admin app did not mount");
  if (/error loading|failed to load config|invalid config|configuration error/i.test(admin.text)) {
    fail("/admin/", `config error shown: ${admin.text.slice(0, 160)}`);
  } else {
    notes.push(`admin: mounted, text starts “${admin.text.slice(0, 60)}”`);
  }
  await adminPage.close();

  await page.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  console.log(`\nAudited ${audited} routes at ${VIEWPORTS.join("/")}px`);
  for (const note of notes) console.log(`  · ${note}`);
  if (problems.length === 0) {
    console.log("\n✓ verify: all checks passed\n");
    process.exit(0);
  }
  console.log(`\n✗ verify: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.log(`  - ${problem}`);
  console.log("");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
