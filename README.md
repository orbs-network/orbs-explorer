# Orbs Explorer

Track advanced orders, trade progress, and activity across trading apps.
Built with Next.js and React.

## Local development

Install dependencies with `yarn install --frozen-lockfile`, then run:

```bash
npm run dev
```

Open [localhost:3003](http://localhost:3003). Fonts are Montserrat and JetBrains Mono.

## Deploy to Vercel

The deployment script targets project `prj_iCIuRd8iUPHYmu2bePAcTj6fRNUD` explicitly,
including when this checkout's existing `.vercel` link points to another project.
It runs lint, typecheck, and tests before uploading source. Vercel builds remotely
with the selected environment's project settings and variables.

Use Node.js 22 or newer. The script runs a pinned Vercel CLI through `npx`.
Authenticate before each run with `npx vercel@58.9.0 login`, or provide `VERCEL_TOKEN` through
your shell or CI secrets. If needed, set `VERCEL_SCOPE` to the project's team slug.

The script logs out the saved Vercel CLI session when it exits, including failed
checks or deployments. Logout does not revoke environment tokens or change your
parent shell's environment. Help and dry runs do not log out. If logout fails,
the script reports it and returns a failure status.

```bash
npm run deploy                 # Preview target
npm run deploy:prod            # Production target
npm run deploy -- --dry-run    # Show commands without executing anything
```

Vercel treats a project's first deployment as production even if the preview
target is requested; subsequent deployments follow the selected target.

Configure application environment variables in the Vercel project dashboard.
Local `.env` files, credentials, build output, and browser audit artifacts are
excluded by `.vercelignore`. Authentication tokens stay in the environment,
rather than in command arguments or script output.

Token metadata uses `NEXT_PUBLIC_RPC_URL` as an optional RPC proxy base URL
(`{base}/rpc?chainId={id}&appId=debug-tool`). If it is unset or unavailable,
the app falls back to the public RPC endpoints in the chain registry. Set the
proxy variable in both Preview and Production for your preferred RPC service.
Unresolved symbols retry on a later refresh; token addresses remain visible
when metadata cannot be read.

The existing `vercel.json` includes the production Telegram-alert cron schedule.

See the [Vercel deployment CLI documentation](https://vercel.com/docs/cli/deploy)
and [project selection options](https://vercel.com/docs/cli/global-options#project).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
