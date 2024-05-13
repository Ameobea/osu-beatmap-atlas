<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { getBestUserScoreForBeatmap } from '../../api';
  import type { ScoreMetadata } from '../../corpus';

  export let activeUserID: number | null;
  export let entry: ScoreMetadata;

  $: bestUserScoreRes = createQuery({
    queryKey: ['bestUserScoreForBeatmap', entry.beatmapId, entry.modString, activeUserID],
    queryFn: () => {
      if (!entry || !activeUserID) {
        return null;
      }
      return getBestUserScoreForBeatmap(activeUserID, entry.beatmapId, entry.modString);
    },
  });
  $: playedAt = $bestUserScoreRes.data ? $bestUserScoreRes.data.ended_at ?? $bestUserScoreRes.data.started_at : null;
</script>

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

<style lang="css">
  .user-best {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  @media (max-width: 600px) {
    .user-best,
    p {
      font-size: 12px;
      line-height: 13px;
    }
  }

  h3 {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 1.2em;
  }
</style>
