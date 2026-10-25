import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  { settings: { next: { rootDir: ["apps/explorer/", "apps/ops/"] } } },
  globalIgnores([
    "**/.next/**",
    ".playwright-cli/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
  ]),
]);
