<script lang="ts">
  import { Button, TextInput } from 'carbon-components-svelte';

  export let onSubmit: (username: string) => void;

  let searchText = localStorage.getItem('activeUsername') || '';

  const handleSubmit = () => {
    if (!searchText) {
      return;
    }

    localStorage.setItem('activeUsername', searchText);
    onSubmit(searchText);
  };
</script>

<div class="root">
  <TextInput
    bind:value={searchText}
    placeholder="Enter an osu! username"
    style="height: 32px"
    on:keydown={(e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    }}
  />
  <Button kind="tertiary" size="small" on:click={handleSubmit} style="background: black; color: #efefef !important">
    Search
  </Button>
</div>

<style lang="css">
  .root {
    position: absolute;
    top: 0;
    right: 0;
    width: calc(min(100vw, 400px));
    display: flex;
    flex-direction: row;
  }
</style>
