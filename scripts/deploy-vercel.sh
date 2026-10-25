#!/usr/bin/env bash
set -euo pipefail

EXPLORER_PROJECT_ID="prj_iCIuRd8iUPHYmu2bePAcTj6fRNUD"
APP="explorer"
VERCEL_CLI_VERSION="58.9.0"
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="preview"
DRY_RUN=false

usage() {
  cat <<'HELP'
Usage: ./scripts/deploy-vercel.sh [--app explorer|ops] [--prod | --preview] [--dry-run]

Runs lint, typecheck and tests, configures the selected Vercel project root,
then deploys that application independently.
Logs out the saved Vercel CLI session on exit, including failed runs.
The default target is preview. --prod deploys to production.
--dry-run prints the steps without running checks or contacting Vercel.

Authenticate with `vercel login`, or set VERCEL_TOKEN for CI.
Optional: set VERCEL_SCOPE to the team slug that owns the project.
Ops requires OPS_VERCEL_PROJECT_ID (the ID of a separate existing project).
HELP
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; APP="$2"; shift ;;
    --prod) TARGET="production" ;;
    --preview) TARGET="preview" ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h) usage; exit 0 ;;
    *) printf '%s\n' 'Unsupported deployment option. Run --help for usage.' >&2; exit 2 ;;
  esac
  shift
done
case "$APP" in
  explorer) PROJECT_ID="$EXPLORER_PROJECT_ID" ;;
  ops) PROJECT_ID="${OPS_VERCEL_PROJECT_ID:-}"
    if [[ ! "$PROJECT_ID" =~ ^prj_[a-zA-Z0-9]+$ || "$PROJECT_ID" == "$EXPLORER_PROJECT_ID" ]]; then
      printf '%s\n' 'Set OPS_VERCEL_PROJECT_ID to a separate existing Vercel project ID.' >&2
      exit 2
    fi ;;
  *) printf '%s\n' 'Choose --app explorer or --app ops.' >&2; exit 2 ;;
esac

cd "$REPO_ROOT"
DEPLOY=(npx --yes "vercel@${VERCEL_CLI_VERSION}" deploy
  --cwd "$REPO_ROOT" --project "$PROJECT_ID" --target "$TARGET"
  --yes --non-interactive)
if [[ -n "${VERCEL_SCOPE:-}" ]]; then
  DEPLOY+=(--scope "$VERCEL_SCOPE")
fi
CONFIGURE=(npx --yes "vercel@${VERCEL_CLI_VERSION}" api "/v9/projects/$PROJECT_ID"
  --method PATCH --input "$REPO_ROOT/apps/$APP/vercel-project.json"
  --silent --non-interactive)
if [[ -n "${VERCEL_SCOPE:-}" ]]; then
  CONFIGURE+=(--scope "$VERCEL_SCOPE")
fi
LOGOUT=(env -u VERCEL_TOKEN -u VERCEL_AUTH_TOKEN
  npx --yes "vercel@${VERCEL_CLI_VERSION}" logout --non-interactive)

printf 'Application: %s\nVercel project: %s\nTarget: %s\n' "$APP" "$PROJECT_ID" "$TARGET"
if [[ "$DRY_RUN" == true ]]; then
  printf '%s\n' 'pnpm run lint' 'pnpm run typecheck' 'pnpm test'
  printf '%q ' "${CONFIGURE[@]}"
  printf '\n'
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

pnpm run lint
pnpm run typecheck
pnpm test

# Upload the repository root so shared workspace packages are available.
# Each remote project selects its own application directory for the build.
"${CONFIGURE[@]}"

# Vercel builds remotely using the target project's settings and environment.
# VERCEL_TOKEN is inherited through the environment, never printed or passed
# as a command-line argument. --project overrides any old .vercel link.
"${DEPLOY[@]}"
