import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@orbs/ui/providers/query-provider";
import { RouterProvider } from "@orbs/ui/providers/router-provider";
import { ThemeProvider } from "@orbs/ui/providers/theme-provider";
import { Toaster } from "@/components/toaster";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Page } from "@/components/page";
import { PageSkeleton } from "@/components/loading-skeletons";
import "./globals.css";

const sans = Montserrat({
  variable: "--font-orbs-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const mono = JetBrains_Mono({
  variable: "--font-orbs-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
export const metadata: Metadata = {
  title: "Orbs Spot",
  description: "Orbs Spot dashboard",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} antialiased min-h-dvh overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <RouterProvider
              fallback={
                <Page>
                  <PageSkeleton />
                </Page>
              }
            >
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground"
              >
                Skip to content
              </a>
              {children}
              <ScrollToTop />
              <Toaster />
            </RouterProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
