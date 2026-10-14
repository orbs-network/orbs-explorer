import type { Metadata, Viewport } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "./providers/query-provider";
import { AuthProvider } from "./providers/auth-provider";
import { RouterProvider } from "./providers/router-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { Toaster } from "sonner";
import { PageGuide } from "@/components/page-guide";
import { Navbar } from "@/components/navbar";

// Use the same Montserrat family as the Orbs website throughout the app.
const orbsSans = Montserrat({
  variable: "--font-orbs-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const orbsMono = JetBrains_Mono({
  variable: "--font-orbs-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orbs Explorer",
  description:
    "Track advanced orders powered by Orbs, including scheduled trades, limit, stop-loss, and take-profit orders. Check progress, trade history, and activity across trading apps.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${orbsSans.variable} ${orbsMono.variable} antialiased min-h-[100dvh] overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <RouterProvider>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                >
                  Skip to content
                </a>
                <Navbar />
                <PageGuide />
                {children}
                <Toaster
                  position="top-right"
                  offset={16}
                  gap={12}
                  toastOptions={{
                    classNames: {
                      toast:
                        "!rounded-xl !border !border-border !bg-card !shadow-lg !py-3 !px-4 !text-card-foreground group",
                      title: "!text-sm !font-semibold !text-foreground",
                      description: "!text-sm !text-muted-foreground",
                      closeButton:
                        "!top-2.5 !right-2.5 !border-0 !bg-transparent !text-muted-foreground hover:!text-foreground hover:!bg-muted !rounded-md",
                      success: "!border-primary/30 dark:!border-primary/20",
                      error: "!border-destructive/40",
                    },
                  }}
                  richColors
                  closeButton
                />
              </RouterProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
