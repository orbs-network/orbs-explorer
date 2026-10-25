"use client";

import { useState } from "react";
import { ORBS_LOGO } from "@orbs/domain/consts";
import { ROUTES } from "@/routes";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@orbs/domain/utils/utils";
import { Menu, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@orbs/ui/controls/dropdown-menu";
import { Button } from "@orbs/ui/controls/button";
import { useTheme } from "next-themes";

const NAV_LINKS = [
  { href: ROUTES.HOME, label: "Home" },
  { href: ROUTES.TWAP.ROOT, label: "Orders" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  // The separate block explorer remains available by direct URL.
  if (pathname.startsWith(ROUTES.EXPLORER.ROOT)) return null;
  const isActive = (href: string) =>
    href === ROUTES.TWAP.ROOT
      ? pathname.startsWith(ROUTES.TWAP.ROOT)
      : pathname === href;
  return (
    <header className="border-b border-border/60 bg-navigation">
      <div className="mx-auto flex min-h-[73px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href={ROUTES.HOME}
          aria-label="Orbs Explorer home"
          className="flex shrink-0 items-center gap-2"
        >
          <Image
            src={ORBS_LOGO}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8"
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] sm:text-sm">
            Orbs Explorer
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-1 rounded-full border border-border/50 bg-card/70 p-1"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-control-hover hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            aria-label="Toggle theme"
            className="relative h-11 w-11 rounded-2xl border border-border"
          >
            <Sun aria-hidden className="size-4 dark:hidden" />
            <Moon aria-hidden className="hidden size-4 dark:block" />
          </Button>
          <DropdownMenu open={mobileOpen} onOpenChange={setMobileOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-11 w-11"
                aria-label="Open navigation"
              >
                <Menu aria-hidden className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
