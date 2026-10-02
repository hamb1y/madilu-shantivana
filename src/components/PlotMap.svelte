<script lang="ts">
  /**
   * The planting map, drawn from the hand-made sheets: one block per sheet, one
   * mark per planting place, its shape and colour by group. On a phone each
   * block stands as on paper, rows running down and the nine places across; on
   * a wider screen it is turned a quarter left, so row 1 is on the left and
   * place 1 at the bottom. Hover or tap a mark for what grows there; pick a
   * group or the empty pits in the key, or a kind in the list, to show it alone.
   * The table after the map lists the same data.
   */
  import { onMount } from "svelte";

  interface Group {
    id: string;
    name: string;
    color: string;
    count: number;
  }

  interface Block {
    name: string;
    rows: string[][];
    /** "42 rows · 314 planted · 21 empty pits" */
    stats: string;
  }

  interface Props {
    blocks: Block[];
    kinds: Record<string, { name: string; group: string }>;
    groups: Group[];
    labels: {
      key: string;
      showAll: string;
      empty: string;
      house: string;
      mapLabel: string;
      /** "Row {row}, place {place}" */
      place: string;
      find: string;
      everyKind: string;
      /** "{name}: {count} places" */
      found: string;
      /** "{block}, rows {from} to {to}: {count}" */
      foundIn: string;
      groupsTitle: string;
    };
  }

  let { blocks, kinds, groups, labels }: Props = $props();

  const CELL = 20;
  /** Room for the row numbers beside a block. */
  const AXIS = 24;
  const places = $derived(Math.max(...blocks.flatMap((block) => block.rows.map((row) => row.length))));
  const longest = $derived(Math.max(...blocks.map((block) => block.rows.length)));
  const colour = $derived(Object.fromEntries(groups.map((g) => [g.id, g.color])));
  const groupName = $derived(Object.fromEntries(groups.map((g) => [g.id, g.name])));
  const total = $derived(groups.reduce((sum, g) => sum + g.count, 0));
  const emptyCount = $derived(blocks.reduce((sum, block) => sum + block.rows.flat().filter((id) => id === "empty").length, 0));

  /** The helper's house, one run of cells in a place, drawn as one block. */
  function houses(rows: string[][]) {
    const out: { place: number; from: number; length: number }[] = [];
    for (let p = 0; p < places; p++) {
      for (let r = 0; r < rows.length; r++) {
        if (rows[r][p] !== "house") continue;
        const from = r;
        while (r + 1 < rows.length && rows[r + 1][p] === "house") r++;
        out.push({ place: p, from, length: r - from + 1 });
      }
    }
    return out;
  }

  /** Where each kind grows, block by block: how many places, first and last row. */
  const spread = $derived.by(() => {
    const out = new Map<string, { block: string; count: number; from: number; to: number }[]>();
    blocks.forEach((block) => {
      block.rows.forEach((row, r) => {
        for (const id of row) {
          if (!kinds[id]) continue;
          const list = out.get(id) ?? [];
          let seen = list.find((s) => s.block === block.name);
          if (!seen) list.push((seen = { block: block.name, count: 0, from: r + 1, to: r + 1 }));
          seen.count++;
          seen.to = r + 1;
          out.set(id, list);
        }
      });
    });
    return out;
  });
  const kindList = $derived(
    [...spread.keys()].map((id) => ({ id, name: kinds[id].name })).sort((a, b) => a.name.localeCompare(b.name)),
  );

  let only = $state<string | null>(null);
  let pick = $state("");
  let tip = $state<{ left: number; top: number; title: string; detail: string; place: string } | null>(null);
  let wrap: HTMLDivElement | undefined = $state();
  let waiting = $state<boolean[]>([]);

  const found = $derived.by(() => {
    const where = spread.get(pick);
    if (!pick || !where) return null;
    const count = where.reduce((sum, w) => sum + w.count, 0);
    return {
      head: labels.found.replace("{name}", kinds[pick].name).replace("{count}", String(count)),
      where: where.map((w) =>
        labels.foundIn
          .replace("{block}", w.block)
          .replace("{from}", String(w.from))
          .replace("{to}", String(w.to))
          .replace("{count}", String(w.count)),
      ),
    };
  });

  // Marks by group. A group added later in the CMS gets a circle.
  const SHAPES: Record<string, string> = {
    kitchen: "square",
    fruit: "circle",
    palms: "star",
    timber: "triangle",
    banana: "diamond",
  };

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const star = (() => {
    const points: string[] = [];
    for (let i = 0; i < 12; i++) {
      const radius = i % 2 === 0 ? 9.5 : 3.6;
      const angle = (Math.PI / 6) * i - Math.PI / 2;
      points.push(`${r1(Math.cos(angle) * radius)} ${r1(Math.sin(angle) * radius)}`);
    }
    return `M ${points.join(" L ")} Z`;
  })();

  /** A mark centred on 0 0, about 18 units across. */
  function glyph(shape: string): string {
    switch (shape) {
      case "square":
        return "M -7 -7 H 7 V 7 H -7 Z";
      case "triangle":
        return "M 0 -9 L 8.5 7.5 L -8.5 7.5 Z";
      case "diamond":
        return "M 0 -9.5 L 9.5 0 L 0 9.5 L -9.5 0 Z";
      case "star":
        return star;
      case "ring":
        return "M -7 0 A 7 7 0 1 0 7 0 A 7 7 0 1 0 -7 0 Z";
      default:
        return "M -8 0 A 8 8 0 1 0 8 0 A 8 8 0 1 0 -8 0 Z";
    }
  }

  function groupOf(id: string): string | null {
    return kinds[id]?.group ?? null;
  }

  function shapeOf(id: string): string {
    if (id === "empty") return "ring";
    return SHAPES[groupOf(id) ?? ""] ?? "circle";
  }

  function fill(id: string): string {
    if (id === "empty") return "none";
    return colour[groupOf(id) ?? ""] ?? "var(--rule-strong)";
  }

  function dimmed(id: string): boolean {
    if (pick) return id !== pick;
    if (only === "empty") return id !== "empty";
    return only !== null && groupOf(id) !== only;
  }

  /** Where a cell sits: across, rows run left to right with place 1 at the bottom. */
  function at(across: boolean, r: number, p: number): string {
    return across
      ? `translate(${r * CELL + CELL / 2} ${(places - 1 - p) * CELL + CELL / 2})`
      : `translate(${p * CELL + CELL / 2} ${r * CELL + CELL / 2})`;
  }

  const numbered = (r: number) => r === 0 || (r + 1) % 5 === 0;

  function show(event: PointerEvent) {
    const target = event.target as SVGElement;
    const { row, place, id, block } = target.dataset ?? {};
    if (!row || !place || !id || !wrap) return;
    const box = wrap.getBoundingClientRect();
    const cell = target.getBoundingClientRect();
    const half = Math.min(120, box.width / 2);
    const centre = cell.left + cell.width / 2 - box.left;
    const kind = kinds[id];
    tip = {
      left: Math.min(Math.max(centre, half), box.width - half),
      top: cell.top - box.top,
      title: kind?.name ?? (id === "house" ? labels.house : labels.empty),
      detail: kind ? (groupName[kind.group] ?? "") : "",
      place: `${blocks[Number(block)].name} · ${labels.place.replace("{row}", row).replace("{place}", place)}`,
    };
  }

  function hide(event: PointerEvent) {
    if (event.pointerType !== "touch") tip = null;
  }

  function toggle(id: string) {
    only = only === id ? null : id;
    pick = "";
  }

  // Blocks below the fold are planted, row after row, as they come into view.
  onMount(() => {
    if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = [...wrap.querySelectorAll<HTMLElement>(".block")];
    waiting = nodes.map((node) => node.getBoundingClientRect().top > innerHeight * 0.8);
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          waiting[nodes.indexOf(entry.target as HTMLElement)] = false;
          watch.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    nodes.forEach((node, i) => waiting[i] && watch.observe(node));
    return () => watch.disconnect();
  });
