<script lang="ts">
  import DoubleEndedSlider from './DoubleEndedSlider.svelte';

  export let min: number;
  export let max: number;
  export let value: [number, number];
</script>

<div class="root">
  <DoubleEndedSlider {min} {max} bind:value />
  <span>{value[0]} - {value[1]}</span>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
  }
</style>
