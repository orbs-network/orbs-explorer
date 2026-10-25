# Ops App Review — Product & UX

_Reviewed 2026-10-21 against `apps/ops` (uncommitted monorepo state on `main`), running locally on live order-sink data._

**Follow-up:** the assessment below records the original review. The implementation notes at the end distinguish completed changes, deliberate product choices, and work that still needs backend support. Google sign-in and Telegram alerts remain disabled at the user's explicit request.

**Goal of the app:** monitor spot (TWAP / limit) orders and know at a glance that the system is healthy.

**Verdict:** today it is a capable *order-data explorer* — not yet an *ops console*. Nothing answers "is anything broken right now?" within five seconds, and nothing tells anyone when it breaks. The data and building blocks are mostly there; the product needs a different centre of gravity.

---

## 1. Critical (fix first)

| # | Finding | Where | Why it matters |
|---|---------|-------|----------------|
| 1.1 | **Auth is off in every environment.** `getAuthBypassUser` returns a bypass user unless `OPS_REQUIRE_GOOGLE_AUTH=true`; `.env.example` ships `false`. | `src/lib/auth-bypass.ts` | Wallets, partners, failure data visible to anyone with the URL. |
| 1.2 | **Alerting is off.** `TELEGRAM_ALERTS_ENABLED = false` is hard-coded and `vercel.json` has no cron. | `src/lib/telegram-alerts.ts`, `vercel.json` | A monitor nobody is paged by only works if someone remembers to look. |
| 1.3 | **The old alert design would be noisy if re-enabled.** One Telegram message per errored chunk; full order history paged on every run; Redis "seen" set grows forever; links point to the public explorer, not the ops order page. | `src/app/(staff)/api/cron/telegram-error-alerts/route.ts` | Alert fatigue → alerts get muted → real incidents missed. |
| 1.4 | **Every page blocks on the full order history.** All orders from both sinks are downloaded into the browser (pages of 400) and filtered client-side; the 7-day default does not shrink the download. Cold loads measured at **~6.5–17s**, including the order-hash lookup tab, which needs one record. | `src/lib/spot-overview-queries.ts`, `packages/domain/src/twap/api.ts` | Slow now, linear growth later; nothing can be "real-time" this way. |

**Recommended alerting model:** rule-based and aggregated — e.g. *"TakerError [sendTx] reverted ×18 in 1h · Agent · BSC (15 failed)"* — with severity, dedupe window, a recovery message, and a link to the ops page filtered to the affected orders.

---

## 2. Product: add real system health

The "Health" page (`/health`) is actually a list of active orders. Meanwhile the order-sink already exposes real health signals the app only uses to read partner names:

- **`order-sink-v2/status → blockFetchStatus`** — per chain (26 today): `listenerActive`, `eventsFetchingEnabled`, `lastBlock`, `updatedAt`. Compare `lastBlock` against chain head (RPC) for **block lag**; distinguish *disabled* chains (hemi, blast, anvil) from *down* ones.
- **`/status → takerFetchStats`** — per taker server: `lastFetchAt`, `secondsSinceLastFetch`, `averageIntervalMs`. A ready-made **heartbeat**.
- **`/status → version`** for v1 and v2, plus API reachability and latency for each sink.

Combine with order-flow SLIs (last 1h / 24h vs a trailing baseline):

