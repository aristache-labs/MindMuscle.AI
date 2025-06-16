/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // TS rules (incl. ban-types)
    'plugin:prettier/recommended', // runs Prettier as an ESLint rule, disables conflicts
    'prettier', // turn off rules that conflict with Prettier (replaces prettier/@typescript-eslint)
  ],
  ignorePatterns: [
    'backup/**/*', // Ignore all files in backup directory
  ],
  rules: {
    // ---- file + function complexity ----
    'max-lines': [
      'warn',
      {
        max: 1500, // Increased from 300 to 500 for React Native components
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    complexity: ['warn', { max: 15 }], // Increased from 10 to 15 for mobile UI logic

    // ---- prettier formatting overrides ----
    'prettier/prettier': [
      'warn',
      {
        singleQuote: true,
        semi: true,
        trailingComma: 'all',
        printWidth: 100,
      },
    ],

    // ---- TS-specific tweaks ----
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn', // Changed from error to warn for flexibility
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-require-imports': [
      'warn',
      {
        allow: ['\\.jpg$', '\\.png$', '\\.jpeg$', '\\.gif$', '\\.svg$'], // Allow require() for image assets
      },
    ],

    // ---- React Native specific adjustments ----
    radix: ['warn', 'as-needed'],
    'prefer-const': 'warn',
    'no-console': 'off', // Allow console logs for debugging in development
    'max-params': ['warn', 6], // Allow more parameters for React Native component props

    // ---- Additional rules to prevent aggressive auto-fixes ----
    'no-unused-vars': 'warn', // Warn instead of auto-removing
    'no-undef': 'warn', // Warn instead of breaking
    'import/no-unresolved': 'off', // Disable import resolution errors that can be aggressive
    'import/order': 'off', // Disable automatic import ordering
    'sort-imports': 'off', // Disable automatic import sorting
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    {
      files: ['metro.config.js', 'babel.config.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off', // Allow require() in config files
      },
    },
    {
      files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off', // Allow require() in Node.js scripts
        '@typescript-eslint/no-var-requires': 'off', // Allow var requires in Node.js scripts
      },
    },
  ],
};
