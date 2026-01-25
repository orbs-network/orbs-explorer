import { AuthWrapper } from "@/app/providers/auth-provider";
import React from "react";
import { NavigationMenu } from "./navigation-menu";

export function Page({
  children,
  auth = false,
  filter,
}: {
  children: React.ReactNode;
  auth?: boolean;
  filter?: React.ReactNode;
}) {
  const content = (
    <div className="flex flex-row w-full mx-auto pl-4 pr-4">
      <NavigationMenu />
      <div className="flex-1 flex flex-col gap-4 relative">
        <div className="sticky top-0 flex flex-row gap-4 justify-between w-full z-10 pt-3 pb-3 border-b border-border bg-background pl-[15px]">
          {filter}
        </div>
        <div className="flex-1 overflow-y-auto pl-[20px]">{children}</div>
      </div>
    </div>
  );

  if (auth) {
    return <AuthWrapper>{content}</AuthWrapper>;
  }

  return content;
}
