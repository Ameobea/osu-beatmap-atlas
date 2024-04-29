/** @type { import("eslint").Linter.Config } */
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:svelte/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/indent': 0,
    quotes: [1, 'single', { avoidEscape: true }],
    'linebreak-style': [2, 'unix'],
    semi: 0,
    'comma-dangle': [1, 'only-multiline'],
    'no-console': 0,
    'no-global-assign': 0,
    'no-multiple-empty-lines': [2, { max: 1 }],
    'no-unused-vars': 0,
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': [
      'error',
      {
        destructuring: 'any',
        ignoreReadBeforeAssign: false,
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/camelcase': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/consistent-type-imports': ['warn', { disallowTypeAnnotations: false }],
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
    extraFileExtensions: ['.svelte'],
  },
  env: {
    browser: true,
    es2017: true,
    node: true,
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  ],
};
