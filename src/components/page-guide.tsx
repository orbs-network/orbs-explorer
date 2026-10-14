"use client";
import { appendPerpetualHubScope } from "@/lib/perpetual-hub/query-scope";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const guides: Record<string, { title: string; text: string }> = {
  "/twap": {
    title: "Find your order",
    text: "Filter by your wallet address or order ID. Open an order to see what has traded, what is still waiting, and why.",
  },
  "/liquidity-hub": {
    title: "Find your token swap",
    text: "Filter by your wallet address, transaction ID, or swap attempt ID. Open a swap to check its result and the amount received.",
  },
  "/liquidity-hub-dashboard": {
    title: "Swap activity over the last 7 days",
    text: "These are totals across trading apps. Open a swap to see its result, amounts, and fees.",
  },
  "/perpetual-hub": {
    title: "What happened to your trade?",
    text: "Filter by your wallet or market, then open an action. Creating an order means it was placed; it may still be waiting to trade.",
  },
  "/perpetual-hub/actions": {
    title: "What happened to your trade?",
    text: "Filter by your wallet or market, then open an action to see its result and your account.",
  },
  "/perpetual-hub/events": {
    title: "Account activity",
    text: "Each record shows a request to change an account, such as placing an order or making a deposit. Open one to see whether it succeeded.",
  },
  "/perpetual-hub/positions": {
    title: "Open positions and waiting orders",
    text: "Current shows what is open now. Activity history shows earlier changes, including orders that may already have traded or been cancelled.",
  },
  "/perpetual-hub/users": {
    title: "Find your account",
    text: "Filter by your wallet address, then open your account to see its balance, open positions, and waiting orders.",
  },
  "/perpetual-hub/dashboard": {
    title: "Trading service overview",
    text: "These totals describe the whole service. Use Accounts to find your own wallet and understand your trades and balance.",
  },
  "/perpetual-hub/risk": {
    title: "Market risk across the service",
    text: "These totals show all traders’ market exposure. Your own positions and balance are on your account page.",
  },
  "/perpetual-hub/hedger": {
    title: "How the service balances its market risk",
    text: "These are the service’s external positions, not your own trades. Open your account to see your positions.",
  },
  "/perpetual-hub/rollups": {
    title: "Confirmation on the blockchain",
    text: "Several account changes are sent to the blockchain together as a batch. Open a batch to check its confirmation and included changes.",
  },
  "/explorer": {
    title: "Follow a change to blockchain confirmation",
    text: "A block is one recorded account change. A batch sends several changes to Arbitrum together. Search your wallet address or a change number to follow its progress.",
  },
  "/explorer/blocks": {
    title: "Recorded account changes",
    text: "Each block records a successful change. Open it to see what happened and whether its batch has been confirmed on the blockchain.",
  },
  "/explorer/batches": {
    title: "Groups of changes sent to the blockchain",
    text: "Open a batch to see the changes inside it and check its blockchain confirmation. Being added to a batch does not mean it is confirmed yet.",
  },
};
const tradingTerms = [
  [
    "Long / short",
    "A long position benefits when the market price rises. A short position benefits when it falls.",
  ],
  [
    "Position value",
    "The size of the market exposure. This is different from the cash or margin used to open the trade.",
  ],
  [
    "Position",
    "An open trade whose value can change as the market price moves.",
  ],
  ["Pending order", "An order that is still waiting to trade."],
  [
    "Profit / loss",
    "How much a trade has gained or lost. Unrealized means the position is still open; realized means the gain or loss was recorded when it closed.",
  ],
  [
    "Leverage and margin",
    "Leverage increases the market exposure of a position. Margin is the money backing that position.",
  ],
  [
    "Settlement batch",
    "A group of account changes sent to the blockchain together. Confirmation is a separate step.",
  ],
  [
    "Change number",
    "The number identifying an account update. Older numbers describe an earlier point in time.",
  ],
];
export function PageGuide({ explorer = false }: { explorer?: boolean }) {
  const path = usePathname();
  const params = useSearchParams();
  const guide =
    guides[path] ??
    (path.includes("/state/")
      ? {
          title: "Balances and positions at that time",
          text: "This shows the account data saved after an earlier change. Open an account for its current balance and positions.",
        }
      : undefined);
  const showTerms =
    path.startsWith("/perpetual-hub") || path.startsWith("/explorer");
  if ((!guide && !showTerms) || path.startsWith("/explorer") !== explorer)
    return null;
  const user = params.get("user");
  const validUser = user && /^0x[a-fA-F0-9]{40}$/.test(user);
  return (
    <aside
      aria-label="Page help"
      className={
        explorer ? "mb-4" : "mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-6"
      }
    >
      <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
        {guide && (
          <>
            <p className="font-medium">{guide.title}</p>
            <p className="mt-1 max-w-4xl leading-relaxed text-muted-foreground">
              {guide.text}
            </p>
          </>
        )}
        {validUser && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-primary">
            <Link className="hover:underline" href={`/twap?user=${user}`}>
              Wallet orders
            </Link>
          </div>
        )}
        {path.startsWith("/perpetual-hub") &&
          path !== "/perpetual-hub/users" &&
          !validUser && (
            <Link
              className="mt-2 inline-block text-primary hover:underline"
              href={appendPerpetualHubScope("/perpetual-hub/users", params)}
            >
              Find your account
            </Link>
          )}
        {showTerms && (
          <details className={guide ? "mt-2" : undefined}>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Trading terms explained
            </summary>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tradingTerms.map(([term, meaning]) => (
                <div key={term}>
                  <dt className="text-xs font-medium">{term}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {meaning}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </aside>
  );
}
