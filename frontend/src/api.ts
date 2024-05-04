import { parseModsBitmask } from './modParser';

export const getHiscoreIDsForUser = async (userID: number): Promise<Set<string>> => {
  const url = `https://osutrack-api.ameo.dev/hiscores?user=${userID}&mode=0`;
  const scoreIDs = await fetch(url)
    .then((response) => response.json())
    .then((data) => data.map((entry: any) => `${entry.beatmap_id}_${parseModsBitmask(entry.mods)}`));
  return new Set(scoreIDs);
};
