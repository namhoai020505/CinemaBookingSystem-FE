/**
 * e2e/fixtures/base.ts
 * ────────────────────
 * Custom Playwright fixtures that extend the base `test` with:
 *   - `authedPage`  : Page already logged in as customer
 *   - `adminPage`   : Page already logged in as admin
 *   - `db`          : Direct DB query helpers
 *
 * Usage in specs:
 *   import { test, expect } from '../fixtures/base';
 *   test('...', async ({ authedPage, db }) => { ... });
 */

import { test as base, expect } from '@playwright/test';
import { db } from '../helpers/db';
import { loginAsAdmin, loginAsCustomer } from '../helpers/auth';

type E2EFixtures = {
  db: typeof db;
  authedPage: ReturnType<typeof base.extend>['page'] extends Promise<infer P> ? P : never;
  adminPage: ReturnType<typeof base.extend>['page'] extends Promise<infer P> ? P : never;
};

export const test = base.extend<{ db: typeof db }>({
  // Make `db` available in every test without manual import
  // eslint-disable-next-line no-empty-pattern
  db: async ({}, use) => {
    await use(db);
  },
});

/** Separate helper exports for pages that need auth */
export { expect };

/**
 * Login helpers for use in test.beforeEach:
 *   await loginAsCustomer(page);
 *   await loginAsAdmin(page);
 */
export { loginAsAdmin, loginAsCustomer } from '../helpers/auth';
export { db } from '../helpers/db';
export * as seed from '../helpers/seed';
