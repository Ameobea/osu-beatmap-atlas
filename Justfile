set dotenv-load := true

launch-jupyter:
  #!/usr/bin/env zsh

  id="$(docker run -d --rm --name osutrack-jupyter --net host -v "${PWD}":/home/jovyan/work -e DB_HOST="${DB_HOST}" -e DB_USER="${DB_USER}" -e DB_PASSWORD="${DB_PASSWORD}" --user root --memory-swap -1 -e GRANT_SUDO=yes quay.io/jupyter/datascience-notebook:2025-10-06)"
  echo "Launched docker container with id=${id}"
  sleep 2
  echo "$((docker logs $id) 2>&1 | grep token | head -n 1)"

build-and-deploy:
  #!/bin/bash

  cd ./scripts/beatmap-downloader && cargo run --release -- build-corpus && cd -
  CORPUS_FILENAME="corpus_$(date +%s).txt"
  cp ./data/corpus "/tmp/$CORPUS_FILENAME"
  curl -T "/tmp/$CORPUS_FILENAME" ftp://$CORPUS_FTP_USERNAME:$CORPUS_FTP_PASSWORD@$CORRPUS_FTP_HOSTNAME/$CORPUS_FILENAME
  rm "/tmp/$CORPUS_FILENAME"

  cd frontend && PUBLIC_CORPUS_URL="https://osu-map.b-cdn.net/${CORPUS_FILENAME}" just build-and-deploy
