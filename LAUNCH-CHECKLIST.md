# Launch checklist

Questions for the owner and steps left before the site goes live.

## Decisions

- [ ] **Domain.** The site is set up for `madilufarms.pages.dev`. If there's a
      domain, set `site` in `astro.config.mjs`, `site_url` and `display_url` in
      `public/admin/config.yml`, and the auth worker's `ALLOWED_DOMAINS`.
- [ ] **How visitors get in touch**, if at all: an email address, a form, or
      nothing. The site has no contact details now, by choice: no phone numbers.
- [ ] **Link to Bhoomi Seva?** Lakshmi is on that site's team. A link either way
      is one line in the footer or on the About page.

## Content to confirm

- [ ] **Exact map pin.** The About page links to a Google Maps search for
      Tenginamaradoddi, Kanakapura. Paste a pin for the farm gate into Site ›
      Settings › Map pin.
- [ ] **Corrected planting map.** The map on the site is the one from 7 June
      2026. On 14 June Mahesh said it missed a cross line of coconut after the
      wood apple, and that he would redo it. When the new map comes, update
      Planting map in the CMS. The counts on the home and What grows pages
      follow it.
- [ ] **"Bendi" on the map** is shown as okra. The map has it as a 6 × 7 block at
      the front among the trees, so it may be the bende (Portia) tree instead.
- [ ] **"Elakki"** is listed as a fruit tree. If it's yelakki banana, move it to
      the Banana group in Site › Plants.
- [ ] **English names** for hebbevu, shivane, honne, beete, agase, bath ele and
      patte bath ele, which the English pages show by their Kannada names.
- [ ] **The school** that got the papaya harvest in June 2025: name it on the
      Farming page, or leave it as "a school".
- [ ] **The cows' names**, if they should appear on the Farming page.

## Before launch

- [ ] Create the GitHub repository `hamb1y/madilu` and push.
- [ ] Deploy the Sveltia auth worker and set `backend.base_url` in
      `public/admin/config.yml` (DEVELOPING.md, "Auth worker"). Without it, the
      CMS can't sign anyone in.
- [ ] Add editors as collaborators on the repository.
- [ ] Connect Cloudflare Pages to the repository: build
      `bun run check && bun run build`, output `dist`, `BUN_VERSION` 1.4.2.
- [ ] After the first deploy, request every route on the live domain and take a
      screenshot of the home page.

## Housekeeping

- [ ] TypeScript is pinned to 6 because `astro check` doesn't support 7 yet.
      Lift the pin when it does.
