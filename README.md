# pr-assets

Storage branch for PR review artifacts (before/after screenshots and similar).

Each PR gets its own folder, e.g. `pr-1/`, `pr-2/`. Files are referenced from
PR descriptions via:

    https://raw.githubusercontent.com/orbs-network/orbs-explorer/pr-assets/<pr-folder>/<file>

This branch is auto-managed by `scripts/screenshot-upload.sh` (in the main code
branches). Don't merge it into anything — it has no shared ancestry with main.
