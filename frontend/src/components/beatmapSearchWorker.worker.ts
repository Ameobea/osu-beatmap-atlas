import * as FuzzySearcher from '@m31coding/fuzzy-search';

export interface SearchDatum {
  originalIx: number;
  data: [string, string, string, string];
}

onmessage = async (e) => {
  const searcherConfig = FuzzySearcher.Config.createDefaultConfig();
  const searcher = FuzzySearcher.SearcherFactory.createSearcher<SearchDatum, number>(searcherConfig);
  const data: SearchDatum[] = e.data;

  const indexingMeta = searcher.indexEntities(
    data,
    (d) => d.originalIx,
    (d) => d.data
  );
  const memento = new FuzzySearcher.Memento();
  searcher.save(memento);
  postMessage({
    mementoObjects: memento.objects,
    indexingMeta: indexingMeta.allEntries,
  });
};
