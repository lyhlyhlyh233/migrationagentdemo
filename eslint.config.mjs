import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

// Enforce the same boundary for static imports/re-exports and lazy imports.
function importBoundary(regex, message) {
  return {
    "no-restricted-imports": ["error", { patterns: [{ regex, message }] }],
    "no-restricted-syntax": [
      "error",
      {
        selector: `ImportExpression[source.value=/${regex.replaceAll("/", "\\/")}/]`,
        message,
      },
    ],
  };
}

export default tseslint.config(
  { ignores: ["dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/{app,features,domain,shared,stores}/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "网络请求放在 services；组件通过数据和回调使用服务能力。",
        },
      ],
    },
  },
  {
    files: ["src/{app,features,shared}/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: importBoundary(
      "^(?:@/|(?:\\.\\.?/)+)services/(?:mock|http)(?:/|\\.[cm]?[jt]sx?$|$)",
      "仅 services/index.ts 装配具体实现；界面使用契约、错误类型及回调。",
    ),
  },
  {
    files: ["src/stores/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: importBoundary(
      "^(?:react(?:-dom)?(?:/|$)|(?:@/|(?:\\.\\.?/)+)(?:app|features|components|shared/ui|services/(?:mock|http))(?:/|\\.[cm]?[jt]sx?$|$))",
      "stores 保持公共状态层；不依赖界面、应用装配或具体服务实现。",
    ),
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: importBoundary(
      "^(?:react(?:-dom)?(?:/|$)|zustand(?:/|$)|(?:@/|(?:\\.\\.?/)+)(?:app|features|components|services|shared|stores)(?:/|\\.[cm]?[jt]sx?$|$))",
      "domain 保持纯模型和规则，不依赖界面、公共状态、服务或展示标签。",
    ),
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: importBoundary(
      "^(?:react(?:-dom)?(?:/|$)|zustand(?:/|$)|(?:@/|(?:\\.\\.?/)+)(?:app|features|components|stores|shared/ui)(?:/|\\.[cm]?[jt]sx?$|$))",
      "服务不能反向依赖页面、公共状态或 React；返回领域数据和事件。",
    ),
  },
);
