<script lang="ts">
  import { ColorMode } from '$lib';
  import { Button } from 'carbon-components-svelte';
  import type { Writable } from 'svelte/store';
  import ColorModeSelector from './ColorModeSelector.svelte';

  export let curColorMode: Writable<ColorMode>;
  export let configuratorOpen: Writable<boolean>;

  const onClick = () => {
    $configuratorOpen = !$configuratorOpen;
  };
</script>

<div class="configure-colors root">
  <Button
    kind="tertiary"
    size="small"
    style="background: black; color: #efefef !important; height: 20px; width: 86px"
    on:click={onClick}
  >
    Configure
  </Button>
  {#if $configuratorOpen}
    <div class="configure-form">
      <ColorModeSelector bind:selected={$curColorMode} />
    </div>
  {/if}
</div>

<style lang="css">
  .root {
    position: absolute;
    top: 0;
    left: calc(min(340px, 100vw - 98px) + 17px);
    display: flex;
    flex-direction: row;
  }

  .configure-form {
    margin-left: 4px;
    background: rgba(0, 0, 0, 0.4);
    padding: 4px 0 4px 4px;
  }

  @media (max-width: 600px) {
    .root {
      flex-direction: column;
    }

    .configure-form {
      margin-left: -120px;
      margin-top: 24px;
    }
  }
</style>
