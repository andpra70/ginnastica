#!/usr/bin/env bash
set -euo pipefail

git add .
git commit -m "Update site"
git push
