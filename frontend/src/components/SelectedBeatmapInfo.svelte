<script lang="ts">
  import type { Corpus } from '../corpus';

  export let corpus: Corpus;
  export let selectedScoreIx: number;

  $: entry = corpus[selectedScoreIx];
  $: coverImageURL = `https://assets.ppy.sh/beatmaps/${entry.beatmapSetID}/covers/cover.jpg`;
</script>

<div class="backdrop" style={`background-image: url(${coverImageURL})`}></div>
<div class="root">
  <div class="content">
    <h2>
      <a href={`https://osu.ppy.sh/b/${entry.beatmapId}`} target="_blank">
        {entry.beatmapName} [{entry.difficultyName}] {entry.modString ? `+${entry.modString}` : null}
      </a>
    </h2>
    <p>Mapped by <a href={`https://osu.ppy.sh/u/${entry.mapperName}`} target="_blank"><b>{entry.mapperName}</b></a></p>
    <br />
    TODO: download link
    <br />
    <p>Stars: {entry.starRating.toFixed(2)}</p>
    <p>BPM: {entry.bpm}</p>
  </div>
</div>

<style lang="css">
  .root,
  .backdrop {
    position: absolute;
    bottom: 0;
    left: 0;
    width: calc(min(100vw, 900px));
    aspect-ratio: 900 / 250;
  }

  .root {
    display: flex;
    flex-direction: column;
    border-top: 1px solid #777;
    border-right: 1px solid #777;
  }

  .content {
    margin: 4px 6px;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    flex: 1;
  }

  h2 {
    font-weight: bold;
    margin-bottom: 6px;
  }

  .backdrop {
    background-size: cover;
    background-position: center;
    filter: brightness(0.3);
  }
</style>
