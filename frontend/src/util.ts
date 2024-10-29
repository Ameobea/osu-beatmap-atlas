import { browser } from '$app/environment';
import { page } from '$app/stores';
import { derived, get } from 'svelte/store';
import { CorpusVersion, parseCorpusVersion } from './corpus';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UnreachableError extends Error {
  constructor(message?: string) {
    super(`entered unreachable code: ${message}`);
  }
}

export const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);

export const mix = (x: number, y: number, a: number) => x * (1 - a) + y * a;

export const genRandomStringID =
  globalThis.crypto && typeof globalThis.crypto?.randomUUID === 'function'
    ? () => crypto.randomUUID()
    : () => {
        const s4 = () =>
          Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        return `${s4()}${s4()}-${s4()}${s4()}-${s4()}${s4()}-${s4()}${s4()}`;
      };

(globalThis as any).dbg = (x: any) => {
  console.log(x);
  return x;
};

export const getCorpusVersionStore = () =>
  derived(page, (page) => parseCorpusVersion(page.url.searchParams.get('version')));

export const getCorpusVersion = (): CorpusVersion => {
  if (!browser) {
    return CorpusVersion.Latest;
  }

  const corpusVersionStore = getCorpusVersionStore();
  const rawVersion = get(corpusVersionStore);
  const corpusVersion = parseCorpusVersion(rawVersion);
  return corpusVersion;
};

declare global {
  function dbg<T>(arg: T): T;
}
