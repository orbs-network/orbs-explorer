import { useHeight } from "@/lib/hooks/use-height";
import { HomeIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import React from "react";

const LINKS = [
  {
    label: "Home",
    href: "/",
    icon: <HomeIcon />,
  },
  {
    label: "Orders",
    href: "/orders",
    icon: <HomeIcon />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <SettingsIcon />,
  },
];

export function NavigationMenu() {
  return (
    <div
      className={`flex flex-col gap-2 bg-card border border-border p-2  overflow-y-auto w-[300px] h-[100vh] sticky top-[0px]`}
    >
      {LINKS.map((link) => (
        <Link
          href={link.href}
          key={link.label}
          className="flex flex-row gap-2 items-center"
        >
          {link.icon}
          <span className="text-sm">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}
