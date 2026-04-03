#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -d node_modules ]]; then
  npm ci
fi

npm run dev -- --host 0.0.0.0 --port 5173
