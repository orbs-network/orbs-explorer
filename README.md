# Orbs Explorer workspace

A pnpm monorepo containing two independently deployed Next.js applications.

| Workspace         | Purpose                                                                          | Local address         | Vercel root directory |
| ----------------- | -------------------------------------------------------------------------------- | --------------------- | --------------------- |
| `apps/explorer`   | Public order search, order details, and existing explorers                       | http://localhost:3003 | `apps/explorer`       |
| `apps/ops`        | Staff order diagnostics, analytics, and monitoring                              | http://localhost:3004 | `apps/ops`            |
| `packages/domain` | Shared order models, status calculations, API clients, token metadata, and hooks | —                     | —                     |
| `packages/ui`     | Shared controls, filters, providers, and design tokens                           | —                     | —                     |

Applications import `@orbs/domain/*` and `@orbs/ui/*`. Shared packages must not
import either app. Keep internal credentials, authorization, and operational
features in `apps/ops`; a shared package does not make a data source private.
Application navigation stays with its owning app.

## Local development

Use Node.js 22+ and pnpm 10.6.5 (`corepack enable` if needed).

```bash
pnpm install --frozen-lockfile
cp apps/explorer/.env.example apps/explorer/.env.local
cp apps/ops/.env.example apps/ops/.env.local
pnpm dev                  # Both apps
pnpm dev:explorer         # Public explorer only
pnpm dev:ops              # Staff dashboard only
```

Do not overwrite existing local env files. Next.js loads each app's own
`.env.local`; repository-root env files are not shared between apps. Existing
local settings were relocated during migration.

Google sign-in is temporarily disabled by default in all ops environments.
Set `OPS_REQUIRE_GOOGLE_AUTH=true` to restore the gate. When restored,
ops still skips Google sign-in locally when `OPS_LOCAL_AUTH_BYPASS=true` in
`apps/ops/.env.local`. This applies only to `next dev` on localhost or loopback
addresses; production builds and Vercel always require staff sign-in. Set it to
`false` to test Google sign-in locally. Browser localStorage does not control access.

The overview now lives at `/` in ops. The public `/twap/overview`, manual-alert
page, and alert API routes are removed. Other existing explorer routes remain.
Order links stay in ops at `/orders/<hash>`; developer investigation does not
require opening the separate public explorer app.

## Operations views

Staff navigation starts with three choices: **Overview**, **Orders**, and
**Analytics**. Main sections use links; pages within the
selected section use shadcn tabs with keyboard navigation. Inner analysis views
also use URL-backed tabs and mount only the active panel. Navigation keeps the
current period, network, and app scope. All orders uses filters for
active orders, failed outcomes, and execution error history. Analytics includes trends, token pairs,
and comparisons. The Monitoring section and Overview service checks have been removed.

| Page | Purpose |
| --- | --- |
| `/` — Overview | Placement comparisons, outcome totals, and a sortable trading-app table. Apps without activity are hidden by default. |
| `/orders` — All orders | Search, status and execution filters, trade progress, deadlines, continuous scrolling, and exports in one order table. |
| `/partners/<partnerId>` — Partner | Overview and Orders tabs scoped to one trading app. Old partner Markets links return to Overview with their reporting scope. |
| `/charts` — Activity | Placement timelines and UTC weekday/hour placement patterns. |
| `/markets` — Tokens & pairs | Directional pair rankings, token involvement with input/output counts, and route concentration. |
| `/performance` — Order outcomes | App, network, and order-type comparisons plus order-size distributions. |

`/health` bookmarks open the active-order filters in Orders. `/failures` bookmarks
open the Failed status filter in All orders; old app/network comparisons open Analytics.
Retired Monitoring
URLs (`/security`, `/adapters`, `/data-quality`, and `/run-telegram-alerts`) return
to Overview, retaining the reporting period, networks, and trading apps.

Data views share the overview's period, multi-network, and trading-app filters.
Ops uses the shared `packages/ui/src/filter-drawer.tsx` component for filtering:
the **Filters** button opens a side drawer, and applied selections appear in
removable badges at the top of the page. Changes stay in a draft until
**Apply filters**; **Cancel**, Escape, or closing the drawer discards them.
The period selector stays separate with an accessible label and no visible caption
or default network-scope text beside the Filters button.
Partner pages use the page heading for app identity, with activity details beside the app name,
and share one desktop row for tabs and filter controls. Matching totals and
filtered export share another row, wrapping on smaller screens.
**Clear filters** preserves
the selected date: inside the drawer it clears the draft; in the toolbar it
clears applied filters immediately. Counts represent applied filter categories,
so selecting several networks or trading apps counts once per category.
CSV and JSON downloads share one **Export** menu.

