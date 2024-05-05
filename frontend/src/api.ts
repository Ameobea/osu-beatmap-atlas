import { parseModsBitmask } from './modParser';

import { PUBLIC_CORPUS_URL } from '$env/static/public';

export const fetchCorpus = async () => {
  const response = await fetch(PUBLIC_CORPUS_URL);
  return response.arrayBuffer();
};

export const getHiscoreIDsForUser = async (username: string): Promise<Set<string>> => {
  const url = `https://osutrack-api.ameo.dev/hiscores?user=${username}&mode=0&userMode=username`;
  const scoreIDs = await fetch(url)
    .then((response) => response.json())
    .then((data) => data.map((entry: any) => `${entry.beatmap_id}_${parseModsBitmask(entry.mods)}`));
  return new Set(scoreIDs);
};
