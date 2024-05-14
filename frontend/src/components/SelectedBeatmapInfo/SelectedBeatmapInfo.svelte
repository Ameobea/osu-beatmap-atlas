<script lang="ts">
  import type { Corpus } from '../../corpus';
  import SimulatedPp from './SimulatedPP.svelte';
  import UserBestPlay from './UserBestPlay.svelte';

  const {
    corpus,
    selectedScoreIx,
    activeUserID,
  }: { corpus: Corpus; selectedScoreIx: number; activeUserID: number | null } = $props();

  let windowWidth = $state(0);

  const entry = $derived(corpus[selectedScoreIx]);
  const coverImageURL = $derived(`https://assets.ppy.sh/beatmaps/${entry.beatmapSetID}/covers/cover.jpg`);
  const downloadURL = $derived(`https://osu.ppy.sh/beatmapsets/${entry.beatmapSetID}/download`);
  const osuDirectURL = $derived(`osu://b/${entry.beatmapId}`);
  const length = $derived(
    `${Math.floor(entry.realLengthSeconds / 60)}:${(entry.realLengthSeconds % 60).toString().padStart(2, '0')}`
  );
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="backdrop" style={`background-image: url(${coverImageURL})`}></div>
<div class="root">
  <div class="content">
    <h2>
      <a href={`https://osu.ppy.sh/b/${entry.beatmapId}`} target="_blank">
        {entry.beatmapName} [{entry.difficultyName}] {entry.modString ? `+${entry.modString}` : null}
      </a>
    </h2>
    <div class="below-title">
      <div>
        <p>
          Mapped by <a href={`https://osu.ppy.sh/u/${entry.mapperName}`} target="_blank"><b>{entry.mapperName}</b></a>
        </p>
      </div>
      <div class="download-links">
        <a href={downloadURL} target="_blank">Download</a>
        &nbsp;|&nbsp;
        <a href={osuDirectURL} target="_blank">osu!direct</a>
      </div>
    </div>
    <div class="bottom">
      <div class="stats">
        <p>Stars: {entry.starRating.toFixed(2)}</p>
        <p>BPM: {entry.bpm}</p>
        <p>Length: {length}</p>
      </div>
      {#if windowWidth > 600}
        <SimulatedPp {entry} />
      {/if}
      {#if entry}
        <UserBestPlay {entry} {activeUserID} />
      {/if}
    </div>
  </div>
</div>

<style lang="css">
  .root,
  .backdrop {
    position: absolute;
    bottom: 0;
    left: 303px;
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
    display: flex;
    flex-direction: column;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    flex: 1;
  }

  h2 {
    font-weight: bold;
    margin-bottom: 2px;
    font-size: 1.6em;
    white-space: break-spaces;
  }

  .backdrop {
    background-size: cover;
    background-position: center;
    filter: brightness(0.4);
  }

  .below-title {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 24px;
  }

  .download-links {
    margin-top: 6px;
    margin-bottom: 6px;
  }

  .bottom {
    display: flex;
    flex-direction: row;
    flex: 1;
  }

  .bottom > div {
    display: flex;
    flex-direction: column;
    margin-top: 4px;
  }

  .stats {
    display: flex;
    flex-direction: column;
    flex: 0.3;
    min-width: 165px;
  }

  @media (max-width: 600px) {
    .root,
    .backdrop {
      left: 0;
    }

    .root {
      font-size: 13px;
    }

    .download-links {
      margin-top: 2px;
      margin-bottom: 4px;
    }

    p {
      font-size: 0.8em;
    }
  }
</style>
