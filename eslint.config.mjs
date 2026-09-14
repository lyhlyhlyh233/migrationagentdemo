import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
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
    files: ["src/{app,features,domain,shared}/**/*.{ts,tsx}"],
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
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?:@/|(?:\\.\\.?/)+)services/(?:mock|http)(?:/|$)",
              message:
                "仅 services/index.ts 装配具体实现；界面使用契约、错误类型及回调。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(?:react(?:-dom)?(?:/|$)|(?:@/|(?:\\.\\.?/)+)(?:app|features|services|shared)(?:/|$))",
              message: "domain 保持纯模型和规则，不依赖界面、服务或展示标签。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(?:react(?:-dom)?(?:/|$)|(?:@/|(?:\\.\\.?/)+)(?:app|features|shared/ui)(?:/|$))",
              message: "服务不能反向依赖页面或 React；返回领域数据和事件。",
            },
          ],
        },
      ],
    },
  },
);
