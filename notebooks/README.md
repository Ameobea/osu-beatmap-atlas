# Notebooks

These Python notebooks are used to pull the source data, pre-process it, generate embeddings, and visualize the outcome.

This is a very similar process to the one I used to create my [anime atlas](https://anime.ameo.dev/pymde_4d_40n) project. ([code](https://github.com/Ameobea/sprout/tree/main/notebooks))

## Process

The process starts in `extract-data.ipynb`.  It pulls the raw data from the osu!track database.  It generates `hiscore_updates.parquet` which is loaded by the next notebook.  It's not going to work if you're not me since it requires DB access, though, but don't worry:

You can retrieve a pre-pulled `hiscore_updates.parquet` from [here](https://ameo.dev/hiscore_updates.parquet).  If that link ever dies, ping me on Discord @ameo and I'll send it to you.

Next step is `embed.ipynb`.  This does the heavy lifting of processing the raw hiscore updates, de-duping, and assigns each score an ID consisting of the actual beatmap ID and a subset of differentiating mods used on it.  Since some mods dramatically change the difficulty of the map and the pp it gives, certain mod combos are treated as distinct entries for the embedding.  So it will be something like `856861_DT` or `949011_` for each score.

Then, a big co-occurrence matrix is created from all the hiscores.  Each unique ID from above is assigned an index.  Then, we loop through the hiscores of each user.  For each pair of beatmaps, we increment the value at `matrix[beatmap_1_index][beatmap_2_index]` - weighted by how close in PP those two scores are.

**This matrix essentially acts as a weighted graph.  Beatmaps that occur together often in user' profiles get higher edge weights, which provides a lot of info about which beatmaps are similar.**

Once the co-occurrence matrix is constructed, some postprocessing is done to prune it out a bit to reduce the memory usage and transform the edge weights into distances.  At that point, it's ready to be passed to the [PyMDE](https://pymde.org/index.html) library.  This is a very powerful toolkit for generating embeddings out of raw vectors or graphs.

Along the way, there are a ton of parameters that are tweakable.  I've experimented with a variety of different settings with the goal of producing embeddings that both look good as well as convey a lot of valuable info about the underlying patterns in the data.

Although PyMDE does a good job, I've personally found that it doesn't do the best job producing visually pleasing 2D embeddings.  As a solution, I produce 3 or higher dimensional embeddings and then project them down into 2D as an additional step using a different algorithm.

That's where `emblaze.py` comes in.  [Emblaze](https://github.com/cmudig/emblaze) is a very cool tool for generating and visualizing embeddings using a variety of different algorithms.  It has a Python Notebook extension, which I use.

In that file, I generate + load the output files from the `embed.ipynb` notebook and use Emblaze to generate and visualize some 2D embeddings.  I also merge it with metadata at this stage to label the elements so I can tell which is which, mark my own hiscores to see how good of a job it's doing, color the circles by pp, bpm, length, release year, etc. and more.

That will produce a file `embedding_new.json`.  This needs to be joined with computed beatmap metadata and difficulty data which is downloaded and computed by a Rust script.  That lives in `/scripts/beatmap-downloader`.

Run `cr --release -- download` to fetch all of the beatmaps needed to compute difficulty data.

Then when that's finished, run `cr --release -- build-corpus` to convert do the data joining and produce a binary file that the frontend reads which contains

## Runnning Them Yourself

I currently run a Jupyter notebook server in Docker using the script in [`Justfile`](https://github.com/casey/just): `just launch-jupyter`.  I then use VS Code to load the notebooks and connect to the server.

For the `emblaze.py` notebook, I go to the http://localhost:8888/ web server directly since Emblaze doesn't work in VS Code.

Let me know if you have trouble running them; I'd be happy to help.
