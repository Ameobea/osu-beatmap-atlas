import { PUBLIC_CORPUS_URL } from '$env/static/public';
import { get, writable } from 'svelte/store';
import { fetchCorpus } from './api';
import { parseModsBitmask } from './modParser';
import { logError } from './sentry';
import { delay } from './util';

export interface ScoreMetadata {
  originalIx: number;
  scoreID: string;
  beatmapId: number;
  beatmapSetID: number;
  modsBitmask: number;
  modString: string;
  position: [number, number];
  averagePp: number;
  starRating: number;
  beatmapName: string;
  difficultyName: string;
  mapperName: string;
  releaseYear: number;
  lengthSeconds: number;
  realLengthSeconds: number;
  bpm: number;
  actualBPM: number;
  AR: number;
  CS: number;
  OD: number;
  aimDifficulty: number;
  speedDifficulty: number;
  aimSpeedRatio: number;
  numUsers: number;
}

export type Corpus = ScoreMetadata[];

const parseCorpus = (buffer: ArrayBuffer, version: CorpusVersion): ScoreMetadata[] => {
  const dataView = new DataView(buffer);

  // read item count first
  const numItems = dataView.getUint32(0, true);
  let rowDataOffset = 4;

  const beatmaps: ScoreMetadata[] = [];
  const stringStartOffset = numItems * 62 + 4;
  let stringOffset = stringStartOffset;

  const textDecoder = new TextDecoder();

  for (let i = 0; i < numItems; i++) {
    const beatmapId = dataView.getInt32(rowDataOffset, true);
    const modsBitmask = dataView.getUint32(rowDataOffset + 4, true);
    let x = 2 * dataView.getFloat32(rowDataOffset + 8, true);
    let y = 2 * -dataView.getFloat32(rowDataOffset + 12, true);
    switch (version) {
      case CorpusVersion.Latest:
        x *= -1;
        y *= -1;
        break;
      default:
        break;
    }
    const averagePp = dataView.getFloat32(rowDataOffset + 16, true);
    const starRating = dataView.getFloat32(rowDataOffset + 20, true);
    const beatmapNameLength = dataView.getUint16(rowDataOffset + 24, true);
    const difficultyNameLength = dataView.getUint16(rowDataOffset + 26, true);
    const mapperNameLength = dataView.getUint16(rowDataOffset + 28, true);
    const releaseYear = dataView.getUint16(rowDataOffset + 30, true);
    const lengthSeconds = dataView.getUint16(rowDataOffset + 32, true);
    const bpm = dataView.getUint16(rowDataOffset + 34, true);
    const AR = dataView.getFloat32(rowDataOffset + 36, true);
    const CS = dataView.getFloat32(rowDataOffset + 40, true);
    const OD = dataView.getFloat32(rowDataOffset + 44, true);
    const aimDifficulty = dataView.getFloat32(rowDataOffset + 48, true);
    const speedDifficulty = dataView.getFloat32(rowDataOffset + 52, true);
    const beatmapSetID = dataView.getUint32(rowDataOffset + 56, true);
    const numUsers = dataView.getUint16(rowDataOffset + 60, true);

    rowDataOffset += 62;

    const beatmapName = textDecoder.decode(new Uint8Array(buffer, stringOffset, beatmapNameLength));
    stringOffset += beatmapNameLength;
    const difficultyName = textDecoder.decode(new Uint8Array(buffer, stringOffset, difficultyNameLength));
    stringOffset += difficultyNameLength;
    const mapperName = textDecoder.decode(new Uint8Array(buffer, stringOffset, mapperNameLength));
    stringOffset += mapperNameLength;

    const modString = parseModsBitmask(modsBitmask);

    const realLengthSeconds = modString.includes('DT') ? Math.ceil(lengthSeconds / 1.5) : lengthSeconds;
    const aimSpeedRatio = aimDifficulty / speedDifficulty;
    const actualBPM = bpm * (modString.includes('DT') ? 1.5 : 1);

    beatmaps.push({
      originalIx: i,
      scoreID: `${beatmapId}_${modString}`,
      beatmapId,
      beatmapSetID,
      modsBitmask,
      modString,
      position: [x, y],
      averagePp,
      starRating,
      beatmapName,
      difficultyName,
      mapperName,
      releaseYear,
      lengthSeconds,
      realLengthSeconds,
      bpm,
      actualBPM,
      AR,
      CS,
      OD,
      aimDifficulty,
      speedDifficulty,
      aimSpeedRatio,
      numUsers,
    });
  }

  return beatmaps;
};

type FetchedCorpus =
  | { status: 'notFetched' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ScoreMetadata[] }
  | { status: 'error'; error: Error };

export const GlobalCorpus = writable<FetchedCorpus>({ status: 'notFetched' });

export enum CorpusVersion {
  Latest = 'LATEST',
  First = '1716022133',
}

export const getCorpusURL = (version: CorpusVersion) => {
  switch (version) {
    case CorpusVersion.Latest:
      return PUBLIC_CORPUS_URL;
    case CorpusVersion.First:
      return 'https://osu-map.b-cdn.net/corpus_1716022133.txt';
  }
};

export const parseCorpusVersion = (version: number | string | null | undefined): CorpusVersion => {
  switch (version) {
    case 'LATEST':
    case '':
    case null:
    case undefined:
      return CorpusVersion.Latest;
    case '1716022133':
    case 1716022133:
      return CorpusVersion.First;
    default:
      return CorpusVersion.Latest;
  }
};

export const getCorpusDefaultView = (
  version: CorpusVersion
): { initialCenter: [number, number]; initialSpanX: number } => {
  switch (version) {
    case CorpusVersion.Latest:
      return { initialCenter: [-10.4, 5], initialSpanX: 122.6 };
    case CorpusVersion.First:
      return { initialCenter: [14.4, -8], initialSpanX: 81.6 };
    default:
      throw new Error(`Invalid corpus version: ${version}`);
  }
};

export const loadCorpus = async (version: CorpusVersion) => {
  if (get(GlobalCorpus).status !== 'notFetched') {
    return;
  }

  let i = 0;

  for (;;) {
    try {
      const buffer = await fetchCorpus(getCorpusURL(version));
      const corpus = parseCorpus(buffer, version);
      GlobalCorpus.set({ status: 'loaded', data: corpus });
      return;
    } catch (err) {
      logError('Failed to load corpus', err);
      i += 1;
      if (i >= 3) {
        GlobalCorpus.set({ status: 'error', error: err as Error });
        throw err;
      }

      await delay(1000);
    }
  }
};
