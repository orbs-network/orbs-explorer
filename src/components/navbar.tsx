"use client";

import { ORBS_LOGO } from "@orbs-network/spot-ui";
import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import { Menu, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { SearchInput } from "./search-input";
import { useTheme } from "next-themes";

const NAV_LINKS = [
  { href: ROUTES.HOME, label: "Home" },
  { href: ROUTES.TWAP.ROOT, label: "TWAP" },
  { href: ROUTES.LIQUIDITY_HUB.ROOT, label: "Liquidity Hub" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isHomePage = pathname === ROUTES.HOME;
  const { theme, setTheme } = useTheme();

  const isActiveLink = (href: string) => {
    if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-row justify-between items-center bg-background border-b border-border px-4 py-3 gap-4">
      <Link href={ROUTES.HOME} className="flex flex-row items-center gap-2 shrink-0">
        <img src={ORBS_LOGO} alt="logo" className="h-8 w-8" />
        <p className="text-foreground text-xl font-bold hidden sm:block">Orbs Explorer</p>
      </Link>

      {!isHomePage ? (
        <>
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {NAV_LINKS.map((link) => {
              const isActive = isActiveLink(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <ThemeToggle />
          </nav>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="p-2">
                  <SearchInput
                    placeholder="Search..."
                    className="h-9"
                  />
                </div>
                <DropdownMenuSeparator />
                {NAV_LINKS.map((link) => {
                  const isActive = isActiveLink(link.href);
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          isActive && "bg-primary/10 text-primary"
                        )}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <ThemeToggle />
      )}
    </div>
  );
}

