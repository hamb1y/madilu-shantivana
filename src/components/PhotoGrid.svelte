<script lang="ts">
  /**
   * Photos as a mosaic under year headings: tall photos take two rows, wide
   * ones two columns. A year can be shown alone. A photo opens full size in a
   * dialog; swipe, the arrow keys or the buttons move through the photos shown.
   */
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import X from "lucide-svelte/icons/x";

  interface Item {
    id: string;
    src: string;
    small: string;
    width: number;
    height: number;
    alt: string;
    date: string;
    year: string;
  }

  interface Props {
    photos: Item[];
    labels: {
      /** "Open photo: {alt}" */
      open: string;
      close: string;
      prev: string;
      next: string;
      /** "{n} of {total}" */
      position: string;
      allYears: string;
      swipe: string;
    };
  }

  let { photos, labels }: Props = $props();

  const allYears = $derived([...new Set(photos.map((p) => p.year))]);
  let year = $state("");
  const visible = $derived(year ? photos.filter((p) => p.year === year) : photos);
  const years = $derived(
    allYears
      .filter((y) => !year || y === year)
      .map((y) => ({ year: y, items: visible.map((photo, index) => ({ photo, index })).filter(({ photo }) => photo.year === y) })),
  );

  let dialog: HTMLDialogElement | undefined = $state();
  let current = $state<number | null>(null);
  const shown = $derived(current === null ? null : visible[current]);

  function shape(photo: Item): string {
    const ratio = photo.width / photo.height;
    if (ratio > 1.25) return "wide";
    if (ratio < 0.8) return "tall";
    return "square";
  }

  function open(index: number) {
    current = index;
    dialog?.showModal();
  }

  function step(by: number) {
    if (current === null) return;
    current = (current + by + visible.length) % visible.length;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }

  /** A click on the backdrop, outside the photo and buttons, closes it. */
  function onclick(event: MouseEvent) {
    if (event.target === dialog) dialog?.close();
  }

  // Swiping: the photo follows the finger, and a long enough swipe moves on.
  let startX: number | null = null;
  let drag = $state(0);

  function down(event: PointerEvent) {
    if (event.pointerType === "mouse") return;
    startX = event.clientX;
  }

  function move(event: PointerEvent) {
    if (startX === null) return;
    drag = event.clientX - startX;
  }

  function up() {
    if (startX === null) return;
    if (Math.abs(drag) > 60) step(drag < 0 ? 1 : -1);
    startX = null;
    drag = 0;
  }
</script>

