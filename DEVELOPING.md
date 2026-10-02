# Developing

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Astro 7, static output; Svelte 5 islands for the planting map and the photo viewer; small inline scripts for the rest |
| Styling | Plain CSS; tokens in `src/styles/tokens.css` |
| Icons | `lucide-astro`, `lucide-svelte` |
| Fonts | Fontsource, self-hosted: Fraunces, Source Sans 3, Noto Sans Kannada, Noto Serif Kannada |
| Content | JSON in `content/` |
| CMS | Sveltia CMS at `/admin/`, GitHub backend |
| Hosting | Cloudflare Pages |
| Runtime | Bun 1.4.2 |

TypeScript is pinned to 6 because `astro check` does not support TypeScript 7
yet. Lift the pin once it does.

## Commands

```bash
bun install
bun run dev          # http://localhost:4323
bun run check        # astro check; must report 0 errors, warnings and hints
bun run build        # static site in dist/
bun run verify       # serves dist/ on 4399 and checks every page in Chromium
bun run cms          # checks public/admin/config.yml against the content
bun run cms --schema # ...and against the official Sveltia schema (needs network)
bun run cms:copy     # regenerates the CMS fields for content/copy.json
bun run images       # resizes photos in public/images to WebP, plus 800px copies
```

Before calling a change done: `check`, `build`, `verify`. Stop the dev or
preview server first if it holds port 4399 (`ss -ltnp | grep 4399`). Set
`CHROME_PATH` if Chromium isn't at `/usr/bin/chromium`.

## Structure

```
content/
  settings.json   name, tagline, location, map links, nav, logo, credit
  copy.json       interface text, one block per language
  pages.json      page introductions, facts, story chapters, crops, practices,
                  the farming flow, people, page photos
  topics.json     story topics (planting, water, harvest…); entries pick one
  photos.json     every photo: id, file, description, date
  plants.json     plant groups (with map colours) and kinds
  plot.json       the planting map, one line of kinds per row (not translated)
  events/         one story entry per file, named <date>-<slug>.json
public/
  admin/          Sveltia CMS (index.html, config.yml)
  images/         photos as WebP, each with an -800 copy
src/
  data/load.ts    typed loader for everything in content/
  data/locales.mjs  turns { en: {…}, kn: {…} } files into per-field values
  i18n/           ui.ts (copy.json → typed keys), utils.ts (t, lx, localePath, dates)
  lib/            nav.ts (page → path), onward.ts (data lines for onward tiles)
  layouts/Base.astro
  components/     HeroScene (the drawn farm), ThenNow (slider), Chapters
                  (story bands), FlowDiagram, Facts, Timeline, EventCard,
                  Figure, Onward, Header, Footer, PlotMap.svelte,
                  PhotoGrid.svelte
  views/          one view per page, shared by both languages
  pages/          thin routes; kn/ repeats them with lang="kn"
scripts/          verify-site, check-cms-config, copy-fields, optimize-images
```

## Languages

English is the default and unprefixed; Kannada lives under `/kn/`. Build every
internal link with `localePath()` and read every content field with
`lx(value, lang)`, which falls back to English. Interface text comes from
`t(lang, key, vars)`; placeholders like `{count}` are filled in from the
content. Dates are formatted from the month tables in `src/i18n/utils.ts`, not
`Intl`.

## Content and the CMS

Everything visible comes from `content/`. The CMS saves files in the shape
`{ "en": {…}, "kn": {…} }`; `mergeLocales()` reads them. Every key in every file
must be declared in `public/admin/config.yml`, or the CMS drops it on save:
`bun run cms` checks this, and `bun run verify` runs the same check.

After adding or removing a key in `copy.json`, run `bun run cms:copy` and then
`bun run cms --schema`.

The home page's story chapters each cover a span of dates; the story entries
in that span that have a photo become its moments. The home page's "since"
date drives the live day count under the farm's name. Each step in the farming
flow names the practice that explains it by its `id`.

Photos are listed once in `content/photos.json`; pages and story entries pick
them by id. To add one: put the file in `public/images`, run `bun run images`,
then add it to the list with its date and a description.

The planting map in `content/plot.json` has one line per row, with places
separated by commas from the road side. Each place is a kind id from
`plants.json`, `empty` (a pit with nothing in it), `house` (the helper's house)
or `.` (no pit). The counts on the What grows page and the home page come from
this file.

Editors are GitHub users with write access to the repository. To add one, add
them as a collaborator.

### Auth worker

The CMS signs editors in with GitHub through a small Cloudflare Worker,
[sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth). Its copy lives
in the private repository `hamb1y/madilu-cms-auth` (the `upstream` remote is
Sveltia's) and runs at https://madilu-cms-auth.rishi-s-malnad.workers.dev.
`backend.base_url` in `public/admin/config.yml` points there.

- `ALLOWED_DOMAINS` in its `wrangler.toml` lists every hostname that serves
  `/admin/`: `madilushantivana.org`, `www.madilushantivana.org` and
  `madilu-shantivana.pages.dev`. Deploy with `wrangler deploy` after changing
  it.
- The GitHub OAuth app ("Madilu Shantivana CMS", created at
  github.com/settings/applications/new) has the callback
  `https://madilu-cms-auth.rishi-s-malnad.workers.dev/callback`.
- Its Client ID and client secret are the worker secrets `GITHUB_CLIENT_ID`
  and `GITHUB_CLIENT_SECRET`. Set them in the Cloudflare dashboard (Workers &
  Pages → `madilu-cms-auth` → Settings → Variables and Secrets, type Secret),
  or from the worker's folder with `wrangler secret put GITHUB_CLIENT_ID`,
  which asks for the value.

- To check it: `/auth?provider=github&site_id=madilushantivana.org` redirects
  to GitHub with a `client_id`, another `site_id` is refused, and `/callback`
  responds.

If the worker URL changes, update `base_url`; editors hard-reload `/admin/`
afterwards.

Locally, open http://localhost:4323/admin/index.html and choose "Work with Local
Repository".

## Deploy

The code is at https://github.com/hamb1y/madilu-shantivana. The Cloudflare
Pages project `madilu-shantivana` builds every push to `main` and serves it at
https://madilu-shantivana.pages.dev:

- Build command: `bun run check && bun run build`
- Output directory: `dist`
- Environment variables: `BUN_VERSION` = `1.4.2` (the local `bun --version`),
  `NODE_VERSION` = `24`

There's no Wrangler config in this repository, so manage the project with the
`cf` CLI, for example `cf pages deployments list --project-name
madilu-shantivana`.

The site's domain is `madilushantivana.org` (`site` in `astro.config.mjs`,
`site_url` in the CMS config). It and `www.madilushantivana.org` are custom
domains on the Pages project, each a proxied CNAME to
`madilu-shantivana.pages.dev` in the domain's Cloudflare zone. After a deploy, request every route and take a
screenshot of the home page against the live domain.

Editors commit through the CMS, so run `git pull --rebase` before pushing and
keep their content when resolving conflicts.
