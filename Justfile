set dotenv-load := true

launch-jupyter:
  #!/usr/bin/env zsh

  id="$(docker run -d --rm --name osutrack-jupyter --net host -v "${PWD}":/home/jovyan/work -e DB_HOST="${DB_HOST}" -e DB_USER="${DB_USER}" -e DB_PASSWORD="${DB_PASSWORD}" --user root --memory-swap -1 -e GRANT_SUDO=yes quay.io/jupyter/datascience-notebook:2024-03-14)"
  echo "Launched docker container with id=${id}"
  sleep 2
  echo "$((docker logs $id) 2>&1 | grep token | head -n 1)"