{#if allYears.length > 1}
  <div class="filter">
    <button type="button" aria-pressed={year === ""} onclick={() => (year = "")}>{labels.allYears}</button>
    {#each allYears as y (y)}
      <button type="button" aria-pressed={year === y} onclick={() => (year = y)}>{y}</button>
    {/each}
  </div>
{/if}

{#each years as group (group.year)}
  <section class="year" aria-labelledby={`photos-${group.year}`}>
    <h2 id={`photos-${group.year}`}>{group.year}</h2>
    <ul>
      {#each group.items as { photo, index } (photo.id)}
        <li class={shape(photo)}>
          <button type="button" onclick={() => open(index)} aria-label={labels.open.replace("{alt}", photo.alt)}>
            <img src={photo.small} width={photo.width} height={photo.height} alt="" loading="lazy" decoding="async" />
            <span class="cap" aria-hidden="true">{photo.date}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<dialog bind:this={dialog} {onkeydown} {onclick} onclose={() => (current = null)} aria-label={shown?.alt}>
  {#if shown && current !== null}
    <figure>
      <div
        class="stage"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        role="presentation"
      >
        <img
          src={shown.src}
          width={shown.width}
          height={shown.height}
          alt={shown.alt}
          style:translate={`${drag}px 0`}
          class:dragging={startX !== null}
        />
      </div>
      <figcaption>
        <span class="caption">{shown.alt}</span>
        <span class="meta"
          >{shown.date} · {labels.position.replace("{n}", String(current + 1)).replace("{total}", String(visible.length))}</span
        >
      </figcaption>
    </figure>
    <div class="controls">
      <button type="button" onclick={() => step(-1)}><ChevronLeft size={20} aria-hidden="true" /><span>{labels.prev}</span></button>
      <button type="button" onclick={() => step(1)}><span>{labels.next}</span><ChevronRight size={20} aria-hidden="true" /></button>
      <span class="hint">{labels.swipe}</span>
      <button type="button" class="close" onclick={() => dialog?.close()}><X size={20} aria-hidden="true" /><span>{labels.close}</span></button>
    </div>
  {/if}
</dialog>

<style>
  .filter {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-1) var(--s-5);
    padding-block: var(--s-3);
    border-block: 1px solid var(--rule);
  }

  .filter button {
    padding: var(--s-1) 0;
    border: 0;
    background: none;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: var(--step-1);
    text-decoration: underline;
    text-decoration-color: transparent;
    text-decoration-thickness: 2px;
    text-underline-offset: 0.3em;
    transition: text-decoration-color var(--quick) var(--ease);
  }

  .filter button:hover {
    text-decoration-color: var(--rule-strong);
  }

  .filter button[aria-pressed="true"] {
    color: var(--accent);
    font-weight: 600;
    text-decoration-color: var(--accent);
  }

  .year {
    display: grid;
    gap: var(--s-4);
    padding-block: var(--s-6);
  }

  h2 {
    font-size: var(--step-6);
    font-weight: 600;
    font-variation-settings: "SOFT" 100, "WONK" 1;
    line-height: 0.9;
    letter-spacing: -0.03em;
    color: var(--accent);
  }

  /* A mosaic: tall photos take two rows, wide ones two columns, gaps filled. */
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(9rem, 45%), 1fr));
    grid-auto-rows: clamp(7rem, 16vw, 13rem);
    grid-auto-flow: dense;
    gap: var(--s-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tall {
    grid-row: span 2;
  }

  .wide {
    grid-column: span 2;
  }

  li button {
    position: relative;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    padding: 0;
    border: 0;
    overflow: hidden;
    background: var(--paper-2);
    cursor: zoom-in;
  }

  li img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  /* The date rises into the corner on hover or focus. */
  .cap {
    position: absolute;
    inset-inline-start: 0;
    inset-block-end: 0;
    padding: var(--s-1) var(--s-3);
    background: var(--ink);
    color: var(--paper);
    font-size: var(--step--1);
    translate: 0 101%;
    transition: translate var(--quick) var(--ease);
  }

  li button:hover .cap,
  li button:focus-visible .cap {
    translate: 0 0;
  }

  dialog {
    inline-size: min(100vw - 2rem, 76rem);
    max-block-size: calc(100dvh - 2rem);
    padding: var(--s-4);
    border: 0;
    background: var(--ink);
    color: var(--paper);
  }

  dialog::backdrop {
    background: rgb(20 15 10 / 0.88);
  }

  figure {
    display: grid;
    gap: var(--s-3);
    margin: 0;
  }

  .stage {
    overflow: hidden;
    touch-action: pan-y;
  }

  .stage img {
    inline-size: 100%;
    max-block-size: calc(100dvh - 13rem);
    object-fit: contain;
    transition: translate 250ms var(--ease);
    user-select: none;
    -webkit-user-drag: none;
  }

  .stage img.dragging {
    transition: none;
  }

  figcaption {
    display: grid;
    gap: var(--s-1);
  }

  .caption {
    font-family: var(--font-display);
    font-size: var(--step-1);
  }

  .meta,
  .hint {
    font-size: var(--step--1);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-5);
    margin-block-start: var(--s-4);
  }

  .controls button {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    padding: var(--s-1) 0;
    border: 0;
    background: none;
    color: var(--paper);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .controls .close {
    margin-inline-start: auto;
  }

  @media (max-width: 39.99rem) {
    .hint {
      flex-basis: 100%;
      order: 3;
    }
  }
</style>
