#!/usr/bin/env bash
# Upload screenshots to the pr-assets orphan branch and emit markdown URLs.
#
# Usage:
#   ./scripts/screenshot-upload.sh <tag> [<source-dir>]
#
# Example:
#   ./scripts/screenshot-upload.sh pr-1
#   ./scripts/screenshot-upload.sh pr-7 .screenshots
#
# Behaviour:
#   - Reads from <source-dir> (default .screenshots) on the current branch.
#   - Pushes them to origin/pr-assets under <tag>/, creating the orphan branch
#     if it doesn't exist.
#   - Uses git worktree so the current working tree is untouched.
#   - Prints raw.githubusercontent.com URLs ready to paste into a PR body.
#
# The pr-assets branch is an orphan (no shared history with main). Don't
# merge it — it exists only to host review artifacts.

set -euo pipefail

TAG=${1:-}
SRC=${2:-.screenshots}

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag> [<source-dir>]" >&2
  exit 2
fi
if [[ ! -d "$SRC" ]]; then
  echo "Source directory does not exist: $SRC" >&2
  exit 1
fi

REMOTE_URL=$(git config --get remote.origin.url)
# Extract owner/repo from common remote URL formats (git@host:owner/repo.git or https://host/owner/repo.git)
OWNER_REPO=$(echo "$REMOTE_URL" | sed -E 's#^.*[:/]([^:/]+/[^/]+)$#\1#; s#\.git$##')

WORKTREE=$(mktemp -d -t pr-assets-XXXXXX)
cleanup() {
  if git worktree list --porcelain 2>/dev/null | grep -q "$WORKTREE"; then
    git worktree remove --force "$WORKTREE" 2>/dev/null || true
  fi
  rm -rf "$WORKTREE"
}
trap cleanup EXIT INT TERM

# Make sure we have origin/pr-assets locally if it exists on the remote.
git fetch origin pr-assets 2>/dev/null || true

if git rev-parse --verify --quiet origin/pr-assets >/dev/null; then
  git worktree add "$WORKTREE" origin/pr-assets >/dev/null
  pushd "$WORKTREE" >/dev/null
  git checkout -B pr-assets origin/pr-assets >/dev/null
else
  echo "pr-assets branch not found on remote, creating it"
  git worktree add --detach "$WORKTREE" >/dev/null
  pushd "$WORKTREE" >/dev/null
  git checkout --orphan pr-assets >/dev/null
  git rm -rf . >/dev/null 2>&1 || true
  cat > README.md <<'README'
# pr-assets

Storage branch for PR review artifacts (before/after screenshots).
Each PR gets its own folder. Files are referenced from PR descriptions via:

    https://raw.githubusercontent.com/<owner>/<repo>/pr-assets/<tag>/<path>

Auto-managed by `scripts/screenshot-upload.sh`. Don't merge into main —
this branch has no shared history.
README
  git add README.md
  git commit -m "init pr-assets orphan branch" >/dev/null
fi

DEST="$WORKTREE/$TAG"
rm -rf "$DEST"
mkdir -p "$DEST"

# Source paths are relative to the original working dir, so use absolute path
ABS_SRC=$(cd "$OLDPWD" && cd "$SRC" && pwd)
cp -R "$ABS_SRC"/. "$DEST/"

git add "$TAG"
if git diff --cached --quiet; then
  echo "No changes to upload for tag '$TAG'"
else
  git commit -m "screenshots: $TAG" >/dev/null
  git push -u origin pr-assets >/dev/null 2>&1 \
    || git push -u origin pr-assets
fi
popd >/dev/null

BASE_URL="https://raw.githubusercontent.com/${OWNER_REPO}/pr-assets/${TAG}"

echo
echo "Uploaded. Markdown URLs:"
echo
( cd "$WORKTREE/$TAG" && find . -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.gif' \) | sort | while read -r rel; do
    rel_clean=${rel#./}
    echo "![${rel_clean}](${BASE_URL}/${rel_clean})"
  done )
