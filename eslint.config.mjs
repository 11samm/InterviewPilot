import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // This app does not enable React Compiler. Keep traditional hooks checks active.
  { rules: {
    "react-hooks/refs": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/immutability": "off",
    "react-hooks/purity": "off",
  } },
  globalIgnores([".next/**", "backend/**", "next-env.d.ts", "types/mediapipe.d.ts"]),
])