All orders places filtered Export beside Refresh in the page header, leaving the
full toolbar row for filters. A live matching/value strip sits above
one Virtuoso table with continuous page scrolling. Predefined **Presets**, search, order status, and execution history are configured in
the shared Filters drawer on both global and partner order pages. Changes stay
in a draft until Apply filters; selected conditions appear as removable badges.
Invalid USD edits stay local until corrected. The period remains in the toolbar,
and value/error/date column headers sort the table.
Selections are encoded in the URL and survive reload. Order history and the
embedded order lists render only visible rows, without pagination or page-size controls. Small screens retain horizontal scrolling.
USD bounds are validated before applying. Filtered exports remain
with the matching results, avoiding an unfiltered header export on order pages.
Presets sit at the top of the drawer and update its draft only; Apply filters commits
the selected combination, while Cancel discards it. Below Presets are Status,
Networks, Trading apps, Order type, and Search orders. Search
fields appear inside opened network/app dropdowns. Execution error history and
other advanced constraints are grouped under **Advanced filters**, which starts
collapsed unless an advanced constraint is active. Partner market cohorts use direct dropdowns;
their selections remain URL-backed. The comparison toolbar groups row spacing
and empty-app visibility under **Display**. Exact update times remain available
on hover; each page shows one compact update status.

Those filters are preserved in navigation URLs. Counts and chart selections open
matching order cohorts; full order inspection is available at
`/orders/<hash>?source=v1` or `?source=v2`. A direct lookup can also search both
services and is independent of the overview filters. The header
**Find order** shortcut (`⌘K` / `Ctrl+K`) and a complete hash pasted into Orders
search open an internal detail page. Hash-search URLs and legacy lookup links
remain independent of overview history.
Service versions appear only on the order detail page, with v1 identified as
legacy. General filters and analytics combine both services; old service-filtered
links retain a removable **Service filter** badge. Monitoring distinguishes
**Order service** and **Legacy service** without version labels.
The service override is available in **Advanced** on order details. A lookup loads the full order
record on demand, including witness fields, execution chunks, solver/executor
reports, transactions, and the returned service payload. Client logs are loaded
only when requested in the detail view. CSV/JSON exports contain list records
for the selected scope; the Orders view also exports its narrower matching set.

All orders uses a wider, fitting desktop table and page scrolling with virtualized
rows. Smaller screens scroll the same columns horizontally. **Show raw fields** uses wrapping cards on
all screen sizes, with the same rows, filters, and shared history. Existing `/orders?orders_view=technical` links enable it. It shows full order hashes,
service provenance, numeric chain IDs, adapters, input/output token addresses,
raw/display statuses, and chunk reports with copy controls. Exact adapter and
token-address filters join the common drawer; a token matches either side of
the order. **Swapper address (exact)** is available in Advanced filters on global
and partner order pages. It uses the services' paginated address lookup because
history list rows omit the swapper. Matches retain date, network, app, and order
filters, share through `order_swapper`, and remain in scope for exports and detail
navigation. Lookup failure never appears as a successful empty result.
No detail record is requested per row. Open a hash for the internal
detail page with **Summary**, **Execution history**, **Technical details**,
**Client logs**, and **Service payload**. Technical details include original
raw units and witness fields, while known-token amounts remain formatted in
the summary. Single-order links in the review queues open this full page.
The Summary uses the full page width, with trades and scheduling above the
amounts. It shows planned/completed/unfilled trades, recorded chunk errors,
trade interval, slippage, deadlines, input per trade, maximum input, minimum
output per trade, reported successful input/output, and remaining input.
Missing amounts stay unreported; totals use only successful, matching-token
chunks with complete reported amounts. Execution history includes each reported
trade's minimum output and solver output; raw payloads remain in JSON modals.
Detail links and service changes preserve list filters; service changes also
retain the selected detail tab. The shared **Back** control follows app navigation
history and restores the previous page’s filters and scroll position. Directly
opened detail pages use a scoped fallback when there is no prior app page. **Copy link** shares the
current order, service, tab and return context. Address/transaction block-explorer links remain
available as explicitly external references.

Order rows open their internal detail link, with native new-tab/modifier support.
**Quick view** (or Space on the row link) opens a compact summary with an
**Open order details** link. Full execution history, technical details, client
logs and payload are shown on the dedicated page; opening a quick view does not
fetch the full order. Active waiting
states and latest-attempt errors are distinguished from missing execution reports.
Unresolved tokens show their addresses with copy controls. Quick views include
**Erroring now**, **Active 24h+**, and **Placed value ≥ $1K**. Age indicates time
since placement, not an inferred missed schedule. Status chip counts honor the
remaining facets; the age badge can be removed to broaden the list.

