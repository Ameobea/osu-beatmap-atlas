<script lang="ts">
  import { ColorMode } from '$lib';
  import { Button, Select, SelectItem } from 'carbon-components-svelte';
  import type { Writable } from 'svelte/store';

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
      <Select labelText="Color By" bind:selected={$curColorMode}>
        <SelectItem value={ColorMode.StarRating} text="Star Rating" />
        <SelectItem value={ColorMode.AveragePP} text="Average PP" />
        <SelectItem value={ColorMode.Mods} text="Mods" />
        <SelectItem value={ColorMode.AimSpeedRatio} text="Aim/Speed Ratio" />
        <SelectItem value={ColorMode.ReleaseYear} text="Release Year" />
        <SelectItem value={ColorMode.Length} text="Length" />
      </Select>
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
