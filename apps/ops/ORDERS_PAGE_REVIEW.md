# Orders Page Review — `/orders`

_Reviewed 2026-10-22 at `http://localhost:3004/orders?period=7` against live order-sink data (186 orders in 7 days), plus `components/investigation/*`._

**Summary:** much improved since the last pass (⌘K find, compact rows, status + reason together, "Updated Xs ago"). The remaining gap is **seeing at a glance which orders are in trouble**.

---

## 1. Highest impact

| # | Finding | Fix |
|---|---------|-----|
| 1.1 | **Errors don't stand out.** Error reasons use `text-destructive`, which renders `rgb(102,67,68)` vs `rgb(89,89,90)` for normal text — indistinguishable by eye. | Use a clearly red tone, or a warning icon/badge on error rows. |
| 1.2 | **"Waiting" and "broken" look identical.** An active order with *TakerError [sendTx] … reverted* and an active order waiting on *Price can't meet condition* are both blue "Active". | Split into **Active · waiting** (normal) and **Active · erroring** (last attempt failed). `hasLastExecutionError` already distinguishes them (`order-presentation.ts`). |
| 1.3 | **Status filter is buried.** The most-used filter is 3 clicks deep in a drawer and needs Apply. | Status chips with counts above the table: `All 186 · Active 12 (3 erroring) · Failed 18 · Partly 4 · Cancelled 10 · Completed …`, plus a "has errors" chip. |
| 1.4 | **Unclear click targets.** Pair link → detail page; status, reason and value → modal; the row itself does nothing (`orders-table.tsx`). | Whole row opens the detail page; one explicit "Quick view" (or Space) for the modal. |

---

## 2. Table layout

- **Uneven row heights (61px / 76px):** "Arbitrum One", "TWAP Take Profit Order" and dates wrap. Network column is narrow while Status & reason is wide. Target a single line per row:
  `pair · app | status · reason | network icon + short name | type (Limit / TWAP TP / TWAP SL) | $value | 0/1 ⚠1 | 2h ago`
- **Relative times** ("2h ago") with the absolute time on hover; no AM/PM wrapping.
- **Reason truncates at ~40 characters.** Give error rows more room and show the full text on hover.
- **Grammar:** "1 errors" → "1 error".
- **Unresolved data reads as a bug:** "Unknown token → Unknown token", "Network 4663". Show a short address with a copy button; "Unlisted chain 4663".
- **Test/bot traffic drowns real orders:** e.g. ~20 identical ~$95 Agent orders across chains on Oct 18 at ~3:46 PM. Add a "hide test orders" toggle or group bursts from the same wallet.
- **Sortable column headers** instead of the separate Sort dropdown.
- **Sticky table header and toolbar** — column labels are lost on a 186-row scroll.

---

## 3. Tabs and controls

- **Technical details** duplicates the same orders as a second table with raw fields → make it a column/density toggle ("Show raw fields") on the one table.
- **Matching summary** is 4 tiles behind a tab and a reload → show as a summary strip above the table that updates live with filters.
- **Find by order hash** duplicates ⌘K → remove the tab; pasting a full hash into search jumps straight to the order.
- **Period appears twice** (inline and in the drawer) → keep the inline one.
- **Filters drawer** (status, type, service, error history, adapter, token, USD range): apply on change, no Apply button; show active filters as removable chips under the toolbar.
- **Saved views:** "Erroring now", "Stuck > 24h", "Large orders > $1K".

---

## 4. Loading

- **Cold load ≈ 9s.** Order API calls finish by ~4.3s, but pages are fetched **sequentially** (v2 pages 2→5) — fetch them in parallel. Most of the remaining ~5s is after the data arrives (token metadata or client-side processing); measured in dev mode, so confirm with a production build.
- Long-term: move filtering/aggregation to the server so a 7-day view doesn't download all history.
- Loading is now scoped to the tab content (good). Use skeleton rows instead of a spinner to avoid layout jump.

---

## 5. Small things

- Drop the page description ("Search order activity and open any order…") — the title is enough.
- Export button should say what it exports ("186 matching orders, CSV").
- Keep the `aria-live` match-count status — it's good.

---

## 6. Suggested order of work

1. Status chips with counts + Active waiting/erroring split + visible error colour (1.1–1.3).
2. Whole-row click to detail + single-line row layout + relative times (1.4, §2).
3. Merge Technical/Summary/Hash tabs into the single table (§3).
4. Parallel page fetching, skeleton rows, then server-side filtering (§4).

---

## Implementation follow-up — 2026-10-22

The findings above record the original review. The follow-up implements the UI
and supported data-loading changes without assuming repeated orders are tests.

- **Scan and filter:** current errors use a visible red icon/text treatment.
  Active rows distinguish reported waiting states from latest-attempt errors;
  missing evidence remains Active. Status chips include counts and active-error
  context; execution errors remain a separate, removable facet. Counts describe
  the matching cohort under the other current filters.
- **One list:** the Technical and Summary tabs are consolidated into a raw-fields
  toggle and live matching/value strip. Full-hash search opens local order detail
  directly. Existing technical, summary, and lookup URLs remain compatible;
  the old tabs are no longer part of normal navigation.
- **Rows:** native detail links cover each row. Quick view and Space on the row
  link explicitly open the inspector. Relative times retain absolute timestamps,
  unresolved tokens retain copyable addresses, and long messages remain available
  in their full tooltip/inspector. Value, error, and placed headers sort the same
  results. Desktop/raw lists use a virtualized viewport with a sticky header;
  the controls remain sticky above it. Mobile keeps compact cards.
- **Controls:** Orders opts into immediate shared-drawer filtering. Invalid USD
  edits remain local with validation until corrected. Other views keep draft
  Apply/Cancel behavior. Period appears once, inline. Quick views cover Erroring
  now, Active 24h+, and Placed value ≥ $1K. Age alone is not called a stuck order.
  Exports identify the exact matching count and format.
- **Loading:** the two sources remain parallel; after their first page, up to
  three later pages per source load concurrently. Numeric page consumption,
  source precedence, deduplication, cancellation, and complete-snapshot failure
  behavior are preserved. Skeleton rows replace the list spinner. Token metadata
  already loaded separately; unfiltered Orders can now render before app labels,
  while selected-app scopes wait for identity resolution to avoid false zeroes.

### Limits retained deliberately

- The sampled list payload has no wallet or reliable test-order marker. Identical
  amount/time/adapter patterns are insufficient to hide real orders. No automatic
  test-traffic classifier or wallet grouping was introduced.
- Full aggregate history still loads because the backend has no supported time
  range/snapshot contract for these queries. No invented server-side filter was
  added. Parallel offset requests reduce sequential waits but do not make the
  service response an atomic snapshot.
- The original nine-second observation was in development. Production timing is
  checked separately; token metadata is not presented as a proven cause of that
  delay.

### Verification

- All 282 tests, workspace lint, both app typechecks, and the Ops production
  build pass. Browser checks cover immediate filter validation, counts and
  presets, exports, native row navigation, Quick view focus, sticky headers,
  raw-field scrolling, and 320/390-pixel layouts.
- One fresh-context production sample on 2026-10-22 showed 186 matching rows at
  1.52 seconds after navigation. Both history sources started together, and
  later v2 pages started in parallel groups of three. All eight history requests
  returned HTTP 200. Token metadata was still pending when rows appeared and
  finished at 1.74–2.25 seconds. This is a single observation, not a benchmark
  or a direct comparison with the earlier development measurement.
