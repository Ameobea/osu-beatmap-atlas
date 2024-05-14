<script lang="ts">
  export let selected: boolean;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="root"
  data-selected={selected}
  on:click={() => {
    selected = !selected;
  }}
>
  <slot></slot>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
    flex: 0;
    padding: 2px;
    min-width: 38px;
    max-width: 38px;
    min-height: 38px;
    max-height: 38px;
    line-height: 0;
    justify-content: center;
    align-items: center;
    border: 1px dashed rgba(170, 170, 170, 0.8);
    font-size: 17px;
    border-radius: 100px;
    cursor: pointer;
    user-select: none;
  }

  .root[data-selected='true'] {
    border: 1px solid rgba(170, 170, 170, 0.8);
    font-weight: bold;
    background: rgba(140, 204, 166, 0.5);
  }
</style>
