module.exports = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  jsxSingleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  jsxBracketSameLine: false,
  arrowParens: "always",
  rangeStart: 0,
  rangeEnd: Infinity,
  requirePragma: false,
  insertPragma: false,
  importOrder: [
    // Packages `react` related packages come first.
    "^react",
    "^\\w",
    "^@?\\w",
    // Side effect imports.
    "^\\u0000",
    // Parent imports. Put `..` last.
    "^\\.\\.(?!/?$)",
    "^\\.\\./?$",
    // Other relative imports. Put same-folder imports and `.` last.
    "^\\./(?=.*/)(?!/?$)",
    "^\\.(?!/?$)",
    "^\\./?$",
    // Style imports.
    "^.+\\.?(css)$",
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
  proseWrap: "preserve",
  htmlWhitespaceSensitivity: "css",
  endOfLine: "lf",
  jsonRecursiveSort: true,
};
