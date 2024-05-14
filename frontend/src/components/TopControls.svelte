<script lang="ts">
  import { Button, TextInput } from 'carbon-components-svelte';

  const { onSubmit }: { onSubmit: (username: string | null) => void } = $props();

  let searchText = $state(localStorage.getItem('activeUsername') || '');

  const handleSubmit = () => {
    if (!searchText) {
      localStorage.removeItem('activeUsername');
      onSubmit(null);
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
  <Button
    kind="tertiary"
    size="small"
    on:click={handleSubmit}
    style="background: black; color: #efefef !important; width: 86px; text-align: center; padding-left: 19px"
  >
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
