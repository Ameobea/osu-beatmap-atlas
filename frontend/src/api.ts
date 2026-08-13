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
  pp?: number | null;
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

const ANALYTICS_SALT = '4rW9XKHcEKa6bolWry8k0LGW';
const ANALYTICS_PROJECT = 'osu-beatmap-atlas';

interface AnalyticsEvent {
  category: string;
  subcategory: string;
  payload?: unknown;
}

const genSessionID = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

let sessionID: string | null = null;
const getSessionID = (): string => {
  if (sessionID) {
    return sessionID;
  }
  try {
    sessionID = sessionStorage.getItem('analyticsSessionID');
    if (!sessionID) {
      sessionID = genSessionID();
      sessionStorage.setItem('analyticsSessionID', sessionID);
    }
  } catch (_err) {
    sessionID = genSessionID();
  }
  return sessionID;
};

let analyticsQueue: AnalyticsEvent[] = [];
let analyticsFlushTimer: number | null = null;

const flushAnalyticsEvents = async () => {
  const events = analyticsQueue;
  analyticsQueue = [];
  try {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(events.map((evt) => evt.category + evt.subcategory).join('') + ANALYTICS_SALT)
    );
    const verification = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    await fetch(`${PUBLIC_API_BRIDGE_BASE_URL}/a/z`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        events,
        verification,
        project: ANALYTICS_PROJECT,
        session_id: getSessionID(),
      }),
      keepalive: true,
    });
  } catch (_err) {
    // analytics must never break the app
  }
};

export const logEvent = (subcategory: string, payload?: unknown) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.location.href.includes('http://localhost')) {
    console.debug('[analytics]', subcategory, payload);
    return;
  }

  analyticsQueue.push(
    payload === undefined
      ? { category: 'beatmap_atlas', subcategory }
      : { category: 'beatmap_atlas', subcategory, payload }
  );
  if (analyticsFlushTimer === null) {
    analyticsFlushTimer = window.setTimeout(() => {
      analyticsFlushTimer = null;
      void flushAnalyticsEvents();
    }, 800);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (analyticsQueue.length) {
      void flushAnalyticsEvents();
    }
  });
}