Partner pages keep the route's partner fixed across all views, even when an
incoming URL contains another app filter. Period and multi-network filters carry
between partner views and into order details. Opening a partner from the overview
table also preserves the global network selection. Registered partners without
activity can still be opened; unknown adapter partners use their existing
`adapter-<address>` identifier. Use the partner selector to switch apps or
**All trading apps** to return to the overview. Partner pages use five visible
tabs: **Overview**, **Orders**, **Execution**, **Activity**, and **Markets**.
Related views appear as shadcn tabs inside the selected section. Tabs support keyboard
navigation; every view retains its existing URL and period/network scope.
Partner period and network filters use the same drawer and badges. The app
badge records the route's fixed partner; switching trading apps is a separate
header control. Exports stay in the header or, on order-history views, beside
the filtered results.
The partner overview keeps compact order totals, placed value and USD coverage,
attention links, and network triage. Outcomes, timelines, pairs, and full history
live in their dedicated tabs. Its network table is reused in the Networks view.
Global Overview leads with placement metrics, current outcomes and the trading-app
comparison, followed by Needs attention. Detailed service coverage and operational
pulse mount when their disclosure is opened. Live service checks load
independently of order history. Long execution, failure, chart, market, security, and
data-check views show one focused analysis at a time. Sort, row-count, lookup
service, and app-switch fields use the existing shadcn Select primitives.
The old `view=charts` and `view=markets` URLs open Activity and Token routes.

The overview table derives each app's total, mutually exclusive outcome counts,
failure rate, and placed value from the same globally filtered order records.
Numeric columns sort in either direction. The default Needs attention order
prioritizes active deadlines, active latest-attempt errors, then failed count;
failure-rate and placed-value sorts remain available. Operations columns show the
failure denominator and small-sample context; Business columns compare placed
orders, share, prior-period growth and known placed USD. All outcomes retains the
full outcome breakdown. Column presets persist in this browser, and a comfortable
table density is available. App totals
combine selected networks without a network column; **Group by → By network**
shows one row per app/network with its logo and exact scoped order links.
Compact rows include an outcome mix with keyboard-accessible count tooltips.
No arbitrary app health state is assigned.
Counts open the matching order cohort and partner names open Partner Details.
Swap pairs live in the partner's Markets tab. The comparison table has no
card-specific network scope or eager token-metadata requests.
Trading-app search and **Show apps with no orders in this period** sit beside the table; network
badges show observed order counts rather than supported-network counts.
**Saved filter views** retain period, network/app selection, zero-order visibility,
open-order placement narrowing and the selected monitoring tab in this browser.
Trading-app grouping is URL-backed and included in saved views. Comparisons use
the table; older chart-view bookmarks also open the table. Table text search/sort
remain local to the current view.
Seven- and thirty-day placement metrics compare equal rolling periods ending at
the snapshot. Comparison exports include searched/sorted aggregate rows, dates,
UTC time basis, scope, price coverage and definitions. Executed volume and trading
wallets remain unavailable until a complete fill-level data contract exists.

Overview separates **API & service health** from an **Operational pulse**. Its compact
Activity and Failure rate charts group the current outcomes of orders by their
placement time (UTC), over 24 hours or seven days. They do not reconstruct when
execution or failure events happened. The pulse window is URL-backed and
independent of review rules; both explicitly operate within the selected
placement cohort. Empty intervals have no failure rate. Current open-order queues,
active review rules and worker exposure use all available placement dates by
default; optional narrowing shows the number of excluded active orders. Age and
recovered historical errors remain context rather than default review signals.
Review rules default to at least 20% terminal failures among 10+ recent placed
orders; the rate, sample size, and placement window can be changed locally.
Traffic expectations are opt-in per app and compare the last reported placement
across loaded history within the network selection. These are review signals,
not confirmed infrastructure faults. The attention queue separates current
active errors, deadline overruns, rule-based failure cohorts, and unknown
telemetry. Drilldowns open exact Orders filters, including fixed UTC placement
bounds for rate cohorts. Metric definitions are available from the header help
button. Monitoring separates reachability, coverage, workers, and potentially
exposed orders, and remains usable when order history cannot load.
Global and partner failure views share heuristic reason categories while keeping
the exact reported text and current outcomes available for inspection.

App names combine current Spot configuration with the public `/status` catalogs
from both order services, including historical `-old-N` deployments. Matching
uses the network and full adapter address; current configuration takes precedence.
Older adapter-based partner links redirect to the named app when the mapping is
unambiguous. Unmapped or conflicting addresses retain their adapter identifier.

