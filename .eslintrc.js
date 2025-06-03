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
      'error',
      {
        max: 1500, // Increased from 300 to 500 for React Native components
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    complexity: ['warn', { max: 15 }], // Increased from 10 to 15 for mobile UI logic

    // ---- prettier formatting overrides ----
    'prettier/prettier': [
      'error',
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
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-require-imports': [
      'error',
      {
        allow: ['\\.jpg$', '\\.png$', '\\.jpeg$', '\\.gif$', '\\.svg$'], // Allow require() for image assets
      },
    ],

    // ---- React Native specific adjustments ----
    radix: ['error', 'as-needed'],
    'prefer-const': 'warn',
    'no-console': 'off', // Allow console logs for debugging in development
    'max-params': ['warn', 6], // Allow more parameters for React Native component props
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
  ],
};
