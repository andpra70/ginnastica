#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

REGISTRY="${REGISTRY:-docker.io/andpra70}"
IMAGE_NAME="${IMAGE_NAME:-ginnastica-calistenics-app}"
TAG="${TAG:-latest}"
PUSH_IMAGE="${PUSH_IMAGE:-true}"

FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "Building image: ${FULL_IMAGE}"
docker build -t "${FULL_IMAGE}" .

if [[ "${PUSH_IMAGE}" == "true" ]]; then
  echo "Pushing image: ${FULL_IMAGE}"
  docker push "${FULL_IMAGE}"
else
  echo "Push skipped (PUSH_IMAGE=${PUSH_IMAGE})"
fi

echo "Deploy image ready: ${FULL_IMAGE}"