Read the analytics with these limits in mind:

- USD amounts describe **placed order value**, not executed volume. Size
  statistics use reported finite, nonnegative values, including zero, and show
  reporting coverage. Missing or invalid values are excluded from averages and
  percentiles. Token involvement is overlapping order exposure across token
  sides; it must not be added up as trading volume.
- Outcomes describe the latest reported state of orders placed during the
  selected period. Completed shares use all selected orders as the denominator,
  including active and other outcomes. They are not service availability or
  historical completion-time measurements. Execution error history is distinct
  from terminal failure; a completed order may have earlier errors.
- Time charts use UTC placement timestamps. Daily, weekly, or monthly timeline
  buckets depend on the selected history. Invalid or future timestamps are
  excluded from time charts with coverage reported. Period filters can exclude
  undated records; use all history for a complete field audit.
- The list is deduplicated by network and order hash, preferring v2. Data quality
  checks audit those loaded records; duplicate checks run after deduplication.
  The unified Adapters page combines current and historical catalogs with
  observed addresses, using one row per network and address. App and network
  filters narrow the list; period filters change its order counts. Configured
  addresses remain visible with zero matching orders. Old adapter tabs redirect
  here with their filters preserved; Security and Data checks link to it.
- List summaries and returned chunks are not a complete retry-attempt log.
  Client-log coverage, sampling, limits, and retention depend on the existing log
  service. These views do not add private telemetry, RPC monitoring, ingestion
  delay measurements, or a service uptime feed.

## Data loading

Order history loads on demand for the selected period, networks, partner adapters,
source, swapper, and custom placement bounds. Each normalized scope has its own
60-second freshness window and 30-minute cache retention; equivalent scopes and
inner tabs reuse their snapshot. Changing scope cancels requests no longer in use.
Both services return newest-first pages but ignore date-range parameters, so
bounded requests use 100-record pages and stop each source independently after
crossing the requested start time. One boundary page may include older records;
those records are excluded from the snapshot. Invalid or unsorted timestamps
disable early stopping rather than silently hiding matching records. A page
failure rejects the scoped totals instead of presenting a partial result.

Overview additionally loads the preceding equal period for its comparisons.
Order lists, charts, and partner pages load only their requested period. Active
order checks follow that period by default; selecting **All placement dates**
loads all-date exposure explicitly. Selecting **All time** retrieves complete
history, using bounded parallel paging. Direct order details request the order
itself and reuse any matching list record already cached. Exports contain every
matching record in the selected scope, with that scope's snapshot timestamp.

Configuration stays cached for an hour. History polls every minute in the
foreground, backs off to five minutes after a failure, and retains the last
successful snapshot with a visible freshness state. Refresh retrieves the current
scope and configuration; it does not load previously visited scopes.

Overview's live service checks query both `/status` endpoints independently of
history and reuse the catalog's status cache. They report API reachability,
version, request latency, listener signals, and taker heartbeat age. Disabled
listeners and unreported/stale/cached signals are distinguished from failures.
Details state the review thresholds. These checks do not measure chain-head
block lag, end-to-end execution health, or historical uptime.

Token metadata loads separately in deduplicated, bounded batches for the active
scope. Summary, execution, security, and data-check pages skip enrichment when
they do not display token labels. Counts remain usable while labels resolve, and
search and market rankings update when enrichment finishes. Order details load
on demand; an already-fetched record is reused by its diagnostic tabs. Client
logs and raw payload rendering only start when their tab is opened.

## Security review

Open **Monitoring → Security checks**. The page reviews the selected order snapshot;
it does not establish that the system is free from attacks. Current
configuration matches, service-catalog-only matches, and unknown or
wrong-network adapters are kept separate. Native zero token addresses are
accepted; zero adapters and malformed or invalid mixed-case checksum addresses
are flagged. An optional expected-address comparison lets a user supply an
independent reference; a catalog match alone does not establish trust.

Activity checks group orders by adapter and network in fixed UTC buckets over
the last 24 hours. Burst signals require at least 20 orders in 5 minutes and
at least 5 times the preceding hour's average per 5 minutes, with an observed
data span covering that baseline. Failure signals require at least 5 currently
terminal failed orders and an 80% failure rate in 15 minutes. These are review
heuristics; normal traffic and execution problems can trigger them. Bucket
boundaries can hide bursts. The page exposes matching orders and full adapter
addresses for investigation.

