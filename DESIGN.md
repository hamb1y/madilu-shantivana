# Design

Paper and ink, a serif with character for headings, one colour per section.
The farm's own photos carry the pages.

## Tokens (`src/styles/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6efe2` | page background |
| `--paper-2` | `#efe5d2` | footer, quiet panels |
| `--ink` | `#2a2118` | text |
| `--ink-2` | `#5e5247` | secondary text, captions |
| `--rule` | `#d9ccb4` | rules |
| `--rule-strong` | `#a8977a` | borders on controls |

One accent per section. Each one passes 4.5:1 on paper, and paper text passes
4.5:1 on it. `data-section` on `<body>` or any element sets `--accent`.

| Section | Token | Value |
| --- | --- | --- |
| Story | `--story` | `#a3401e` terracotta |
| What grows | `--grows` | `#2f6b2a` leaf green |
| Farming | `--farming` | `#7a5a12` turmeric brown |
| Photos | `--photos` | `#2f5d7a` monsoon blue |
| About | `--about` | `#6b2f5a` jamun |

The planting map colours live with the plant groups in `content/plants.json`.
They colour map marks and table swatches only, never text.

Type: Young Serif for headings, Source Sans 3 for everything else, with Noto
Serif Kannada and Noto Sans Kannada for Kannada. Numbers use the body face with
`tabular-nums`. Kannada text gets a taller line height (1.75).

Scale: `--step--1` to `--step-5`, fluid from step 2 up. Spacing: `--s-1` to
`--s-9`. Gutter 16px on phones, up to 48px. Text measure 66ch. One radius
(`--radius`, 4px).

## Patterns

- A page head: a large h1 in the section colour, then one lead paragraph with a
  real figure in it.
- Facts as label / large value / note.
- The story as a timeline under large year headings; the year sticks beside the
  entries on wide screens.
- A story card without a photo is a solid block in the story colour with the day
  large.
- Then and now: the same ground two years apart, labelled by month.
- The planting map: one cell per planting place, coloured by group; empty pits
  as outlines, the helper's house filled in ink. Tap or hover for the kind and
  its place. The key filters by group.
- Pages end with onward tiles, one per other page, each a solid block in that
  page's colour with a line of real data.
- The footer lists every page and the language switch.
- Navigation and switches are underlined text; the current page is underlined
  in its own section colour.
- Hyphenated words in titles don't break (`.nowrap`).

## Banned

Inter, Geist or system-only fonts; monospace or novelty fonts; purple or blue
gradients; gradient text; glassmorphism; glows; nested cards; icon tiles above
headings; marquees; pulsing dots; bounce easing; hover image zoom; numbered
01/02/03 markers; all-caps text or eyebrows; a rule above every block; CSS
animations; more than four radii; pills, chips, badges or dots before text;
labels that repeat the heading they sit on; filler copy; decorative watermarks.
