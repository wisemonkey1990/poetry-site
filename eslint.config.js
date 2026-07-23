import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "supabase/migrations/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.browser },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], "no-empty": "off" },
  },
  {
    files: ["scripts/**/*.js", "scripts/**/*.mjs", "vite.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];