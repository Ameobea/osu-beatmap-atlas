<script lang="ts">
  import { Button, Modal, TextInput } from 'carbon-components-svelte';
  import Info from './Info.svelte';

  const { onSubmit }: { onSubmit: (username: string | null) => void } = $props();

  let searchText = $state(localStorage.getItem('activeUsername') || '');
  let windowWidth = $state(1200);
  const searchButtonWidth = 86;
  const infoButtonWidth = $derived(windowWidth <= 600 ? 62 : 0);
  let infoModalOpen = $state(false);

  const handleSubmit = () => {
    if (!searchText) {
      localStorage.removeItem('activeUsername');
      onSubmit(null);
    }

    localStorage.setItem('activeUsername', searchText);
    onSubmit(searchText);
  };
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="root">
  <TextInput
    bind:value={searchText}
    placeholder="Enter an osu! username"
    style={`height: 32px;${windowWidth <= 600 ? `width: ${windowWidth - searchButtonWidth - infoButtonWidth - 6}px;` : ''}`}
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
    style={`background: black; color: #efefef !important; width: ${searchButtonWidth}px; text-align: center; padding-left: 19px;${windowWidth <= 600 ? `position: absolute; left: ${windowWidth - searchButtonWidth - infoButtonWidth - 6}px;` : ''}`}
  >
    Search
  </Button>
  {#if infoButtonWidth}
    <Button
      kind="tertiary"
      size="small"
      on:click={() => {
        infoModalOpen = true;
      }}
      style={`background: black; color: #efefef !important; width: ${infoButtonWidth}px; max-width: ${infoButtonWidth}px; text-align: center; padding-left: 16px; padding-right: 16px;${windowWidth <= 600 ? `position: absolute; left: ${windowWidth - infoButtonWidth - 6}px;` : ''}`}
    >
      Info
    </Button>
    <Modal bind:open={infoModalOpen} passiveModal>
      <Info />
    </Modal>
  {/if}
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

  @media (max-width: 600px) {
    .root {
      left: 0;
      right: unset;
    }
  }
</style>
