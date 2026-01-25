import { SearchInput } from "@/components/search-input";
import { ROUTES } from "@/lib/routes";
import { ArrowRight, Layers, RefreshCw, Search } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-73px)]">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Gradient orb background effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[128px] opacity-50" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 max-w-2xl w-full">
          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Powered by Orbs Network
          </div>

          {/* Main heading */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Explore Orbs
              <span className="text-primary"> Transactions</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto">
              Search and analyze Liquidity Hub swaps and TWAP orders across the Orbs ecosystem
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full max-w-xl">
            <SearchInput
              className="shadow-lg shadow-primary/5 border border-border"
              placeholder="Enter transaction hash"
            />
            <p className="text-center text-sm text-muted-foreground mt-3">
              Paste a tx hash to get started
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t border-border bg-background-secondary/50 px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Liquidity Hub Card */}
            <div className="group relative p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Liquidity Hub
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Explore decentralized liquidity aggregation with optimized
                    swap execution and MEV protection.
                  </p>
                  <div className="flex items-center gap-1 text-sm text-primary group-hover:gap-2 transition-all duration-300">
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* TWAP Card */}
            <Link
              href={ROUTES.TWAP.ROOT}
              className="group relative p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    TWAP Orders
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Time-Weighted Average Price orders for executing large
                    trades with minimal market impact.
                  </p>
                  <div className="flex items-center gap-1 text-sm text-primary group-hover:gap-2 transition-all duration-300">
                    <span>Explore TWAP</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-border px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Search className="w-4 h-4" />
          <span>
            Search by transaction hash to view detailed swap analytics
          </span>
        </div>
      </div>
    </div>
  );
}
