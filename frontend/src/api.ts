import { parseModsBitmask } from './modParser';

import { PUBLIC_API_BRIDGE_BASE_URL, PUBLIC_CORPUS_URL } from '$env/static/public';

export const fetchCorpus = async () => {
  const response = await fetch(PUBLIC_CORPUS_URL);
  return response.arrayBuffer();
};

export const getHiscoreIDsForUser = async (username: string): Promise<Set<string>> => {
  const url = `https://osutrack-api.ameo.dev/hiscores?user=${username.trim()}&mode=0&userMode=username`;
  const scoreIDs = await fetch(url)
    .then((response) => response.json())
    .then((data) => data.map((entry: any) => `${entry.beatmap_id}_${parseModsBitmask(entry.mods)}`));
  return new Set(scoreIDs);
};

export const getUserID = async (username: string): Promise<number> => {
  const url = `${PUBLIC_API_BRIDGE_BASE_URL}/users/${username.trim()}/id?mode=osu`;
  return fetch(url).then((response) => response.json());
};

interface UserScoreForBeatmap {
  ranked: boolean;
  mods: string[];
  id: number;
  rank: string;
  accuracy: number;
  is_perfect_combo: boolean;
  max_combo: number;
  pp: number;
  total_score: number;
  // like "2024-04-03T08:17:10Z"
  started_at: Date | null;
  ended_at: Date | null;
  passed: boolean;
  statistics: {
    ok: number | null;
    meh: number | null;
    miss: number | null;
    great: number | null;
    perfect: number | null;
    good: number | null;
    large_bonus: number | null;
    small_bonus: number | null;
  };
}

export const getBestUserScoreForBeatmap = async (
  userID: number,
  beatmapID: number,
  modsString: string
): Promise<UserScoreForBeatmap | null> => {
  const url = `${PUBLIC_API_BRIDGE_BASE_URL}/users/${userID}/beatmaps/${beatmapID}/best?mode=osu&mods=${modsString}`;
  return fetch(url)
    .then((response) => response.json())
    .then((res) => ({
      ...res,
      started_at: res.started_at ? new Date(res.started_at) : null,
      ended_at: res.ended_at ? new Date(res.ended_at) : null,
    }));
};
