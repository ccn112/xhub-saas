// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // ---- XHub/X.Office boundary guard (Phase 1.5 Stage A/B) -------------------
  // Workflow/ApprovalTask/WorkflowInstance/Delegation are each owned by exactly
  // one module (xoffice/identity) — see
  // docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5. Any OTHER
  // module reaching `<x>.db.<table>` (the raw Prisma pattern the Stage A
  // cleanup removed from src/people/*) is the exact regression this guard
  // exists to catch before it lands again. Legitimate cross-module access must
  // go through the owning service's public method instead (e.g.
  // `xofficeService.spawnLightweightApprovalTask(...)`).
  //
  // OutboxEvent is deliberately NOT restricted here (Stage B): it's a
  // transactional-outbox table by design — any module/process may enqueue a
  // row via the shared `common/outbox.ts` helper; only `webhook/` polls and
  // dispatches. Restricting writers here would fight the pattern, not protect
  // it.
  //
  // NOTE: flat config does NOT merge array-valued rule options across config
  // objects — a later block's `no-restricted-syntax` entry replaces an earlier
  // one outright for any file both blocks match. So each owning directory gets
  // its own block below, applying every selector it does NOT own, rather than
  // one block per table with an `ignores` list (which silently overwrote its
  // siblings instead of stacking).
  (() => {
    const workflowSelector = {
      selector:
        "MemberExpression[object.property.name='db'][property.name=/^(workflow|workflowVersion|workflowInstance|approvalTask)$/i]",
      message:
        'Workflow/WorkflowVersion/WorkflowInstance/ApprovalTask are owned by XofficeService (src/xoffice/) — call its public method instead of reading/writing the table directly.',
    };
    const delegationSelector = {
      selector: "MemberExpression[object.property.name='db'][property.name='delegation']",
      message:
        'Delegation writes are owned by IdentityService (src/identity/) — call identityService.createDelegation(...)/deleteDelegation(...) instead of writing the table directly.',
    };
    return [
      {
        // everyone else: neither table is theirs to touch directly
        files: ['src/**/*.ts'],
        ignores: ['src/xoffice/**', 'src/identity/**', 'src/**/*.spec.ts'],
        rules: { 'no-restricted-syntax': ['warn', workflowSelector, delegationSelector] },
      },
      {
        // xoffice owns Workflow*/ApprovalTask (write+read) and still reads Delegation directly
        files: ['src/xoffice/**/*.ts'],
        ignores: ['src/xoffice/**/*.spec.ts'],
        rules: {},
      },
      {
        // identity owns Delegation; Workflow is still off-limits
        files: ['src/identity/**/*.ts'],
        ignores: ['src/identity/**/*.spec.ts'],
        rules: { 'no-restricted-syntax': ['warn', workflowSelector] },
      },
    ];
  })(),
);
