#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="prj_iCIuRd8iUPHYmu2bePAcTj6fRNUD"
VERCEL_CLI_VERSION="58.9.0"
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="preview"
DRY_RUN=false

usage() {
  cat <<'HELP'
Usage: ./scripts/deploy-vercel.sh [--prod | --preview] [--dry-run]

Runs lint, typecheck and tests, then deploys this repository to Vercel.
Logs out the saved Vercel CLI session on exit, including failed runs.
The default target is preview. --prod deploys to production.
--dry-run prints the steps without running checks or contacting Vercel.

Authenticate with `vercel login`, or set VERCEL_TOKEN for CI.
Optional: set VERCEL_SCOPE to the team slug that owns the project.
HELP
}

for argument in "$@"; do
  case "$argument" in
    --prod) TARGET="production" ;;
    --preview) TARGET="preview" ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h) usage; exit 0 ;;
    *) printf '%s\n' 'Unsupported deployment option. Run --help for usage.' >&2; exit 2 ;;
  esac
done

cd "$REPO_ROOT"
DEPLOY=(npx --yes "vercel@${VERCEL_CLI_VERSION}" deploy
  --cwd "$REPO_ROOT" --project "$PROJECT_ID" --target "$TARGET"
  --yes --non-interactive)
if [[ -n "${VERCEL_SCOPE:-}" ]]; then
  DEPLOY+=(--scope "$VERCEL_SCOPE")
fi
LOGOUT=(env -u VERCEL_TOKEN -u VERCEL_AUTH_TOKEN
  npx --yes "vercel@${VERCEL_CLI_VERSION}" logout --non-interactive)

printf 'Vercel project: %s\nTarget: %s\n' "$PROJECT_ID" "$TARGET"
if [[ "$DRY_RUN" == true ]]; then
  printf '%s\n' 'npm run lint' 'npm run typecheck' 'npm test'
  printf '%q ' "${DEPLOY[@]}"
  printf '\n'
  printf '%q ' "${LOGOUT[@]}"
  printf '\n'
  exit 0
fi

cleanup() {
  local status=$?
  local logout_status=0
  trap - EXIT INT TERM
  printf '\nLogging out of the saved Vercel CLI session…\n' >&2
  # Use saved credentials for logout, so reusable CI tokens are not revoked.
  "${LOGOUT[@]}" >&2 || logout_status=$?
  if [[ "$logout_status" -ne 0 ]]; then
    printf 'Vercel logout failed (exit %s). Run vercel logout to retry.\n' "$logout_status" >&2
    if [[ "$status" -eq 0 ]]; then
      status=$logout_status
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm run lint
npm run typecheck
npm test

# Vercel builds remotely using the target project's settings and environment.
# VERCEL_TOKEN is inherited through the environment, never printed or passed
# as a command-line argument. --project overrides any old .vercel link.
"${DEPLOY[@]}"
