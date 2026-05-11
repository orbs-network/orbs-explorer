#!/usr/bin/env bash
# Capture before/after screenshots for a PR.
#
# Usage:
#   ./scripts/pr-screenshots.sh <base-ref> <head-ref> <paths-comma-separated>
#
# Example:
#   ./scripts/pr-screenshots.sh main feat/explorer-scaffolding "/,/twap,/explorer"
#
# Requirements: clean working tree on entry. Restores original branch on exit.
# Output: .screenshots/before/ and .screenshots/after/

set -euo pipefail

BASE_REF=${1:-}
HEAD_REF=${2:-}
PATHS=${3:-}
PORT=${PORT:-3003}

if [[ -z "$BASE_REF" || -z "$HEAD_REF" || -z "$PATHS" ]]; then
  echo "Usage: $0 <base-ref> <head-ref> <paths-comma-separated>"
  exit 2
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree must be clean before running PR screenshots." >&2
  echo "Commit or stash your changes first." >&2
  exit 1
fi

ORIGINAL_REF=$(git symbolic-ref --quiet --short HEAD || git rev-parse HEAD)
DEV_LOG=$(mktemp)
DEV_PID=""

cleanup() {
  if [[ -n "$DEV_PID" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
    DEV_PID=""
  fi
  if [[ "$(git symbolic-ref --quiet --short HEAD || true)" != "$ORIGINAL_REF" ]]; then
    git checkout --quiet "$ORIGINAL_REF" || true
  fi
  rm -f "$DEV_LOG"
}
trap cleanup EXIT INT TERM

start_dev() {
  : > "$DEV_LOG"
  # Use npx next dev directly so the script works regardless of which
  # package manager (yarn / pnpm / npm) is installed on the host.
  npx next dev --port "$PORT" >"$DEV_LOG" 2>&1 &
  DEV_PID=$!
  local waited=0
  until grep -q "Ready in" "$DEV_LOG"; do
    sleep 0.5
    waited=$((waited + 1))
    if [[ $waited -gt 120 ]]; then
      echo "Dev server failed to start within 60s" >&2
      tail -50 "$DEV_LOG" >&2
      exit 1
    fi
  done
  # Give the server a moment after "Ready" before hitting it
  sleep 1
}

stop_dev() {
  if [[ -n "$DEV_PID" ]]; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
    DEV_PID=""
  fi
}

shoot_label() {
  local ref=$1
  local label=$2
  echo
  echo "=== $label  ($ref) ==="
  git checkout --quiet "$ref"
  start_dev
  node scripts/screenshot.mjs "$label" "$PATHS" --base-url="http://localhost:$PORT"
  stop_dev
}

shoot_label "$BASE_REF" before
shoot_label "$HEAD_REF" after

echo
echo "Done. Screenshots in .screenshots/before and .screenshots/after"
