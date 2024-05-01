<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy } from 'svelte';
  import { GlobalCorpus } from '../corpus';
  import { AtlasVizRegl } from '../viz/AtlasVizRegl';

  let windowWidth = 0;
  let windowHeight = 0;
  const dpr = browser ? window.devicePixelRatio || 1 : 1;

  let viz: AtlasVizRegl | null = null;
  const renderViz = (canvas: HTMLCanvasElement) => {
    if (viz) {
      viz.destroy();
    }
    viz = new AtlasVizRegl(canvas);
    if ((window as any).lastTransformationMatrix) {
      viz.transformMatrix = (window as any).lastTransformationMatrix;
    }
  };

  onDestroy(() => {
    if (viz) {
      (window as any).lastTransformationMatrix = viz.transformMatrix;
      viz.destroy();
    }
  });
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
