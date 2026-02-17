"use client";

import dynamic from "next/dynamic";

/**
 * react-json-view uses `document` at load time, so it must be loaded only on the client.
 * This wrapper uses next/dynamic with ssr: false to avoid "document is not defined" during SSR.
 */
const ReactJson = dynamic(
  () => import("react-json-view").then((mod) => mod.default),
  { ssr: false }
);

export type ClientReactJsonProps = {
  src: object;
  theme?: string;
  collapsed?: number | boolean;
  displayDataTypes?: boolean;
  enableClipboard?: boolean;
  style?: React.CSSProperties;
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
