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
    <div
      data-theme="explorer"
      className="relative min-h-[100dvh] bg-background text-foreground"
    >
      {/* Signature Orbs orb-glow. Fixed, behind everything, non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: "url(/orbs/orbs-glow.png)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right -200px top -200px",
          backgroundSize: "900px 900px",
        }}
      />
      <ExplorerNavbar />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
