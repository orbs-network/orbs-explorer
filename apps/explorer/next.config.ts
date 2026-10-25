import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const config: NextConfig = {
  transpilePackages: ["@orbs/domain", "@orbs/ui"],
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default config;
