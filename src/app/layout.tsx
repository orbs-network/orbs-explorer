import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "./providers/query-provider";
import { AuthProvider } from "./providers/auth-provider";
import { RouterProvider } from "./providers/router-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { Toaster } from "sonner";
import { Navbar } from "@/components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbs Explorer",
  description: "Orbs Explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <RouterProvider>
                <Navbar />
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
                      success:
                        "!border-primary/30 dark:!border-primary/20",
                      error:
                        "!border-destructive/40",
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
