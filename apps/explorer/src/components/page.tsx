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
    <main
      id="main-content"
      className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6"
    >
      {children}
    </main>
  );

  if (auth) {
    return <AuthWrapper>{content}</AuthWrapper>;
  }

  return content;
}