- **Intake:** new orders per hour (drop to zero = intake broken).
- **Outcome:** fill success rate, chunk error rate (currently 18% of 7-day orders carry error signals — buried on the Failures page).
- **Stuck:** active past deadline; **next chunk overdue vs schedule**.
- **Latency:** placement → first chunk, chunk lag vs expected interval. The code itself says *"These figures do not measure execution latency"* — for TWAP this is the most important SLI.
- **Attribution:** orders from adapters not in config (a new integration whose orders aren't attributed).

Present each component as green / amber / red, with an **Open issues** list that links to the affected orders.

### Server-side snapshots
Move aggregation to a cron (every 1 min) that writes metrics to Redis/Postgres. That fixes load time, enables polling, and gives **history of health metrics** — today you cannot answer "was it broken at 3am?", because order data only shows each order's latest state.

### Backend asks
- `since=` / time-range filtering on `/orders`.
- Per-attempt error timestamps (the Failures page notes the list response lacks them, so first/last-seen can't be shown).

---

## 3. UX findings

### 3.1 Information architecture
- **The landing page answers the wrong question.** Overview is a grid of partner cards (~450px tall each, ~2 per screen). An operator needs "what's wrong" first; per-partner business totals are secondary.
- **Navigation is organised by data shape, not by job.** 9 pages in 4 groups; Analytics (Activity, Tokens & pairs, Compare results) is business reporting, Monitoring (Security, Data checks) is periodic audits.
- **Labels don't match page titles.** Nav says *Active orders* → page says *Execution health*; *Errors & failures* → *Failures*; *Activity* → *Charts*; *Tokens & pairs* → *Markets*; *Compare results* → *Performance*. Users lose their place.
- **Three levels of tabs** on the order page (nav sub-tabs → Summary/Execution/Client logs → Order fields/Execution history/Service payload). Flatten.

**Proposed structure:** `Status` (home) · `Orders` (triage queue · browse · detail) · `Partners` · `Insights` (folded analytics) · `Audits` (security + data checks).

### 3.2 Visual hierarchy — make problems loud
- **Good and bad numbers look the same.** On Overview, SushiSwap's *32% failed* has the same weight as Agent's *4% failed*. Health metrics (Active past deadline = 0, Deadline within 1h = 0) get the same full card as non-zero ones.
  - Use semantic status colour only on deviations; collapse or dim zeros; sort partners by *problems*, not volume, in the ops view.
- **Every partner card shows the same 6-cell grid** regardless of relevance. Prefer a compact table row per partner: orders · success % · failed · active · stuck · sparkline, with a red/amber marker.
- **Verbose explanatory copy everywhere** ("Counts describe returned execution records. Error attempts and terminal order failure are separate states."). Accurate, but it pushes data below the fold. Move to `ⓘ` tooltips; keep one line of context max.

### 3.3 Orders table
- **Rows are ~85px tall** (≈6 per screen) because status, source, network, chain ID and type each get their own line. Target ~40px with secondary info in tooltips or the detail drawer.
- **The most important column is cut off.** "Latest reported message" (the error) is the last column and hidden behind horizontal scroll at 800px. Move error/reason next to status.
- Redundant data: "Arbitrum One" + "Chain 42161"; "Active" + "pending" + "Source v2".
- The search / sort / rows-per-page controls take a full card above the table. Inline them in the table toolbar.
- Some token pairs show unresolved addresses (`0x5fc5…d168 → 0x0000…0000`, Kodiak); show a placeholder symbol + copy-able address instead of truncated hex as the primary label.

### 3.4 Order detail
- **The error is not on the Summary tab.** The page leads with 8 equal-weight count tiles (Reported chunks, Executors reported, Price-check loop counter…) while the actual failure reason (*TakerError [sendTx] … reverted*) is elsewhere.
  - Lead with: status badge, pair + amounts (human units), partner, wallet, **latest error**, next expected chunk, deadline countdown.
- **"Order lookup service" (v1/v2) dropdown** is internal plumbing shown prominently. Auto-detect; tuck the override into an "Advanced" menu.
- **Execution details are raw:** bare addresses with no labels, links or copy buttons; tokens as addresses; amounts in raw units (`85077000000000000000`). Label known contracts (adapter → partner, reactor, executor), link to block explorer, format units.
- Add a **chunk timeline** (planned vs actual time, tx hash, status, error) — the core artefact for debugging a TWAP.

### 3.5 Loading, freshness, and trust
- **Full-page spinner** "Loading complete order history from both services…" for up to 17s on every cold visit, including single-order lookup. Show the page shell plus skeletons; let hash lookup bypass the history load entirely.
- **No auto-refresh.** Data is "fresh" for 60s but only refetches on navigation or manual refresh. Poll on ops screens and show a live "updated 20s ago" indicator that turns amber when stale.
- **Mixed time zones:** most pages show local time (Asia/Jerusalem), charts use UTC. Pick one default (UTC is standard for ops) with a toggle, and show relative times ("3m ago") for recent events.

### 3.6 Global affordances
- **No global search.** Add ⌘K / header search for hash, wallet, tx hash, partner.
- **No triage state.** Operators can't acknowledge, assign, or note an order/incident — so two people investigate the same thing. Upstash is already provisioned for this.
- **Deep links**: alert messages and shared links should land on the filtered ops view, not the public explorer.

### 3.7 Mobile (375px, checked in dark mode)
- ~270px of header/nav/filter chrome before content.
- Metric cards stack one per row — four cards (two of them `0`) fill the first screen.
- Review-queue table: the **Review signals** column (why the order needs attention) is off-screen behind horizontal scroll. Use a card list on mobile with signals as badges at the top.
- Tab rows wrap onto two lines.
- Dark mode itself renders cleanly.

### 3.8 What's working well (keep)
- The **Review queue** on Active orders (past deadline / ≤1h / error history / ≥24h) — the right idea; make it the core triage surface.
- Failure **reason grouping** with failed/active/completed split.
- **URL-synced filters**, filter chips, CSV/JSON export, shareable order links.
- Honest **data-quality** caveats (coverage counts like `12/12 reported`).
- Accessibility basics: `role="status"`/`alert`, focus restoration on modals, `aria-label`s, reduced-motion handling.

---

## 4. Suggested roadmap

| Phase | Scope | Rough size |
|-------|-------|-----------|
| **0** | Re-enable Google auth in prod; restore cron with aggregated, rule-based Telegram alerts linking to ops pages. | days |
| **1** | **Status** home page: sink `/status` (listeners, block lag, taker heartbeat, versions) + order-flow SLIs; red/amber/green + open issues. Auto-refresh + freshness indicator. | ~1 week |
| **2** | Server-side metric snapshots (cron → Redis/Postgres); health history charts; hash lookup without full history load. | ~1 week |
| **3** | Triage workflow: review queue with ack/assign/notes, "next chunk overdue" flag, chunk timeline on order detail, ⌘K search. | 1–2 weeks |
| **4** | IA + density pass: rename/merge pages, compact partner table, orders table rework, order detail summary rework, mobile card layouts. | ~1 week |

---

## Follow-up implementation — 2026-10-21

### Applied

- **Live service checks on Overview:** both `/status` endpoints load independently of order history. The compact panel shows reachability, request latency, version, review signals, and unreported coverage. Listener and taker details sit behind one disclosure with tabs. Disabled listeners are distinguished from inactive or overdue ones. Catalog loading and health checks share status requests through the query cache.
- **Explicit health limits:** “API reachable” describes the endpoint, not end-to-end execution. Listener age uses a documented 3-minute review threshold; heartbeat age uses the greater of 60 seconds or three reported average intervals. Missing, stale, malformed, or cached reports remain distinguishable. The app does not calculate chain-head block lag or claim that all systems are healthy.
- **Immediate hash lookup:** the Orders lookup view mounts without history, configuration, or token queries. It remains reachable while the history view loads or fails. The header also offers a keyboard-accessible **Find order** dialog (`⌘K` / `Ctrl+K`). Both reuse the same validated lookup form and automatically search both services; the service override lives in **Advanced**.
- **Freshness:** the shared history snapshot refreshes every minute in the foreground, with a five-minute interval after failure and no overlapping requests. Existing cache identities still let routes, tabs, and filters reuse history. Ops views show a compact relative freshness indicator and retain the last successful snapshot on refresh failure. The removed Overview helper/timestamp lines remain removed.
- **Navigation:** page headings now match **All orders**, **Active orders**, **Errors & failures**, **Activity**, **Tokens & pairs**, and **Results**. Existing routes and URL filters are preserved. Inner tab rows scroll horizontally on small screens instead of wrapping into several rows.
- **Triage density:** active-order warning cards appear when their counts are nonzero; zero signals use a quiet inline check. The review queue is continuous and virtualized. Its compact desktop rows and mobile layout keep review badges and the latest reported error visible without scrolling to a distant column.
- **Order history:** the controls use a compact toolbar and a continuous list. Status and latest reported reason appear together near the start of each row; mobile uses cards with the reason visible. Repeated raw status, source, and chain-ID lines no longer inflate every row.
- **Order details:** Summary leads with status, pair, amounts, app, wallet, latest execution error, and available schedule information. One tab row exposes execution history, addresses/terms, client logs, and payload. The timeline shows scheduled and last-reported times with transaction links when available; a report timestamp is not presented as an execution timestamp. Known decimals format token amounts; missing decimals remain explicitly raw. Addresses have contextual labels, copy controls, and validated block-explorer links. Unknown token names use a readable fallback with the address available for inspection.

### Deliberate choices and remaining work

- **Authentication and Telegram:** findings 1.1–1.3 remain recorded, but restoring these features would reverse explicit user choices. No cron, outgoing messages, or new alert delivery was enabled in this pass. Any future alert implementation should use aggregated rules, bounded deduplication, recovery messages, and filtered ops links rather than restoring per-chunk messages.
- **Aggregate history loading:** the hash path is fixed, but complete aggregate analyses still download the shared history snapshot. A backend time-range/cursor contract and server-side aggregation are needed to remove that dependency without presenting partial totals as complete. No unsupported `since` parameter was added.
- **Stored health history:** no database schema, durable metric snapshots, cron, or 3am history chart was introduced. The new panel reports current/cached service responses; it does not imply historical health coverage.
- **Execution timing:** a detail response can show reported chunk timing. Reliable fleet-wide next-chunk-overdue, latency SLIs, and first/last error occurrence still require schedule and per-attempt timestamps that the list endpoint does not supply consistently. Long order age alone is not labeled execution failure.
- **Global search and triage workflow:** the new global shortcut finds order hashes. Wallet/transaction search is not advertised because the list response lacks a reliable complete search index. Shared acknowledgement, ownership, and notes need a durable storage and operator-identity design.
- **Time zones:** order timestamps retain the user's local zone; chart bucket dates remain explicitly marked UTC. A global time-zone selector is still a separate enhancement.
- **Information architecture:** the current links/tabs retain the user's recent layout choices. The proposed full Status/Partners/Insights/Audits navigation replacement remains separate. A subsequent user request replaced the overview cards with the comparison table described below.

### Trading-app comparison follow-up

Overview now compares apps in a compact sortable table with every outcome,
network logos, placed value, and terminal failed counts/rates. All row metrics
come from the same scoped order array; unknown outcomes remain visible, missing
USD stays unreported, and failed execution attempts do not become additional
terminal failures. Reconciliation tests cover rows, global totals, source/status
conflicts, aliases, historical adapters, and filter intersections. No overlapping
count bug was reproduced in the current classifier. The removed card-local
network filters could previously produce a different cohort from the top
summary; the table uses one global scope. Pair rankings remain in partner
details, and the overview no longer requests token metadata for hidden pairs.
Unidentified adapter links retain their observed networks so an address registered
to another app on another network cannot redirect the row to that app.

### Verification

Ops production build, workspace lint, both app typechecks, and all 220 workspace tests passed. Browser checks covered 320/390/800/1440px layouts, lookup during pending/failed history, no-history direct lookup, continuous lists, detail tabs/copy controls, shared status requests, partial service failures, disabled/unreported/stale signals, hidden-tab polling pause, error backoff, and manual recovery. No relevant runtime errors remained. The local ops preview was restarted with the verified build.

The subsequent trading-app table change passed all 237 workspace tests, lint,
ops typecheck, and the production build. Browser checks covered numeric sorting,
failure rates, metric reconciliation across filter combinations, missing USD,
inactive apps, scoped internal links, dialog focus, loading/error/retry states,
and layouts from 320 to 1440px. Filtering and sorting issued no additional
history, token-metadata, or order-detail requests.

### Operational monitoring follow-up

- **Separate signals:** the Overview panel now says **API & service health** and
  exposes reachability, report freshness, and listener/taker coverage separately.
  It no longer combines missing coverage with a “No issues reported” verdict.
  **Order signals** is a separate panel using the shared order snapshot.
- **Recent activity:** Activity and Failure rate tabs use exact rolling 24-hour
  or seven-day placement cohorts, current mutually exclusive outcomes, UTC labels,
  and inspectable chart data. A gap has no denominator and is not shown as 0%.
  These charts cannot identify when errors or completions actually occurred.
- **Review rules:** configurable terminal failure rate, minimum sample, and recent
  placement window. Defaults are 20%, 10 orders, and 24 hours. Per-app traffic
  expectations are opt-in and use the last valid placement across loaded history
  within the selected networks/apps, including old unidentified adapters. Rules
  are saved in this browser; flags request investigation rather than declaring a
  system fault. Invalid or unavailable deadlines retain explicit coverage gaps.
- **Discovery:** the period is always visible; only nondefault periods add filter
  badges. Clearing returns to the visible seven-day default. Search and the
  inactive-app toggle are visible above the trading-app table, including empty
  views. Network badges show observed order counts. CSV/JSON share one Export menu.
- **Investigation:** shared failure reasons support cohort and text-based category
  filters while retaining exact messages. Categories are hints, not confirmed root
  causes. The Find order dialog also offers token/adapter-address search through
  the existing scoped order list. Wallet/transaction lookup is not advertised as a
  complete index; those fields remain inspectable in individual order responses.
- **Saved filter views:** browser-local named views retain the supported Overview
  URL filters, inactive display, and selected monitoring tab. They do not imply
  shared team preferences or stored operational telemetry.

This follow-up passed all 261 workspace tests, workspace lint, both app
typechecks, and the Ops production build. Browser verification covered service
coverage/staleness, hash/address search, failure categories, exact exported
cohorts, default-period clearing, local saved views, rule validation/persistence,
rate/sample boundaries, placement-chart keyboard inspection, and historical
unknown-app expectations under network/app filters. Final 320/390/1440px layouts
were inspected without overflow or relevant runtime warnings. Tabs, settings,
and local controls did not add history, token, or detail requests. The local
preview was restarted with the verified build.

## Spot Orders monitoring UX audit follow-up — 2026-10-22

Reviewed `orbs_operations_spot_orders_ux_audit.md` against the current source and
production build. Recommendations for routes the audit did not inspect were
validated before adding UI; existing Orders investigation, execution attempts,
reason categories, URL filters, and read-only behavior were retained.

- **OV-01/02, ORD-03/04:** Overview now starts with a Needs attention queue.
  Active latest-attempt failures, active past deadlines, elevated app failure
  cohorts, configured inactivity expectations, and unknown coverage have distinct
  descriptions and drilldowns. Counts are unique orders and can overlap. No
  unconfigured SLA or critical-incident classification is inferred. Empty state:
  “No actionable issues detected under current rules.” Loading never shows this
  message prematurely. Deadline and fixed UTC placement facets are URL-backed,
  visible/removable in the shared filter UI, validated, and retained on detail
  navigation. Absolute rate cohorts use all-history scope plus fixed bounds so
  shared investigations do not drift with a rolling global period.
- **OV-03/04/05/07/08:** Operational pulse has an independent, visible 24h/7d
  selector and low-activity context. Review-rule windows remain separate. Compact
  trading-app columns fit desktop widths; Detailed columns preserve all outcomes
  and persist locally. Needs attention sorting has explicit criteria, rates retain
  denominators, small samples are labeled, and network logos/counts are summarized
  with an accessible menu. Freshness shows exact response time, timezone and cadence.
- **MON-01/02/03/04:** Monitoring separates API reachability, complete/partial/
  unknown coverage, worker thresholds and order exposure. API/worker panels stay
  available when history is loading or unavailable; order-derived tabs show their
  own loading/error states. Source/network/status/error/deadline links open the
  corresponding Orders cohort. Missing or stale telemetry cannot establish health.
- **PAR-01/02/03/05:** Partner attention, outcome and network counts open scoped
  Orders. The compact network triage includes failure denominators, overdue
  activity, latest-attempt failures and last placement. Failure diagnostics link
  to explicitly scoped failed-pair analysis. Existing data/query caches are reused.
- **X-02/04/05/06:** Header help explains canonical metric definitions, current
  outcomes versus attempt errors, recovery, time cohorts and monitoring limits.
  Browser verification covers keyboard/focus, empty/loading/error states, exact
  cohort counts and mobile overflow. An empty-history fixture made two status
  requests and two history requests; adding the queue did not duplicate requests.

### Boundaries retained

- Sign-in and Telegram remain disabled under the user's explicit earlier choices.
  The audit's recommendation to restore an access gate was not applied.
- “Agent” is not assumed to mean internal/test traffic. No automatic traffic
  classification or hiding is introduced without a reliable category.
- No execution-latency aggregate, retry eligibility, automatic recovery claim,
  durable incident timeline, or last-successful-execution timestamp is fabricated.
  These need supported telemetry/history; the UI does not fan out detail requests
  for every order to manufacture aggregate metrics.
- Severity remains a review classification, not confirmation of infrastructure
  failure, attack, sustained incident, or SLA breach. No new paging/ownership
  workflow or transaction-affecting controls were introduced.

Validation: 297 tests, workspace lint, Ops typecheck and production build pass.
Browser checks cover Overview/Orders, Monitoring and Partner views at desktop
1280/1440px and mobile 320/390px, exact source/partner/network/deadline/error
cohorts, fixed-window failure counts, rule/pulse separation, persisted columns,
unknown/stale/partial coverage, history-failure isolation, empty states, and help
focus. Remaining final presentation fixes are verified in the rebuilt preview.
