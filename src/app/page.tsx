import { SearchInput } from "@/components/search-input";
import { ROUTES } from "@/lib/routes";
import { ArrowRight, BarChart3, RefreshCw, Search } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main
      id="main-content"
      className="relative flex flex-col min-h-[calc(100dvh-73px)]"
    >
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-10 sm:px-4 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 0%, var(--ambient-lilac), transparent 55%), radial-gradient(ellipse at 85% 35%, var(--ambient-blue), transparent 50%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-7 max-w-2xl w-full">
          {/* Badge */}
          <div className="orbs-eyebrow rounded-full border border-primary/15 bg-secondary px-3 py-1.5 text-link">
            Powered by Orbs Network
          </div>

          {/* Main heading */}
          <div className="text-center space-y-4">
            <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.15] text-foreground tracking-[-0.025em] text-balance">
              Track your
              <span className="block">advanced orders</span>
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground max-w-lg mx-auto">
              Follow scheduled trades, limit, stop-loss, and take-profit orders
              from placement to completion.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full max-w-xl">
            <SearchInput />
            <p className="text-center text-xs sm:text-sm leading-relaxed text-muted-foreground mt-3 px-2">
              Search one order by ID, or all your orders by wallet address.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative border-t border-border bg-background px-3 py-8 sm:px-4 sm:py-12">
        <div className="max-w-4xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Advanced orders */}
            <Link
              href={ROUTES.TWAP.ROOT}
              className="group relative p-6 rounded-xl bg-card border border-border shadow-panel hover:border-primary/50 transition-colors duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <RefreshCw aria-hidden className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-foreground mb-2">
                    Advanced orders
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track scheduled trades, limit orders, stop-loss orders, and
                    take-profit orders.
                  </p>
                  <div className="flex items-center gap-1 text-sm text-link group-hover:translate-x-1 transition-transform duration-200">
                    <span>Find an order</span>
                    <ArrowRight aria-hidden className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href={ROUTES.ORDERS_DASHBOARD}
              className="group relative p-6 rounded-xl bg-card border border-border shadow-panel hover:border-primary/50 transition-colors duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <BarChart3 aria-hidden className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-foreground mb-2">
                    Order activity overview
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    See active and completed orders across trading apps and
                    networks. Filter the totals and open the orders behind them.
                  </p>
                  <div className="flex items-center gap-1 text-sm text-link group-hover:translate-x-1 transition-transform duration-200">
                    <span>View overview</span>
                    <ArrowRight aria-hidden className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="relative border-t border-border bg-background px-3 py-4 sm:px-4 sm:py-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground text-center">
          <Search aria-hidden className="w-4 h-4 shrink-0" />
          <span>
            Your trading app provides the order ID. A wallet address finds advanced
            orders placed by that wallet.
          </span>
        </div>
      </div>
    </main>
  );
}
