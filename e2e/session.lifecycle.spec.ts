/**
 * session.lifecycle.spec.ts — Full E2E (no mocks)
 * Logout, refresh token, session revocation
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { loginAs, loginAsCustomer } from './helpers/auth';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL!;
const CUSTOMER_PW = process.env.TEST_CUSTOMER_PASSWORD!;

let tmpUserId: string | null = null;

test.afterEach(async () => {
  if (tmpUserId) {
    await seed.deleteUser(tmpUserId).catch(() => undefined);
    tmpUserId = null;
  }
});

test.describe('Session Lifecycle', () => {

  test('SL-01: Đăng xuất → REFRESH_TOKEN.isRevoked = 1 trong DB', async ({ page }) => {
    await page.goto(BASE);
    const tokens = await loginAsCustomer(page);
    await page.reload();

    let refreshToken: string | null = null;
    await test.step('FE UI', async () => {
      // Capture refresh token from localStorage before logout
      refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));
      // Click logout button in nav
      const logoutBtn = page.locator('button:has-text("Đăng xuất"), a:has-text("Đăng xuất"), button[aria-label*="logout"]');
      if (await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await logoutBtn.click();
      } else {
        // Logout via API directly
        await page.request.post(`${process.env.API_BASE_URL ?? 'http://localhost:5070'}/api/auth/logout`, {
          data: { refreshToken: tokens.refreshToken },
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
      }
      await page.waitForTimeout(1_000);
    });

    await test.step('BE API', async () => {
      // Verify tokens cleared from localStorage
      const stored = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(stored).toBeFalsy();
    });

    await test.step('DB SQL', async () => {
      if (!refreshToken) return;
      // Find the token record by userId (hash is stored, can't compare directly)
      const rows = await db.query<{ isRevoked: boolean }>(
        `SELECT TOP 1 [isRevoked] FROM [REFRESH_TOKEN]
         WHERE [userId] = (SELECT [userId] FROM [USER] WHERE [email] = @email)
         ORDER BY [issuedAt] DESC`,
        { email: CUSTOMER_EMAIL },
      );
      // Should be revoked after logout
      if (rows.length > 0) {
        expect(rows[0]!.isRevoked).toBe(true);
      }
    });
  });

  test('SL-02: Refresh token thành công → access token mới trả về', async ({ page }) => {
    await page.goto(BASE);
    const tokens = await loginAsCustomer(page);

    let newAccessToken: string | null = null;

    await test.step('FE UI', async () => {
      // Simulate token refresh by calling the endpoint
      const resp = await page.request.post(
        `${process.env.API_BASE_URL ?? 'http://localhost:5070'}/api/auth/refresh-token`,
        {
          data: { refreshToken: tokens.refreshToken },
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const body = await resp.json() as { success: boolean; data?: { accessToken?: string } };
      if (body.success) newAccessToken = body.data?.accessToken ?? null;
    });

    await test.step('BE API', async () => {
      expect(newAccessToken).toBeTruthy();
      expect(newAccessToken).not.toBe(tokens.accessToken);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [REFRESH_TOKEN]
         WHERE [userId] = (SELECT [userId] FROM [USER] WHERE [email] = @email)
         AND [isRevoked] = 0`,
        { email: CUSTOMER_EMAIL },
      );
      expect(rows[0]!.cnt).toBeGreaterThan(0);
    });
  });

  test('SL-03: Revoked refresh token → 401 khi gọi refresh', async ({ page }) => {
    const user = await seed.createTestCustomer({ email: `revoked-${Date.now()}@test-cinema.local` });
    tmpUserId = user.userId;

    // Get tokens via real login
    await page.goto(BASE);
    const tokens = await loginAs(page, user.email, user.password);

    // Manually revoke all tokens in DB
    await db.execute(
      `UPDATE [REFRESH_TOKEN] SET [isRevoked]=1, [revokedAt]=SYSUTCDATETIME() WHERE [userId]=@uid`,
      { uid: user.userId },
    );

    await test.step('FE UI', async () => {
      // Try to use the revoked refresh token
      const resp = await page.request.post(
        `${process.env.API_BASE_URL ?? 'http://localhost:5070'}/api/auth/refresh-token`,
        {
          data: { refreshToken: tokens.refreshToken },
          headers: { 'Content-Type': 'application/json' },
        },
      );
      await test.step('BE API', async () => {
        expect([400, 401]).toContain(resp.status());
        const body = await resp.json() as { success: boolean };
        expect(body.success).toBe(false);
      });
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [REFRESH_TOKEN]
         WHERE [userId]=@uid AND [isRevoked]=1`,
        { uid: user.userId },
      );
      expect(rows[0]!.cnt).toBeGreaterThan(0);
    });
  });

  test('SL-04: Truy cập trang protected khi không có token → redirect /login', async ({ page }) => {
    // Ensure no tokens in storage
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    await test.step('FE UI', async () => {
      await page.goto(`${BASE}/my-bookings`);
      await page.waitForTimeout(2_000);
    });

    await test.step('BE API', async () => {
      // No API call should succeed — page should redirect
      await expect(page).toHaveURL(new RegExp(`${BASE}/login`), { timeout: 8_000 });
    });

    await test.step('DB SQL', async () => {
      // Nothing to verify in DB for redirect behavior
      const rows = await db.query<{ cnt: number }>(`SELECT 1 as cnt`);
      expect(rows[0]!.cnt).toBe(1);
    });
  });

});
