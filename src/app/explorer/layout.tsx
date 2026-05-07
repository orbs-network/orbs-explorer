import type { Metadata } from "next";
import { ExplorerNavbar } from "@/components/explorer/navbar";

export const metadata: Metadata = {
  title: "Orbs Explorer",
  description: "Block explorer for the Orbs Perpetual Hub rollup chain",
};

export default function ExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="explorer" className="min-h-[100dvh] bg-background text-foreground">
      <ExplorerNavbar />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
