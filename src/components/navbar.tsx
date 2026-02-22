"use client";

import { ORBS_LOGO } from "@/lib/consts";
import { ROUTES } from "@/lib/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import { ChevronDown, Menu, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { SearchInput } from "./search-input";
import { useTheme } from "next-themes";

const TWAP_CHILDREN = [
  { href: ROUTES.TWAP.ROOT, label: "Orders" },
  { href: ROUTES.ORDERS_DASHBOARD, label: "Overview" },
  { href: "https://www.orbs.com/dtwap/", label: "About", external: true },
] as const;

const LIQUIDITY_HUB_CHILDREN = [
  { href: ROUTES.LIQUIDITY_HUB.ROOT, label: "Swaps" },
  { href: ROUTES.LIQUIDITY_HUB_DASHBOARD, label: "Overview" },
  { href: "https://www.orbs.com/liquidity-hub/", label: "About", external: true },
] as const;

const NAV_LINKS = [
  { href: ROUTES.HOME, label: "Home" },
  { href: ROUTES.TWAP.ROOT, label: "TWAP", children: TWAP_CHILDREN },
  { href: ROUTES.LIQUIDITY_HUB.ROOT, label: "Liquidity Hub", children: LIQUIDITY_HUB_CHILDREN },
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

  const isActiveLink = (href: string) => {
    if (href === ROUTES.HOME) return pathname === ROUTES.HOME;
    return pathname.startsWith(href);
  };

  return (
    <header className="flex flex-row justify-between items-center bg-background border-b border-border px-3 py-2.5 sm:px-4 sm:py-3 gap-2 sm:gap-4 shrink-0">
      <Link href={ROUTES.HOME} className="flex flex-row items-center gap-2 shrink-0 min-h-[44px] min-w-[44px] justify-center sm:justify-start">
        <img src={ORBS_LOGO} alt="logo" className="h-8 w-8" />
        <p className="text-foreground text-xl font-bold hidden sm:block">Orbs Explorer</p>
      </Link>

      {!isHomePage ? (
        <>
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {NAV_LINKS.map((link) => {
              const isActive =
                isActiveLink(link.href) ||
                ("children" in link &&
                  link.children?.some(
                    (c) => !("external" in c) && isActiveLink(c.href)
                  ));
              if ("children" in link && link.children) {
                return (
                  <div
                    key={link.href}
                    className="group relative"
                  >
                    <Link
                      href={link.href}
                      className={cn(
                        "flex items-center gap-0.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {link.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Link>
                    <div className="absolute left-0 top-full pt-1 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-opacity duration-150 z-50">
                      <div className="bg-popover text-popover-foreground rounded-md border shadow-md py-1 min-w-[8rem]">
                        {link.children.map((child) => {
                          const isChildActive = !("external" in child) && isActiveLink(child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              {...("external" in child ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                              className={cn(
                                "block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-none first:rounded-t-md last:rounded-b-md",
                                isChildActive && "bg-primary/10 text-primary"
                              )}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }
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

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
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
                  const isActive =
                    isActiveLink(link.href) ||
                    ("children" in link &&
                      link.children?.some(
                        (c) => !("external" in c) && isActiveLink(c.href)
                      ));
                  if ("children" in link && link.children) {
                    return (
                      <DropdownMenuSub key={link.href}>
                        <DropdownMenuSubTrigger asChild>
                          <Link
                            href={link.href}
                            className={cn(isActive && "bg-primary/10 text-primary")}
                          >
                            {link.label}
                          </Link>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {link.children.map((child) => {
                            const isChildActive = !("external" in child) && isActiveLink(child.href);
                            return (
                              <DropdownMenuItem key={child.href} asChild>
                                <Link
                                  href={child.href}
                                  {...("external" in child ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                  className={cn(
                                    isChildActive && "bg-primary/10 text-primary"
                                  )}
                                >
                                  {child.label}
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  }
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
    </header>
  );
}

