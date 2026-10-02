# Rules for agents

Read DEVELOPING.md and DESIGN.md first.

## Content

- Never invent people, quotes, figures, dates or photos. If something isn't in
  the source, leave it out. Empty is fine.
- Name only Santhosh K, Lakshmi and Mahesh. Advisors, builders, suppliers and
  neighbours are not named.
- No phone numbers, prices, bills, payments or bank details anywhere on the
  site.
- Never identify children.
- State facts plainly, with no hedging ("so far", "around", "to be confirmed").
- When editing copy, don't change what it means.
- Every visible field needs English and Kannada. Keep the Kannada in step when
  you change the English.

## Code

- Nothing visible is hardcoded in a view. Text goes in `content/copy.json` (then
  `bun run cms:copy`), page content in `content/pages.json`, lists of kinds in
  their own content file.
- Every new content key is declared in `public/admin/config.yml`. `bun run cms`
  must pass.
- Build internal links with `localePath()` and read fields with `lx()`.
- Routes in `src/pages` stay thin; pages live in `src/views`.
- Follow DESIGN.md, including the banned list.

## Before you say it's done

1. Screenshot every visual change at 1440 and 390 wide and look at it.
2. `bun run check` (0 errors, warnings and hints), `bun run build`,
   `bun run verify`.
3. Commit, push or deploy only when asked.
