#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-docker.io/andpra70}"
IMAGE_NAME="${IMAGE_NAME:-ginnastica-calistenics-app}"
TAG="${TAG:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-ginnastica-app}"
HOST_PORT="${HOST_PORT:-8080}"
CONTAINER_PORT="${CONTAINER_PORT:-8080}"
PULL_IMAGE="${PULL_IMAGE:-true}"

FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container: ${CONTAINER_NAME}"
  docker stop "${CONTAINER_NAME}" >/dev/null
  echo "Removing existing container: ${CONTAINER_NAME}"
  docker rm "${CONTAINER_NAME}" >/dev/null
fi

if [[ "${PULL_IMAGE}" == "true" ]]; then
  echo "Pulling image: ${FULL_IMAGE}"
  docker pull "${FULL_IMAGE}"
else
  echo "Pull skipped (PULL_IMAGE=${PULL_IMAGE})"
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  --restart unless-stopped \
  "${FULL_IMAGE}"

echo "Container started successfully"
echo "Container: ${CONTAINER_NAME}"
echo "Image: ${FULL_IMAGE}"
echo "URL: http://localhost:${HOST_PORT}"
