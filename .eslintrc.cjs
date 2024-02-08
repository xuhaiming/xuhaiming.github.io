module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "airbnb",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react"],
  rules: {
    "jsx-a11y/label-has-associated-control": "off",
    "import/no-anonymous-default-export": [
      "error",
      {
        allowArray: false,
        allowArrowFunction: false,
        allowAnonymousClass: false,
        allowAnonymousFunction: false,
        allowCallExpression: true, // The true value here is for backward compatibility
        allowNew: false,
        allowLiteral: false,
        allowObject: true,
      },
    ],
    "no-console": ["error", { allow: ["warn", "error"] }],
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "@typescript-eslint/consistent-type-imports": "off",
    "react/jsx-filename-extension": ["off"],
    "import/extensions": ["off"],
    "react/jsx-props-no-spreading": ["off"],
    "operator-linebreak": ["off"],
    "react/function-component-definition": ["off"],
    "react/require-default-props": ["off"],
    "no-shadow": ["off"],
    "react/react-in-jsx-scope": ["off"],
    "spaced-comment": ["warn"],
    "import/no-unresolved": ["off"], // turn this off as it does not support path aliases
    "import/no-cycle": ["off"],
    "react/jsx-no-useless-fragment": ["off"],
    "function-paren-newline": ["off"],
    "jsx-a11y/anchor-has-content": "off", // disabled for i18n Trans components
    "react-hooks/exhaustive-deps": "off", // disabled as we keep client side code in hooks and it doesn't make sense to include all dependencies
    "react/self-closing-comp": [
      "error",
      {
        component: true,
        html: true,
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { destructuredArrayIgnorePattern: "^_" }, // ignores destructured array variables whose names begin with an underscore
    ],
    "@next/next/no-img-element": ["off"],
    "import/prefer-default-export": "off",
    "no-param-reassign": [2, { props: false }],
    "consistent-return": "off",
    "import/order": ["off"],
  },
}
