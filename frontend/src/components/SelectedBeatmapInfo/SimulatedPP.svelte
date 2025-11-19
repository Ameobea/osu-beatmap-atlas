<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { Checkbox, LocalStorage, Slider } from 'carbon-components-svelte';

  import { batchSimulatePlay, submitAnalyticsEvent, type SimulatePlayParams } from '../../api';
  import type { ScoreMetadata } from '../../corpus';

  export let entry: ScoreMetadata;

  let hiddenEnabled = false;
  let isClassic = true;
  let sliderValue = 99.5;

  const minAcc = 93;
  const maxAcc = 100;
  const buckets = 71;
  const sliderStep = (maxAcc - minAcc) / (buckets - 1);

  $: simulatePlayRes = createQuery({
    queryKey: ['simulatePlay', entry.beatmapId, entry.modString, hiddenEnabled, isClassic],
    queryFn: async () => {
      const modString = `${entry.modString}${hiddenEnabled ? 'HD' : ''}`;
      const params: SimulatePlayParams[] = [];

      for (let i = 0; i < buckets; i++) {
        const acc = minAcc + ((maxAcc - minAcc) * i) / (buckets - 1);
        params.push({
          acc,
          mods: modString,
          is_classic: isClassic,
        });
      }

      const pps = await batchSimulatePlay(entry.beatmapId, params);
      return pps ? pps.map((pp, i) => ({ acc: params[i].acc, pp })) : null;
    },
  });
</script>

<LocalStorage bind:value={hiddenEnabled} key="sim-pp-hiddenEnabled" />
<LocalStorage bind:value={isClassic} key="sim-pp-classicEnabled" />
<LocalStorage bind:value={sliderValue} key="sim-pp-sliderValue" />

<div class="simulate-play">
  <h3>Simulate Play</h3>
  <Checkbox
    bind:checked={hiddenEnabled}
    on:change={() =>
      setTimeout(() => submitAnalyticsEvent({ category: 'beatmap_atlas', subcategory: 'beatmap_details_toggle_hd' }))}
    labelText="+HD"
  />
  <Checkbox
    bind:checked={isClassic}
    on:change={() =>
      setTimeout(() =>
        submitAnalyticsEvent({ category: 'beatmap_atlas', subcategory: 'beatmap_details_toggle_classic' })
      )}
    labelText="Stable/Classic"
  />

  <Slider
    min={93}
    max={100}
    step={sliderStep}
    bind:value={sliderValue}
    hideTextInput
    minLabel={`${minAcc}%`}
    maxLabel={`${maxAcc}%`}
  />
  <p>
    {sliderValue.toFixed(1)}%: {$simulatePlayRes.data
      ? ($simulatePlayRes.data.find((d) => d.acc === sliderValue)?.pp.toFixed(2) ?? '?')
      : '--'}pp
  </p>
</div>

<style lang="css">
  .simulate-play {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  h3 {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 1.2em;
  }

  :global(.simulate-play .bx--form-item) {
    flex: 0 !important;
  }
</style>