</script>

{#snippet field(block: Block, b: number, across: boolean)}
  {@const rows = block.rows}
  <svg
    class={across ? "across" : "down"}
    viewBox={across
      ? `0 0 ${rows.length * CELL} ${places * CELL + AXIS}`
      : `${-AXIS} 0 ${places * CELL + AXIS} ${rows.length * CELL}`}
    style:--share={across ? `${((rows.length / longest) * 100).toFixed(2)}%` : undefined}
    aria-hidden="true"
    onpointerover={show}
    onpointerdown={show}
    onpointerleave={hide}
  >
    {#each rows as _, r (r)}
      {#if numbered(r)}
        <text
          class="tick"
          x={across ? r * CELL + CELL / 2 : -8}
          y={across ? places * CELL + 17 : r * CELL + CELL / 2 + 4}
          text-anchor={across ? "middle" : "end"}>{r + 1}</text
        >
      {/if}
    {/each}
    {#each houses(rows) as house (house.place * 1000 + house.from)}
      <rect
        class="mark"
        class:dim={pick !== "" || (only !== null && only !== "house")}
        x={across ? house.from * CELL + 2 : house.place * CELL + 2}
        y={across ? (places - 1 - house.place) * CELL + 2 : house.from * CELL + 2}
        width={across ? house.length * CELL - 4 : CELL - 4}
        height={across ? CELL - 4 : house.length * CELL - 4}
        fill="var(--ink)"
        style:--r={house.from}
        data-id="house"
        data-block={b}
        data-row={`${house.from + 1}–${house.from + house.length}`}
        data-place={house.place + 1}
      />
    {/each}
    {#each rows as row, r (r)}
      {#each row as id, p (p)}
        {#if id !== "." && id !== "house"}
          <g transform={at(across, r, p)}>
            <path
              class="mark"
              class:dim={dimmed(id)}
              class:picked={pick !== "" && id === pick}
              d={glyph(shapeOf(id))}
              fill={fill(id)}
              stroke={id === "empty" ? "var(--ink-2)" : "none"}
              stroke-width={id === "empty" ? 1.75 : 0}
              style:--r={r}
              data-id={id}
              data-block={b}
              data-row={r + 1}
              data-place={p + 1}
            />
          </g>
        {/if}
      {/each}
    {/each}
  </svg>
{/snippet}

<div class="plot">
  <div class="split" aria-hidden="true">
    <p class="split-title">{labels.groupsTitle}</p>
    <div class="bar">
      {#each groups as group (group.id)}
        <span
          class="segment"
          class:faded={(only !== null && only !== group.id) || (pick !== "" && groupOf(pick) !== group.id)}
          style:flex-grow={group.count}
          style:background={group.color}
        ></span>
      {/each}
    </div>
  </div>

  <div class="controls">
    <div class="legend" role="group" aria-label={labels.key}>
      {#each groups as group (group.id)}
        <button type="button" aria-pressed={only === group.id} onclick={() => toggle(group.id)}>
          <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
            <path d={glyph(SHAPES[group.id] ?? "circle")} fill={group.color} />
          </svg>
          <span class="name">{group.name}</span>
          <span class="count">{group.count}</span>
          <span class="share">{Math.round((group.count / total) * 100)}%</span>
        </button>
      {/each}
      {#if emptyCount > 0}
        <button type="button" aria-pressed={only === "empty"} onclick={() => toggle("empty")}>
          <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
            <path d={glyph("ring")} fill="none" stroke="var(--ink-2)" stroke-width="2" />
          </svg>
          <span class="name">{labels.empty}</span>
          <span class="count">{emptyCount}</span>
        </button>
      {/if}
      <span class="item">
        <svg class="swatch" viewBox="-10 -10 20 20" aria-hidden="true">
          <path d={glyph("square")} fill="var(--ink)" />
        </svg>
        <span class="name">{labels.house}</span>
      </span>
      <button
        type="button"
        class="all"
        disabled={only === null && pick === ""}
        onclick={() => {
          only = null;
          pick = "";
        }}>{labels.showAll}</button
      >
    </div>

    <div class="find">
      <label for="find-kind">{labels.find}</label>
      <select id="find-kind" bind:value={pick} onchange={() => (only = null)}>
        <option value="">{labels.everyKind}</option>
        {#each kindList as kind (kind.id)}
          <option value={kind.id}>{kind.name}</option>
        {/each}
      </select>
      <p class="found" aria-live="polite">
        {#if found}
          <span class="found-head">{found.head}</span>
          {#each found.where as where (where)}<span class="found-where">{where}</span>{/each}
        {/if}
      </p>
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="bands"
    bind:this={wrap}
    role="group"
    aria-label={labels.mapLabel}
    onclick={(event) => {
      if (!(event.target as Element).matches("[data-id]")) tip = null;
    }}
  >
    {#each blocks as block, b (b)}
      <div class="block" class:waiting={waiting[b]}>
        <div class="caption">
          <h3>{block.name}</h3>
          <p class="stats">{block.stats}</p>
        </div>
        {@render field(block, b, true)}
        {@render field(block, b, false)}
      </div>
    {/each}

    {#if tip}
      <div class="tip" style:left={`${tip.left}px`} style:top={`${tip.top}px`} aria-hidden="true">
        <span class="tip-title">{tip.title}</span>
        {#if tip.detail}<span class="tip-detail">{tip.detail}</span>{/if}
        <span class="tip-detail">{tip.place}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .plot {
    display: grid;
    gap: var(--s-5);
  }

  .split {
    display: grid;
    gap: var(--s-2);
  }

  .split-title {
    font-weight: 700;
  }

  /* Each group's share of the planted places, end to end. */
  .bar {
    display: flex;
    gap: 2px;
    block-size: 1.25rem;
  }

  .segment {
    flex-basis: 0;
    min-inline-size: 4px;
    transition: opacity var(--quick) var(--ease);
  }

  .segment.faded {
    opacity: 0.2;
  }

  .controls {
    display: grid;
    gap: var(--s-5);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-5);
  }

  .legend button,
  .item {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-1) 0;
    border: 0;
    background: none;
  }

  .legend button {
    cursor: pointer;
  }

  .legend button .name {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.25em;
  }

  .legend button:hover .name {
    text-decoration-thickness: 2px;
  }

  .legend button[aria-pressed="true"] .name {
    font-weight: 700;
    text-decoration-thickness: 3px;
  }

  .count {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .share {
    color: var(--ink-2);
  }

  .swatch {
    flex: none;
    inline-size: 1.1rem;
    block-size: 1.1rem;
  }

  .all {
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .all:disabled {
    visibility: hidden;
  }

  .find {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-4);
  }

  label {
    font-weight: 700;
  }

  select {
    min-inline-size: 14rem;
    max-inline-size: 100%;
    padding: var(--s-2) var(--s-3);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .found {
    display: grid;
    flex-basis: 100%;
    min-block-size: 1.6em;
    max-width: none;
  }

  .found-head {
    font-family: var(--font-display);
    font-size: var(--step-1);
  }

  .found-where {
    color: var(--ink-2);
  }

  /* Standing, the sheets sit side by side where there's room and one under the other on a phone. */
  .bands {
    position: relative;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 15rem));
    gap: var(--s-4) var(--s-5);
  }

  .block {
    display: grid;
    grid-row: span 2;
    grid-template-rows: subgrid;
    gap: var(--s-3);
  }

  .caption {
    display: grid;
    align-content: end;
    gap: var(--s-1);
  }

  h3 {
    font-size: var(--step-1);
  }

  .stats {
    max-width: none;
    font-size: var(--step--1);
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }

  svg {
    display: block;
    block-size: auto;
    touch-action: manipulation;
  }

  .across {
    display: none;
  }

  .down {
    inline-size: 100%;
  }

  .tick {
    fill: var(--ink-2);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  /* Changes sweep along a block from its first row to its last. */
  .mark {
    pointer-events: all;
    transform-box: fill-box;
    transform-origin: center;
    transition:
      opacity 300ms var(--ease),
      transform 500ms var(--ease);
    transition-delay: calc(var(--r) * 12ms);
  }

  path.mark:hover {
    transform: scale(1.3);
    transition-delay: 0s;
  }

  .mark.dim {
    opacity: 0.12;
  }

  .mark.picked {
    stroke: var(--ink);
    stroke-width: 2.5px;
  }

  .waiting .mark {
    opacity: 0;
    transform: scale(0.2);
  }

  .tip {
    position: absolute;
    z-index: 5;
    display: grid;
    gap: 0.1rem;
    min-inline-size: 9rem;
    max-inline-size: 15rem;
    padding: var(--s-2) var(--s-3);
    background: var(--ink);
    color: var(--paper);
    translate: -50% calc(-100% - 6px);
    pointer-events: none;
  }

  .tip-title {
    font-weight: 700;
  }

  .tip-detail {
    font-size: var(--step--1);
  }

  /* Wider screens turn the sheets a quarter left: rows run across, one block above the other. */
  @media (min-width: 48rem) {
    .controls {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }

    .find {
      justify-content: end;
    }

    .found {
      justify-items: end;
      text-align: end;
    }

    .bands {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--s-6);
    }

    .block {
      grid-row: auto;
      grid-template-rows: auto;
    }

    .caption {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--s-1) var(--s-4);
    }

    .across {
      display: block;
      inline-size: var(--share);
    }

    .down {
      display: none;
    }

    .tick {
      font-size: 11px;
    }
  }
</style>
