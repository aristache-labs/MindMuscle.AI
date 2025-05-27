module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
      'prettier'
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',     // TS rules (incl. ban-types)
      'plugin:prettier/recommended',               // runs Prettier as an ESLint rule, disables conflicts
      'prettier/@typescript-eslint'                // turn off TS rules that conflict with Prettier
    ],
    rules: {
      // ---- file + function complexity ----
      'max-lines': ['error', {
        max: 300,
        skipBlankLines: true,
        skipComments: true
      }],
      'complexity': ['warn', { max: 10 }],
  
      // ---- prettier formatting overrides ----
      'prettier/prettier': ['error', {
        singleQuote: true,
        semi:      true,
        trailingComma: 'all',
        printWidth: 100
      }],
  
      // ---- TS-specific tweaks ----
      // If you really don’t want ban-types, turn it off here:
      '@typescript-eslint/ban-types': 'off',
      // Always require radix for parseInt
      'radix': ['error', 'as-needed'],
      // Prefer const when a variable is never reassigned
      'prefer-const': 'warn',
      // No unused vars
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    overrides: [
      {
        files: ['*.ts', '*.tsx'],
        parserOptions: {
          project: './tsconfig.json'
        }
      }
    ]
  }
  