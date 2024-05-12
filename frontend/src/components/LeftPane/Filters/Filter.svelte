<script lang="ts">
  import { Slider } from 'carbon-components-svelte';
  import { genRandomStringID } from '../../../util';
  import DoubleEndedSlider from './DoubleEndedSlider.svelte';

  export let min: number;
  export let max: number;
  export let value: [number, number];
  export let label: string;
  export let step = 1;
  export let formatLabel: ((v: number) => string) | undefined = undefined;
  /**
   * Used to force the import of the carbon-components-svelte slider which is used in the DoubleEndedSlider component.
   */
  export let neverSetThis: boolean = false;

  let id = genRandomStringID();

  $: toFixedPrecision = Math.max(step.toString().split('.')[1]?.length || 0, 1);

  const formatValue = (v: number) => {
    if (formatLabel) {
      return formatLabel(v);
    }

    let formatted = v.toFixed(toFixedPrecision);
    while (formatted.endsWith('0') || formatted.endsWith('.')) {
      const lastChar = formatted.slice(-1);
      formatted = formatted.slice(0, -1);
      if (lastChar === '.') {
        break;
      }
    }
    return formatted;
  };
</script>

<div class="root">
  <label for={id}>{label}</label>
  <DoubleEndedSlider {id} {min} {max} {step} bind:value />
  {#if neverSetThis}
    <Slider />
  {/if}
  <div class="value-display">{formatValue(value[0])} - {formatValue(value[1])}</div>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 22px;
    padding-left: 6px;
    padding-right: 6px;
  }

  label {
    margin-bottom: -12px;
  }

  .value-display {
    text-align: center;
    font-family: 'IBM Plex Mono', 'Oxygen Mono', 'Hack', monospace;
    margin-top: -6px;
    font-size: 13px;
  }
</style>
