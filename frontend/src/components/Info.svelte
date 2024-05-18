<script lang="ts">
  let windowWidth = $state(1200);
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="root">
  <h2>About This Tool</h2>
  <p>
    This is an <b>embedding visualization</b> of osu! beatmaps. It is created in such a way that similar beatmaps are placed
    close to each other in the atlas.
  </p>
  <p>It can be useful to find new maps to play, or just to explore the world of osu! in a visual way.</p>
  <h2>How to Use</h2>
  <p>
    Enter your osu! username in the top left and click "Search". This will highligh all of your own best plays on the
    atlas.
  </p>
  <p>
    From there, try clicking on some circles in areas in which you have plays. The bigger the circle, the more people
    have had that map as one of their hiscores (and the more likely it is to be a farm map).
  </p>
  {#if windowWidth >= 600}
    <p>
      You can use the filters and other controls in the left bar to search for a specific map or narrow down the set of
      displayed maps.
    </p>
  {/if}
  <h2>How it Was Built</h2>
  <p>
    All of the data used to create the embedding came from <a target="_blank" href="https://ameobea.me/osutrack/"
      >osu!track</a
    >. The beatmaps in all tracked users' top plays were used to determine relationships between different maps and
    construct the embedding.
  </p>
  <br />
  <hr style="width: 100%; border: 1px solid #64646488" />
  <br />
  <p>
    Built by <a target="_blank" href="https://osu.ppy.sh/u/ameo">ameo</a> &nbsp;&mdash;&nbsp; Fully
    <a target="_blank" href="https://github.com/Ameobea/osu-beatmap-atlas">open source</a>.
  </p>
</div>

<style lang="css">
  .root {
    display: flex;
    flex-direction: column;
    padding-left: 16px;
    padding-right: 16px;
  }

  h2:first-of-type {
    margin-top: 0;
  }

  h2 {
    margin-top: 24px;
    margin-bottom: 10px;
  }

  p {
    margin-bottom: 8px;
  }
</style>
