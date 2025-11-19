<script lang="ts">
  import { ColorMode } from '$lib';
  import { Select, SelectItem } from 'carbon-components-svelte';

  import { submitAnalyticsEvent } from '../api';

  let { selected = $bindable(), style }: { selected: ColorMode; style?: string } = $props();
</script>

<div class="color-mode-selector" {style}>
  <Select
    labelText="Color By"
    bind:selected
    on:change={() =>
      setTimeout(() => submitAnalyticsEvent({ category: 'beatmap_atlas', subcategory: 'select_color_mode' }))}
    style="flex: 0"
  >
    <SelectItem value={ColorMode.StarRating} text="Star Rating" />
    <SelectItem value={ColorMode.AveragePP} text="Average PP" />
    <SelectItem value={ColorMode.Mods} text="Mods" />
    <SelectItem value={ColorMode.AimSpeedRatio} text="Aim/Speed Ratio" />
    <SelectItem value={ColorMode.ReleaseYear} text="Release Year" />
    <SelectItem value={ColorMode.Length} text="Length" />
  </Select>
</div>

<style lang="css">
  :global(.color-mode-selector label) {
    margin-bottom: 2px;
  }
</style>
