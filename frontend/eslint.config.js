// @ts-check
// ESLint 10 + angular-eslint 22 (set up with `ng add angular-eslint`).
// Run: `npm run lint` (check) or `npm run lint:fix`.
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'pgt', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'pgt', style: 'kebab-case' },
      ],
      // Modern Angular style (inject(), standalone components, OnPush).
      // Switching would mean rewriting every component: a separate project,
      // not a lint fix. Off for now.
      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      // same as in the backend
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // `x != null` also catches undefined; `!==` would change behaviour
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      // Angular Material controls count as form fields for <label>
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        { controlComponents: ['mat-slide-toggle', 'mat-select', 'mat-checkbox'] },
      ],
    },
  },
]);
