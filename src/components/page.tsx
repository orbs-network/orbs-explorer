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
    <div className="flex flex-row w-full mx-auto px-4">
      <div className="flex-1 flex flex-col gap-4 relative">
        <div className="flex-1 pl-[20px]">{children}</div>
      </div>
    </div>
  );

  if (auth) {
    return <AuthWrapper>{content}</AuthWrapper>;
  }

  return content;
}
