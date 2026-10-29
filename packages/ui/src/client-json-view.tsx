"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import type { ThemeKeys, ThemeObject } from "react-json-view";
import { Skeleton } from "./skeleton";

function JsonSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading JSON preview"
      aria-busy="true"
      data-slot="loading-state"
    >
      <span className="sr-only">Loading JSON preview…</span>
      <div aria-hidden="true" className="min-h-40 space-y-3 py-2">
        {[
          "w-20",
          "ml-4 w-48",
          "ml-4 w-40",
          "ml-8 w-56",
          "ml-4 w-32",
          "w-20",
        ].map((width, index) => (
          <Skeleton key={index} className={`h-3 max-w-[75%] ${width}`} />
        ))}
      </div>
    </div>
  );
}

// The viewer accesses document at module load, so defer it until the client renders it.
const ReactJson = dynamic(
  () => import("react-json-view").then((mod) => mod.default),
  { ssr: false, loading: JsonSkeleton },
);

export type ClientReactJsonProps = {
  src: object;
  theme?: ThemeKeys | ThemeObject;
  collapsed?: number | boolean;
  displayDataTypes?: boolean;
  enableClipboard?: boolean;
  style?: CSSProperties;
};

export function ClientReactJson({
  src,
  theme = "monokai",
  collapsed = 2,
  displayDataTypes = false,
  enableClipboard = true,
  style,
}: ClientReactJsonProps) {
  return (
    <ReactJson
      src={src}
      theme={theme}
      collapsed={collapsed}
      displayDataTypes={displayDataTypes}
      enableClipboard={enableClipboard}
      style={style}
    />
  );
}
