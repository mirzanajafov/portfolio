import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const scenes = 'apps/web/src/scenes';

const notPassingYet = {
  curly: [
    `${scenes}/{campaign,failover,storm}.test.ts`,
    'apps/web/scripts/{campaign,failover,storm}-data.mjs',
    'apps/web/src/components/systems-tour.tsx',
    'apps/web/src/lib/cv-pdf.ts',
  ],
  'no-nested-ternary': [
    'apps/web/src/app/projects/\\[slug\\]/page.tsx',
    'apps/web/src/components/systems-tour.tsx',
  ],
  '@typescript-eslint/consistent-type-definitions': ['apps/api/src/ask/answer-engine.ts'],
  '@typescript-eslint/no-deprecated': ['apps/web/src/components/ask.tsx'],
  '@typescript-eslint/no-empty-function': ['apps/web/src/components/systems-tour.test.tsx'],
  '@typescript-eslint/no-floating-promises': ['apps/web/src/components/systems-tour.test.tsx'],
  '@typescript-eslint/no-non-null-assertion': [
    `${scenes}/{campaign,failover,floor,storm,systems-graph}.test.ts`,
    'apps/web/src/app/palette.node.test.ts',
    'apps/web/src/components/{scene-player,systems-tour}.test.tsx',
    'apps/api/evals/evals.spec.ts',
  ],
  '@typescript-eslint/no-unnecessary-condition': ['apps/web/src/components/scene-player.tsx'],
  '@typescript-eslint/no-unsafe-argument': ['apps/api/src/health/health.controller.spec.ts'],
  '@typescript-eslint/no-unsafe-return': ['apps/web/src/app/palette.node.test.ts'],
  '@typescript-eslint/non-nullable-type-assertion-style': [
    'apps/web/src/app/page.test.tsx',
    'apps/web/src/app/projects/\\[slug\\]/page.test.tsx',
    'apps/web/src/components/systems-tour.tsx',
  ],
  '@typescript-eslint/prefer-optional-chain': [`${scenes}/player.ts`],
  '@typescript-eslint/restrict-template-expressions': [
    'apps/web/src/components/systems-tour.tsx',
    'content/src/scaffold.test.ts',
  ],
};

export default defineConfig(
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    'apps/web/.next/',
    'apps/web/out/',
    'apps/web/next-env.d.ts',
    'apps/api/src/generated/',
    'content/src/.generated/',
  ]),
  {
    files: ['apps/web/**'],
    extends: [nextVitals],
    settings: { next: { rootDir: 'apps/web/' } },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      curly: 'error',
      'no-nested-ternary': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/consistent-type-definitions': 'off' },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.nodeBuiltin },
  },
  Object.entries(notPassingYet).map(([rule, files]) => ({ files, rules: { [rule]: 'off' } })),
);
