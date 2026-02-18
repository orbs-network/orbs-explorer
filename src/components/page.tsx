import { AuthWrapper } from "@/app/providers/auth-provider";
import React from "react";

export function Page({
  children,
  auth = false,
}: {
  children: React.ReactNode;
  auth?: boolean;
}) {
  const content = (
    <div className="flex flex-row w-full mx-auto px-3 sm:px-4 max-w-full">
      <div className="flex-1 flex flex-col gap-4 relative min-w-0">
        <div className="flex-1 pl-0 sm:pl-5">{children}</div>
      </div>
    </div>
  );

  if (auth) {
    return <AuthWrapper>{content}</AuthWrapper>;
  }

  return content;
}
