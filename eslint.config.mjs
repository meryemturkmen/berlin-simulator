import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // React Three Fiber mutates three.js objects and refs inside useFrame by design.
    files: ["game/**/*.tsx", "components/three/**/*.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    "data/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