Coverage includes missing networks/times, configuration availability, cached
refresh errors, snapshots older than 5 minutes, and the dashboard's sign-in
state. Missing data does not produce an all-clear result. Recipient, spender,
reactor, executor, and swapper addresses require full order inspection and an
independent trusted reference. No wallet ownership, signatures, deployed code,
fund transfers, or network traffic are verified. Checks update when the view
loads or is refreshed; no background monitoring or notifications are added.

## Staff access

Ops temporarily allows access without Google sign-in, including deployed pages
and internal APIs. The navigation displays **Sign-in disabled**. Set
`OPS_REQUIRE_GOOGLE_AUTH=true` in the ops environment to restore staff access
checks; restart or redeploy after changing it.

When enabled, ops uses Google Workspace sign-in with server-side verification of Google's
signature, issuer, audience, expiry, verified email, and hosted domain. The
allowed domain defaults to `orbs.com` (`OPS_GOOGLE_DOMAIN` can override it).
An eight-hour signed session is stored in an HTTP-only, SameSite cookie, marked
Secure in production. Protected pages check the session on the server, and
internal API handlers check it independently. The dashboard does not allow
access when auth configuration is missing and the gate is enabled.

Configure these variables in **ops**, separately for Preview and Production:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth web client. Add the actual ops
  deployment domain and `http://localhost:3004` to its authorized JavaScript
  origins. Also add `http://localhost` for local Google sign-in. Stable preview
  domains simplify Google OAuth origin configuration. This flow uses a JavaScript
  callback, so it does not need an OAuth redirect URI.
- `OPS_SESSION_SECRET`: independent random secret of at least 32 bytes; generate
  with `openssl rand -hex 32`. Changing it invalidates existing sessions.
- `NEXT_PUBLIC_RPC_URL`: optional RPC proxy, also configurable independently in
  explorer. Without it, token metadata uses public chain RPC endpoints.

No new private error feed is added by this migration. Existing order-sink APIs
remain as they were; future private error/log queries must be server-side in ops
behind staff authorization.

Telegram alerts are temporarily disabled. The navigation entry and daily cron
schedule are removed, the old manual page redirects to security checks, and
both send endpoints return `410 Gone` before accessing credentials or services.
The sender implementation is retained for later restoration. Any Telegram,
Redis, and cron credentials belong only to ops.

## Independent Vercel deployments

Use **two Vercel projects connected to this same Git repository**:

1. Keep the existing explorer project (`prj_iCIuRd8iUPHYmu2bePAcTj6fRNUD`).
2. Use the separate ops project (`prj_WsmkqUUi6kJu5MdRPN69ALiofXpM`) with Root
   Directory `apps/ops`.
3. Set each project's Root Directory from the table above and enable **Include
   source files outside of the Root Directory in the Build Step**. Both apps
   reference shared workspace packages. Use Node.js 22 and the app's checked-in
   `vercel.json` build/install settings.
4. Configure each project's environment variables independently. Move operational
   credentials from the explorer project to ops. Authorize the ops origin in
   Google before signing in.
5. The deployment script already selects the configured Ops project. Set
   `OPS_VERCEL_PROJECT_ID` in your shell/CI only to override it with another Ops project.

The deployment script applies the selected app's `vercel-project.json` settings
before uploading the repository root, ensuring both the app and its workspace
packages reach Vercel. Explorer explicitly selects its existing project, ignoring
stale local `.vercel` links. Ops defaults to its separate configured project.

```bash
npx vercel@58.9.0 login
pnpm deploy:explorer              # Explorer preview
pnpm deploy:explorer --prod       # Explorer production

npx vercel@58.9.0 login
pnpm deploy:ops                   # Ops preview
pnpm deploy:ops --prod            # Ops production
pnpm deploy:ops --dry-run         # Inspect commands without executing them
```

`VERCEL_TOKEN` can be supplied through the environment for CI; optionally set
`VERCEL_SCOPE` to the team slug. Credentials are never passed as CLI arguments.
The script runs lint, both apps' type checks, and tests before updating settings
or deploying. It logs out the saved Vercel CLI session on exit, including failed
checks, preserving the existing deployment behavior. Help and dry runs do not
log out. Vercel may treat a project's first deployment as production.

Live Vercel project configuration, Git connections, env migration, and deployments
require an authenticated Vercel account; local configuration alone does not
perform them. Deploying ops before explorer transfers the alert schedule without
leaving the new app unconfigured; disable the old explorer cron when cutting over
to avoid duplicate scheduling. Redis deduplication remains unchanged.

See [Vercel monorepos](https://vercel.com/docs/monorepos) and
[Google server-side token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build               # Both independent builds
pnpm build:explorer
pnpm build:ops
```
