<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { getBestUserScoreForBeatmap } from '../api';
  import type { Corpus } from '../corpus';

  export let corpus: Corpus;
  export let selectedScoreIx: number;
  export let activeUserID: number | null;

  $: entry = corpus[selectedScoreIx];
  $: coverImageURL = `https://assets.ppy.sh/beatmaps/${entry.beatmapSetID}/covers/cover.jpg`;
  $: downloadURL = `https://osu.ppy.sh/beatmapsets/${entry.beatmapSetID}/download`;
  $: osuDirectURL = `osu://b/${entry.beatmapId}`;
  $: length = `${Math.floor(entry.realLengthSeconds / 60)}:${(entry.realLengthSeconds % 60).toString().padStart(2, '0')}`;

  $: bestUserScoreRes = createQuery({
    queryKey: ['bestUserScoreForBeatmap', entry?.beatmapId, entry?.modString, activeUserID],
    queryFn: () => {
      if (!entry || !activeUserID) {
        return null;
      }
      return getBestUserScoreForBeatmap(activeUserID, entry.beatmapId, entry.modString);
    },
  });
  $: playedAt = $bestUserScoreRes.data ? $bestUserScoreRes.data.ended_at ?? $bestUserScoreRes.data.started_at : null;
</script>

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
        <h3>Stats</h3>
        <p>Stars: {entry.starRating.toFixed(2)}</p>
        <p>BPM: {entry.bpm}</p>
        <p>Length: {length}</p>
      </div>
      <div class="user-best">
        {#if activeUserID}
          <h3>Your Best Submitted Play</h3>
        {/if}
        {#if $bestUserScoreRes.data}
          <p>Rank: {$bestUserScoreRes.data.rank}</p>
          <p>PP: {$bestUserScoreRes.data.pp.toFixed(2)}</p>
          <p>Combo: {$bestUserScoreRes.data.max_combo}</p>
          <p>Accuracy: {($bestUserScoreRes.data.accuracy * 100).toFixed(2)}%</p>
          <p>
            Played on: {playedAt
              ? Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(playedAt))
              : 'Unknown'}
          </p>
        {:else if activeUserID}
          <p><i>No score found</i></p>
        {/if}
      </div>
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

  h3 {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 1.2em;
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
    flex: 1;
    margin-top: 4px;
  }

  @media (max-width: 600px) {
    .root,
    .backdrop {
      left: 0;
    }

    .root {
      font-size: 13px;
    }

    p {
      font-size: 0.8em;
    }

    h3 {
      font-size: 1em;
    }
  }
</style>
