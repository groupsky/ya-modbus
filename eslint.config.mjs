import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-config-prettier/flat'
import globals from 'globals'

export default tseslint.config(
  // Ignore patterns (replaces ignorePatterns from legacy config)
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended configurations
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Main configuration for all files
  {
    files: ['**/*.ts', '**/*.tsx'],

    plugins: {
      'import-x': importX,
      jest,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2024,
        ...globals.jest,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        project: ['./tsconfig.lint.json', './packages/*/tsconfig.lint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // TypeScript specific
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',

      // Import rules (import-x replaces import plugin)
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import-x/no-unresolved': 'off', // TypeScript handles this

      // General
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',

      // Jest recommended rules
      ...jest.configs.recommended.rules,
    },
  },

  // Test files override (replaces overrides from legacy config)
  {
    files: ['**/*.test.ts', '**/*.integration.test.ts', '**/*.e2e.test.ts', '**/test-utils.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Prettier config (must be last to override formatting rules)
  prettier
)
