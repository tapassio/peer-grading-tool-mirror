// ESLint 10 "flat config" (replaces .eslintrc.js). Same rules as before:
// typescript-eslint recommended + Prettier formatting.
import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // allowed on purpose:
      // - `const { password, ...rest } = user` removes secrets (rest siblings)
      // - unused parameters required by an interface or a callback signature
      //   can be prefixed with `_`
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
);
