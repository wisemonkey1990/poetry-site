import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "supabase/migrations/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.browser },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-empty": "off",
      // 写 HTML 一律走 src/utils/html.js 的 setHtml + html``，插值默认转义
      "no-restricted-syntax": ["error",
        { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: "请用 setHtml(el, html`...`)（src/utils/html.js），插值会自动转义。" },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: "请用 setHtml(el, html`...`)（src/utils/html.js）。" },
      ],
    },
  },
  {
    files: ["src/utils/html.js", "src/**/*.test.js"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["scripts/**/*.js", "scripts/**/*.mjs", "worker/**/*.js", "tests/**/*.js", "vite.config.js", "playwright.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: globals.serviceworker },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];