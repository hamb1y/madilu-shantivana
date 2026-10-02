<script lang="ts">
  /**
   * Photos under year headings. A photo opens full size in a dialog, with
   * previous and next buttons and the arrow keys to move through the set.
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
    };
  }

  let { photos, labels }: Props = $props();

  const years = $derived(
    [...new Set(photos.map((p) => p.year))].map((year) => ({
      year,
      items: photos.map((photo, index) => ({ photo, index })).filter(({ photo }) => photo.year === year),
    })),
  );

  let dialog: HTMLDialogElement | undefined = $state();
  let current = $state<number | null>(null);
  const shown = $derived(current === null ? null : photos[current]);

  function open(index: number) {
    current = index;
    dialog?.showModal();
  }

  function step(by: number) {
    if (current === null) return;
    current = (current + by + photos.length) % photos.length;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }

  /** A click on the backdrop, outside the photo and buttons, closes it. */
  function onclick(event: MouseEvent) {
    if (event.target === dialog) dialog?.close();
  }
</script>

{#each years as group (group.year)}
  <section class="year" aria-labelledby={`photos-${group.year}`}>
    <h2 id={`photos-${group.year}`}>{group.year}</h2>
    <ul>
      {#each group.items as { photo, index } (photo.id)}
        <li>
          <button type="button" onclick={() => open(index)} aria-label={labels.open.replace("{alt}", photo.alt)}>
            <img
              src={photo.small}
              width={photo.width}
              height={photo.height}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<dialog bind:this={dialog} {onkeydown} {onclick} onclose={() => (current = null)} aria-label={shown?.alt}>
  {#if shown && current !== null}
    <figure>
      <img src={shown.src} width={shown.width} height={shown.height} alt={shown.alt} />
      <figcaption>
        <span class="caption">{shown.alt}</span>
        <span class="meta">{shown.date} · {labels.position.replace("{n}", String(current + 1)).replace("{total}", String(photos.length))}</span>
      </figcaption>
    </figure>
    <div class="controls">
      <button type="button" onclick={() => step(-1)}><ChevronLeft size={20} aria-hidden="true" /><span>{labels.prev}</span></button>
      <button type="button" onclick={() => step(1)}><span>{labels.next}</span><ChevronRight size={20} aria-hidden="true" /></button>
      <button type="button" class="close" onclick={() => dialog?.close()}><X size={20} aria-hidden="true" /><span>{labels.close}</span></button>
    </div>
  {/if}
</dialog>

<style>
  .year {
    display: grid;
    gap: var(--s-4);
    padding-block: var(--s-6);
  }

  h2 {
    font-size: var(--step-4);
    color: var(--accent);
  }

  ul {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--s-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li button {
    display: block;
    inline-size: 100%;
    padding: 0;
    border: 0;
    background: var(--paper-2);
    cursor: zoom-in;
  }

  li img {
    inline-size: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }

  dialog {
    inline-size: min(100vw - 2rem, 72rem);
    max-block-size: calc(100dvh - 2rem);
    padding: var(--s-4);
    border: 0;
    background: var(--ink);
    color: var(--paper);
  }

  dialog::backdrop {
    background: rgb(20 15 10 / 0.85);
  }

  figure {
    display: grid;
    gap: var(--s-3);
    margin: 0;
  }

  figure img {
    inline-size: 100%;
    max-block-size: calc(100dvh - 12rem);
    object-fit: contain;
  }

  figcaption {
    display: grid;
    gap: var(--s-1);
  }

  .meta {
    font-size: var(--step--1);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
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

  @media (min-width: 40rem) {
    ul {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 64rem) {
    ul {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
