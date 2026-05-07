import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

function toConfigArray(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  return [v];
}

const eslintConfig = defineConfig([
  ...toConfigArray(nextVitals),
  ...toConfigArray(nextTs),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
