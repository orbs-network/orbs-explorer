import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const config: NextConfig = {
  transpilePackages: ["@orbs/domain", "@orbs/ui"],
  outputFileTracingRoot: root,
  turbopack: { root },
  async headers() {
    return [
      {
        source: "/login",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Referrer-Policy",
            value:
              process.env.NODE_ENV === "development"
                ? "no-referrer-when-downgrade"
                : "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default config;
