# Notebooks

These Python notebooks are used to pull the source data, pre-process it, generate embeddings, and visualize the outcome.

This is a very similar process to the one I used to create my [anime atlas](https://anime.ameo.dev/pymde_4d_40n) project. ([code](https://github.com/Ameobea/sprout/tree/main/notebooks))

## Process

The process starts with `just extract-data`. It streams only the osu!standard, 75+ PP history columns used by the embedding into `data/hiscore_updates.parquet`, then refreshes `data/beatmaps.parquet`. Each file is written to a partial path and atomically replaced only after a successful export, so a connection failure does not destroy the previous usable dump. A small official-API metadata supplement is appended for ranked maps which are present in score history but absent from osu!track's `beatmaps` table.
For a quick connectivity/schema test, use `just extract-data --limit 1000`. This requires the private database environment variables loaded by the root `.env` file.

It's not going to work if you're not me since it requires DB access, though, but don't worry:

You can retrieve a pre-pulled `hiscore_updates.parquet` from [here](https://ameo.dev/hiscore_updates.parquet).  If that link ever dies, ping me on Discord @ameo and I'll send it to you.

Next step is `embed.ipynb`.  This does the heavy lifting of processing the raw hiscore updates, de-duping, and assigns each score an ID consisting of the actual beatmap ID and a subset of differentiating mods used on it.  Since some mods dramatically change the difficulty of the map and the pp it gives, certain mod combos are treated as distinct entries for the embedding.  So it will be something like `856861_DT` or `949011_` for each score.

Then, a big co-occurrence matrix is created from all the hiscores.  Each unique ID from above is assigned an index.  Then, we loop through the hiscores of each user.  For each pair of beatmaps, we increment the value at `matrix[beatmap_1_index][beatmap_2_index]` - weighted by how close in PP those two scores are.

**This matrix essentially acts as a weighted graph.  Beatmaps that occur together often in user' profiles get higher edge weights, which provides a lot of info about which beatmaps are similar.**

Once the co-occurrence matrix is constructed, some postprocessing is done to prune it out a bit to reduce the memory usage and transform the edge weights into distances.  At that point, it's ready to be passed to the [PyMDE](https://pymde.org/index.html) library.  This is a very powerful toolkit for generating embeddings out of raw vectors or graphs.

For graph/PyMDE parameter experiments, use `just embedding-experiment`. The helper in `scripts/embedding_experiments.py` runs PyMDE from a precomputed exact KNN graph and projects a result with UMAP. It still contains the earlier normalized-graph paths for reproducibility, but those are not part of the active iteration plan.

Do not use the outgoing-edge `direct` KNN path as a baseline replacement. PyMDE's weighted graph implementation runs directed Dijkstra, retains only destinations whose numeric index is greater than the source, and symmetrizes those distances afterward. Because the top-700 matrix is asymmetric after row-wise pruning, selecting each row's direct neighbors produces a materially different graph: on the 2026 graph, zero in-degree rises from 34% to 85% and the top 1% in-degree share rises from 47% to 86%. This was the source of the membrane-like fast-path experiments.

Run `just exact-knn` to reproduce PyMDE's actual full-path semantics efficiently. The Rust helper in `scripts/exact-knn` searches the forward and reverse graphs together and stops after the ten eligible nearest neighbors (including ties) have settled. Python then applies PyMDE's own final tie ordering. The 56,415-node graph completes in about 27 seconds end-to-end with four threads, versus roughly an hour in PyMDE. A deterministic 64-row audit exactly matched scipy's directed Dijkstra neighbor identities and distances. The resulting graph is cached at `data/knn_raw_baseline_exact_k10.npz` and can be reused for every PyMDE seed.

Example commands, run after `just launch-jupyter`:

```sh
just exact-knn
just embedding-experiment embed --graph data/top_cooccurrence_raw.npz --knn-graph data/knn_raw_baseline_exact_k10.npz --output data/pymde_raw_full_equivalent_seed42.w2v --n-neighbors 10 --seed 42 --negative-seed 42 --torch-threads 4
just embedding-experiment project --embedding data/pymde_raw_full_equivalent_seed42.w2v --output data/embedding_candidate_raw_full_equivalent_seed42_umap150.json
just umap-sweep
```

The August 2026 SPPMI and raw/SPPMI hybrid experiments are shelved. Across the tested parameters they fragmented global PP structure or amplified the string/membrane behavior, and none improved on the corrected raw-count baseline. Their code and artifacts remain available as historical controls, but new sweeps should stay on the raw graph unless there is a new normalization hypothesis.

`just umap-sweep` produces the resumable 8×8 UMAP comparison at `data/umap_param_sweep_grid.png`. It varies `n_neighbors` across 15, 30, 60, 100, 150, 225, 350, and 500, and `min_dist` across 0, 0.05, 0.1, 0.2, 0.25, 0.35, 0.5, and 0.8. Every cell uses the corrected seed-42 PyMDE baseline; n=150/min_dist=0.25 is outlined as the reference. Native numerical thread pools are pinned to one thread per worker, and the default of eight workers uses at most roughly eight CPUs.

The native thread setting is part of projection reproducibility. With UMAP 0.5.12, the pinned n=150/min_dist=0.25 result is not bit-identical to an earlier uncapped projection despite the same UMAP seed (the layouts remain broadly similar), while two independent pinned runs are exactly identical. Keep the controlled thread defaults when comparing or promoting new coordinates.

For the focused PyMDE comparison, first generate the additional exact raw-graph neighborhoods and then run the sweep:

```sh
just exact-knn-sweep
just pymde-sweep
```

This produces `data/pymde_param_sweep_grid.png`. It changes one PyMDE control at a time from the seed-42 baseline—attractive penalty, repulsive-edge fraction, exact neighbor count, constraint, latent dimension, and initialization—and projects every result with the fixed UMAP n=150/min_dist=0.25/seed=42 settings. Fits default to two concurrent processes with four PyTorch threads each. A 5,000-iteration control was rejected after its line search reached a zero step at iteration 1,900 and repeated identical distortion/residual values through iteration 2,000; raising the ceiling would spend time without changing the embedding.

Run `just sweep-metrics data/umap_sweep_corrected_seed42` (or point it at the PyMDE sweep directory) to write a quantitative companion CSV. It reports source-neighborhood retention, sampled global-distance correlation, local 2D anisotropy/string fraction, local PP variation, density variation, and global axis ratio. These are diagnostics rather than an automatic aesthetic score, but they make it easier to distinguish genuine parameter trends from visual orientation and scaling.

PyMDE's random initialization and its sampled repulsive edges are separate sources of layout variance. `--seed` controls the initialization and defaults to 42; `--negative-seed` can vary only the repulsive-edge sample while holding initialization fixed. Use this when auditing whether a visual feature is stable across force-layout runs.

The Jupyter image currently exposes 16 PyTorch threads. Use `--torch-threads 4` (or another suitable limit) to keep an experiment from monopolizing the machine. `just exact-knn` takes the neighbor count and thread count as arguments, defaulting to 10 neighbors and four Rust worker threads; override with, for example, `just exact-knn 10 8`.

Use `scripts/render_embedding_grid.py` to render labeled `LABEL=PATH` JSON candidates with a shared PP color scale. The corrected fast-path comparison is `data/embedding_fastpath_equivalence_grid.png`.

Along the way, there are a ton of parameters that are tweakable.  I've experimented with a variety of different settings with the goal of producing embeddings that both look good as well as convey a lot of valuable info about the underlying patterns in the data.

Although PyMDE does a good job, I've personally found that it doesn't do the best job producing visually pleasing 2D embeddings.  As a solution, I produce 3 or higher dimensional embeddings and then project them down into 2D as an additional step using a different algorithm.

That's where `emblaze.py` comes in.  [Emblaze](https://github.com/cmudig/emblaze) is a very cool tool for generating and visualizing embeddings using a variety of different algorithms.  It has a Python Notebook extension, which I use.

In that file, I generate + load the output files from the `embed.ipynb` notebook and use Emblaze to generate and visualize some 2D embeddings.  I also merge it with metadata at this stage to label the elements so I can tell which is which, mark my own hiscores to see how good of a job it's doing, color the circles by pp, bpm, length, release year, etc. and more.

That will produce `data/embedding_new_2.json`. This needs to be joined with beatmap metadata and canonical difficulty data by the helper in `/scripts/beatmap-downloader`.

Run the private `osu-api-bridge/diffcalc` sidecar first and configure `DIFFCALC_URL` and `DIFFCALC_API_KEY` in the helper's `.env`. The sidecar uses the official osu! .NET ruleset packages, reads cached beatmaps directly from MySQL, and downloads missing maps at the configured upstream rate limit.

From `scripts/beatmap-downloader`, run:

```sh
cargo run --release -- download-relevant
cargo run --release -- refresh-empty
cargo run --release -- compute-embedding
cargo run --release -- dump-difficulties
cargo run --release -- build-corpus
```

`download-relevant` queries the live history table for uncached osu!standard beatmaps with PP at or above the embedding threshold, so cache filling can start before a fresh `score_metadata.csv` exists. `refresh-empty` replaces historical zero-byte cache entries and rejects invalid HTTP-200 responses. `compute-embedding` sends every identity in `score_id_mapping.csv` to diffcalc in batches of 256 and bulk-upserts each batch, intentionally replacing star/skill values previously produced by `rosu-pp`. It writes `data/difficulty_failures.csv` and refuses to succeed if any selected calculation fails. Use `compute-all` only when the entire unfiltered `score_metadata.csv` history needs to be refreshed. `dump-difficulties` refreshes `data/difficulties.csv` before the corpus is assembled.

The historical `hiscore_updates` rows do not contain combo or hit-result counts, so their stored PP values cannot be accurately recalculated. The embedding continues to use those historical PP values for filtering and co-occurrence weighting. Current score PP simulations and the osu!track hiscores API are recalculated through diffcalc because those paths have complete score statistics.

## Fresh iteration checklist

1. Preserve the last known-good artifacts, then run `just extract-data` and validate the resulting Parquet row counts and schemas.
2. Run `embed.ipynb` to create the normalized score identities, `score_metadata.csv`, co-occurrence graph, and 3D PyMDE embedding. The notebook accepts both the new pre-filtered export and legacy full-table dumps.
3. Generate a fresh corrected raw-count candidate first. This isolates data growth and pipeline correctness changes from projection experiments. Keep SPPMI shelved unless a materially different normalization hypothesis warrants revisiting it.
4. Use `emblaze.ipynb` to compare 2D projections. Keep the current UMAP 150/170-neighbor projections as controls and evaluate the documented PaCMAP projection alongside them before selecting the final coordinates.
5. Run the Rust helper commands above. `compute-embedding` fails the run if any selected canonical difficulty calculation fails, and `build-corpus` refuses to substitute zeroes for missing difficulty or metadata records.
6. Sanity-check item counts, coordinate finiteness, metadata joins, and difficulty coverage before publishing the corpus or frontend.

## Runnning Them Yourself

I currently run a Jupyter notebook server in Docker using the script in [`Justfile`](https://github.com/casey/just): `just launch-jupyter`.  I then use VS Code to load the notebooks and connect to the server.

For the `emblaze.ipynb` notebook, open the Jupyter server at http://localhost:8888/ directly since the interactive Emblaze viewer does not work in VS Code. Use **Restart Kernel and Run All Cells** to build the current UMAP and PaCMAP variants. The projection-spec cell is the main experimentation surface. The export cell writes a named candidate by default and only replaces `embedding_new_2.json` when `PROMOTE_TO_FINAL` is explicitly enabled.

Let me know if you have trouble running them; I'd be happy to help.
