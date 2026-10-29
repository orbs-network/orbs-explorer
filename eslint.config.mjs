import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  { settings: { next: { rootDir: ["apps/explorer/", "apps/ops/"] } } },
  {
    files: ["apps/ops/src/**/*.tsx", "packages/ui/src/filter-*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|input|select|textarea|option)$/]",
          message:
            "Use the shared shadcn controls instead of native form elements.",
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^(table|thead|tbody|tfoot|tr|th|td|caption)$/]",
          message:
            "Use the shared shadcn Table components for tables, headers, rows, and cells.",
        },
      ],
    },
  },
  globalIgnores([
    "**/.next/**",
    ".playwright-cli/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
  ]),
]);
