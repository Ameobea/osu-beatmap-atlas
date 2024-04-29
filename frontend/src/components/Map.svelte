<script lang="ts">
  import { browser } from '$app/environment';
  import { GlobalCorpus } from '../corpus';
  import { UnreachableError } from '../util';
  import { AtlasViz } from '../viz/AtlasViz';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;

  const renderViz = (canvas: HTMLCanvasElement) => {
    if ($GlobalCorpus.status !== 'loaded') {
      throw new UnreachableError();
    }

    const viz = new AtlasViz(canvas, $GlobalCorpus.data);
  };
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

{#if browser && $GlobalCorpus.status === 'loaded' && windowWidth > 0 && windowHeight > 0}
  <canvas
    width={windowWidth * dpr}
    height={windowHeight * dpr}
    style="width: {windowWidth}px; height: {windowHeight}px;"
    use:renderViz
  ></canvas>
{:else if !browser || $GlobalCorpus.status === 'loading'}
  <p>Loading...</p>
{:else if $GlobalCorpus.status === 'error'}
  <p>Error: {$GlobalCorpus.error}</p>
{:else}
  <p>Unknown state: {$GlobalCorpus.status}</p>
{/if}
