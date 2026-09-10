set dotenv-load := true

launch-jupyter:
  #!/usr/bin/env zsh

  id="$(docker run -d --rm --name osutrack-jupyter --net host -v "${PWD}":/home/jovyan/work -e DB_HOST="${DB_HOST}" -e DB_USER="${DB_USER}" -e DB_PASSWORD="${DB_PASSWORD}" --user root --memory-swap -1 -e GRANT_SUDO=yes quay.io/jupyter/datascience-notebook:2025-10-06)"
  echo "Launched docker container with id=${id}"
  sleep 2
  echo "$((docker logs $id) 2>&1 | grep token | head -n 1)"

extract-data *args:
  docker run --rm --name osutrack-data-extract --net host \
    -v "${PWD}":/home/jovyan/work -w /home/jovyan/work \
    -e DB_HOST="${DB_HOST}" -e DB_PORT="${DB_PORT:-3306}" \
    -e DB_USER="${DB_USER}" -e DB_PASSWORD="${DB_PASSWORD}" \
    -e DB_DATABASE="${DB_DATABASE:-osutrack_migration}" \
    quay.io/jupyter/datascience-notebook:2025-10-06 \
    bash -lc 'pip install --quiet "PyMySQL>=1.1,<2" && python notebooks/extract_data.py {{args}}'

embedding-experiment *args:
  docker exec -w /home/jovyan/work osutrack-jupyter \
    python scripts/embedding_experiments.py {{args}}

umap-sweep *args:
  docker exec -w /home/jovyan/work osutrack-jupyter \
    python scripts/umap_param_sweep.py {{args}}

pymde-sweep *args:
  docker exec -w /home/jovyan/work osutrack-jupyter \
    python scripts/pymde_param_sweep.py {{args}}

sweep-metrics directory *args:
  docker exec -w /home/jovyan/work osutrack-jupyter \
    python scripts/projection_sweep_metrics.py {{directory}} {{args}}

exact-knn neighbors="10" threads="4":
  #!/usr/bin/env bash
  set -euo pipefail
  max_distance="$(docker exec -w /home/jovyan/work osutrack-jupyter python -c "import torch, pymde; from scipy.sparse import load_npz; graph = pymde.preprocess.Graph(load_npz('data/top_cooccurrence_raw.npz').tocsr()); print((3 * torch.quantile(graph.distances, 0.75)).item())")"
  cargo run --release --manifest-path scripts/exact-knn/Cargo.toml -- \
    --input data/top_cooccurrence_raw.npz \
    --output "data/baseline_exact_candidate_distances_k{{neighbors}}.npz" \
    --neighbors {{neighbors}} --max-distance "$max_distance" --threads {{threads}}
  docker exec -w /home/jovyan/work osutrack-jupyter \
    python scripts/embedding_experiments.py finalize-knn \
    --candidates "data/baseline_exact_candidate_distances_k{{neighbors}}.npz" \
    --output "data/knn_raw_baseline_exact_k{{neighbors}}.npz" \
    --n-neighbors {{neighbors}} --max-distance "$max_distance"

exact-knn-sweep threads="4":
  #!/usr/bin/env bash
  set -euo pipefail
  max_distance="$(docker exec -w /home/jovyan/work osutrack-jupyter python -c "import torch, pymde; from scipy.sparse import load_npz; graph = pymde.preprocess.Graph(load_npz('data/top_cooccurrence_raw.npz').tocsr()); print((3 * torch.quantile(graph.distances, 0.75)).item())")"
  candidates="data/baseline_exact_candidate_distances_k25.npz"
  cargo run --release --manifest-path scripts/exact-knn/Cargo.toml -- \
    --input data/top_cooccurrence_raw.npz --output "$candidates" \
    --neighbors 25 --max-distance "$max_distance" --threads {{threads}}
  for neighbors in 5 15 25; do
    docker exec -w /home/jovyan/work osutrack-jupyter \
      python scripts/embedding_experiments.py finalize-knn \
      --candidates "$candidates" \
      --output "data/knn_raw_baseline_exact_k${neighbors}.npz" \
      --n-neighbors "$neighbors" --max-distance "$max_distance"
  done

build-and-deploy:
  #!/bin/bash

  cd ./scripts/beatmap-downloader && cargo run --release -- build-corpus && cd -
  CORPUS_FILENAME="corpus_$(date +%s).txt"
  cp ./data/corpus "/tmp/$CORPUS_FILENAME"
  curl -T "/tmp/$CORPUS_FILENAME" ftp://$CORPUS_FTP_USERNAME:$CORPUS_FTP_PASSWORD@$CORRPUS_FTP_HOSTNAME/$CORPUS_FILENAME
  rm "/tmp/$CORPUS_FILENAME"

  cd frontend && PUBLIC_CORPUS_URL="https://osu-map.b-cdn.net/${CORPUS_FILENAME}" just build-and-deploy
