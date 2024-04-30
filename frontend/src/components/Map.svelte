<script lang="ts">
  import { browser } from '$app/environment';
  import { GlobalCorpus } from '../corpus';
  import { AtlasVizRegl } from '../viz/AtlasVizRegl';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;

  const renderViz = (canvas: HTMLCanvasElement) => {
    const viz = new AtlasVizRegl(canvas);
  };
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

{#if windowWidth > 0 && windowHeight > 0}
  <canvas
    width={windowWidth * dpr}
    height={windowHeight * dpr}
    style="width: {windowWidth}px; height: {windowHeight}px;"
    use:renderViz
  ></canvas>
{/if}

{#if !browser || $GlobalCorpus.status === 'loading' || $GlobalCorpus.status === 'notFetched'}
  <p>Loading...</p>
{:else if $GlobalCorpus.status === 'error'}
  <p>Error: {$GlobalCorpus.error}</p>
{:else}
  <p>Unknown state: {$GlobalCorpus.status}</p>
{/if}
