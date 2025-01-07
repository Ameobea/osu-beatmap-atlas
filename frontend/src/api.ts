import { parseModsBitmask } from './modParser';

import { PUBLIC_API_BRIDGE_BASE_URL } from '$env/static/public';

export const fetchCorpus = async (url: string) => {
  const response = await fetch(url);
  return response.arrayBuffer();
};

export const updateUser = (userID: number) =>
  fetch(`https://osutrack-api.ameo.dev/update?user=${userID}&mode=0`, { method: 'POST' });

export const getHiscoreIDsForUser = async (username: string): Promise<Set<string> | null> => {
  const url = `https://osutrack-api.ameo.dev/hiscores?user=${username.trim()}&mode=0&userMode=username`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const scoreIDs = data.map((entry: any) => `${entry.beatmap_id}_${parseModsBitmask(entry.mods)}`);
  return new Set(scoreIDs);
};

export const getUserID = async (username: string): Promise<number | null> => {
  const url = `${PUBLIC_API_BRIDGE_BASE_URL}/users/${username.trim()}/id?mode=osu`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }

  return res.json();
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
  modString: string
): Promise<UserScoreForBeatmap | null> => {
  const url = `${PUBLIC_API_BRIDGE_BASE_URL}/users/${userID}/beatmaps/${beatmapID}/best?mode=osu&mods=${modString}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  if (!json) {
    return null;
  }

  return {
    ...json,
    started_at: json.started_at ? new Date(json.started_at) : null,
    ended_at: json.ended_at ? new Date(json.ended_at) : null,
  };
};

export interface SimulatePlayParams {
  mods?: string;
  is_classic?: boolean;
  max_combo?: number;
  acc?: number;
  misses?: number;
  n300?: number;
  n100?: number;
  n50?: number;
}

export const batchSimulatePlay = async (
  beatmapID: number,
  simParams: SimulatePlayParams[]
): Promise<number[] | null> => {
  const url = `${PUBLIC_API_BRIDGE_BASE_URL}/beatmaps/${beatmapID}/simulate/batch`;
  const body = {
    beatmap_id: beatmapID,
    params: simParams,
  };

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  return json.pp;
};
