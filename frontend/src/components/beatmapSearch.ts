import type { Corpus, ScoreMetadata } from '../corpus';

const FIELD_WEIGHTS = [1, 0.8, 0.9, 0.7]; // title, difficulty, mapper, mods

const normalize = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '');
const tokenize = (s: string) =>
  normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
const tokenizeMods = (mods: string) => mods.toLowerCase().match(/.{2}/g) ?? [];
const tokenizeQuery = (query: string) =>
  tokenize(query).flatMap((term) => (/^(ez|fl|dt|hr|ht){2,}$/.test(term) ? tokenizeMods(term) : [term]));

export interface SearchIndex {
  corpus: Corpus;
  vocab: string[];
  postings: Int32Array[]; // packed as (originalIx << 2) | field
  popularity: Float32Array;
}

export const buildSearchIndex = (corpus: Corpus): SearchIndex => {
  const wordIds = new Map<string, number>();
  const postingLists: number[][] = [];
  for (const d of corpus) {
    const fields = [
      tokenize(d.beatmapName),
      tokenize(d.difficultyName),
      tokenize(d.mapperName),
      tokenizeMods(d.modString),
    ];
    fields.forEach((words, field) => {
      for (const word of new Set(words)) {
        let id = wordIds.get(word);
        if (id === undefined) {
          id = postingLists.length;
          wordIds.set(word, id);
          postingLists.push([]);
        }
        postingLists[id].push((d.originalIx << 2) | field);
      }
    });
  }
  return {
    corpus,
    vocab: [...wordIds.keys()],
    postings: postingLists.map((list) => Int32Array.from(list)),
    popularity: Float32Array.from(corpus, (d) => 1 + 0.1 * Math.log10(1 + d.numUsers)),
  };
};

const MAX_WORD_LEN = 255;
const dpRows = [new Int32Array(MAX_WORD_LEN + 1), new Int32Array(MAX_WORD_LEN + 1), new Int32Array(MAX_WORD_LEN + 1)];

// Optimal string alignment distance from `term` to the closest prefix of `word`, so a
// typo'd partial word still matches while typing. Bails with maxDist + 1 as soon as
// no row of the DP table is within budget.
const prefixEditDistance = (term: string, word: string, maxDist: number): number => {
  const n = term.length;
  const m = word.length;
  let [prev2, prev, cur] = dpRows;
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    const tc = term.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const wc = word.charCodeAt(j - 1);
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (tc === wc ? 0 : 1));
      if (i > 1 && j > 1 && tc === word.charCodeAt(j - 2) && term.charCodeAt(i - 2) === wc) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  let best = maxDist + 1;
  for (let j = n - maxDist; j <= m; j++) if (prev[j] < best) best = prev[j];
  return best;
};

const matchWords = (index: SearchIndex, term: string): [wordId: number, score: number][] => {
  const maxDist = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
  const matches: [number, number][] = [];
  index.vocab.forEach((word, wordId) => {
    if (word === term) {
      matches.push([wordId, 1]);
    } else if (word.startsWith(term)) {
      matches.push([wordId, 0.8 + 0.2 * (term.length / word.length)]);
    } else if (maxDist > 0 && word.length >= term.length - maxDist && word.length <= MAX_WORD_LEN) {
      const dist = prefixEditDistance(term, word, maxDist);
      if (dist <= maxDist) {
        matches.push([wordId, 0.6 * (1 - dist / term.length)]);
      }
    }
  });
  return matches;
};

export interface SearchOptions {
  limit: number;
  boost?: (d: ScoreMetadata) => number;
}

/**
 * Returns the `originalIx`s of the best-matching entries. Every query term contributes its best
 * field match; entries matching more distinct terms always rank above those matching fewer, and
 * within a tier the summed match quality is scaled by popularity and the optional `boost`.
 */
export const search = (index: SearchIndex, query: string, { limit, boost }: SearchOptions): number[] => {
  const terms = [...new Set(tokenizeQuery(query))];
  const n = index.corpus.length;
  if (!terms.length || n === 0) {
    return [];
  }

  const scores = new Float32Array(n);
  const matchedTerms = new Uint8Array(n);
  const termBest = new Float32Array(n);
  for (const term of terms) {
    termBest.fill(0);
    for (const [wordId, wordScore] of matchWords(index, term)) {
      for (const packed of index.postings[wordId]) {
        const ix = packed >> 2;
        const s = wordScore * FIELD_WEIGHTS[packed & 3];
        if (s > termBest[ix]) termBest[ix] = s;
      }
    }
    for (let ix = 0; ix < n; ix++) {
      if (termBest[ix] > 0) {
        scores[ix] += termBest[ix];
        matchedTerms[ix]++;
      }
    }
  }

  const topIxs: number[] = [];
  const topRanks: number[] = [];
  for (let ix = 0; ix < n; ix++) {
    if (matchedTerms[ix] === 0) continue;
    let rank = scores[ix] * index.popularity[ix];
    if (boost) rank *= boost(index.corpus[ix]);
    rank += matchedTerms[ix] * 1000;
    if (topIxs.length === limit && rank <= topRanks[limit - 1]) continue;
    let pos = topIxs.length;
    while (pos > 0 && topRanks[pos - 1] < rank) pos--;
    topIxs.splice(pos, 0, ix);
    topRanks.splice(pos, 0, rank);
    if (topIxs.length > limit) {
      topIxs.pop();
      topRanks.pop();
    }
  }
  return topIxs;
};
