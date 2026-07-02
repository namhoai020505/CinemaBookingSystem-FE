/**
 * auth.login.spec.ts — Full E2E (no mocks)
 * Happy path + negative cases for POST /api/auth/login
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL!;
const ADMIN_PW = process.env.TEST_ADMIN_PASSWORD!;
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL!;
const CUSTOMER_PW = process.env.TEST_CUSTOMER_PASSWORD!;

// ── Helpers ──────────────────────────────────────────────────────────────────
async function fillLoginForm(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? never : never, email: string, password: string) {
  await page.fill('input[type="email"], input[name="email"], #email', email);
  await page.fill('input[type="password"], input[name="password"], #password', password);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('Đăng nhập (Login)', () => {

  test('LG-01: Happy path — customer đăng nhập thành công → redirect home', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', CUSTOMER_EMAIL);
      await page.fill('input[type="password"], #password', CUSTOMER_PW);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect(resp.status()).toBe(200);
      const body = await resp.json();
      expect(body.success).toBe(true);
      expect(body.data?.accessToken).toBeTruthy();
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ status: string; emailVerified: boolean }>(
        `SELECT [status], [emailVerified] FROM [USER] WHERE [email] = @email`,
        { email: CUSTOMER_EMAIL },
      );
      expect(rows[0]?.status).toBe('ACTIVE');
      expect(rows[0]?.emailVerified).toBe(true);
    });

    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`), { timeout: 8_000 });
  });

  test('LG-02: Happy path — admin đăng nhập thành công', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', ADMIN_EMAIL);
      await page.fill('input[type="password"], #password', ADMIN_PW);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect(resp.status()).toBe(200);
      const body = await resp.json();
      expect(body.data?.role?.toLowerCase()).toContain('admin');
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ roleId: string }>(
        `SELECT [roleId] FROM [USER] WHERE [email] = @email`,
        { email: ADMIN_EMAIL },
      );
      expect(rows[0]?.roleId?.toLowerCase()).toContain('admin');
    });
  });

  test('LG-03: Sai mật khẩu → 401, form báo lỗi', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', CUSTOMER_EMAIL);
      await page.fill('input[type="password"], #password', 'WrongPassword!9');
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect([400, 401, 403]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(false);
    });

    await test.step('DB SQL', async () => {
      // spamViolationCount may increment or isBlocked still false
      const rows = await db.query<{ status: string }>(
        `SELECT [status] FROM [USER] WHERE [email] = @email`,
        { email: CUSTOMER_EMAIL },
      );
      // User not banned after single wrong attempt
      expect(rows[0]?.status).toBe('ACTIVE');
    });

    // Trang vẫn ở /login
    await expect(page).toHaveURL(new RegExp(`${BASE}/login`));
  });

  test('LG-04: Email không tồn tại → 404/401, thông báo lỗi', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', 'notexist@test-cinema.local');
      await page.fill('input[type="password"], #password', 'AnyPass@123');
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect([400, 401, 404]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(false);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ userId: string }>(
        `SELECT [userId] FROM [USER] WHERE [email] = 'notexist@test-cinema.local'`,
      );
      expect(rows.length).toBe(0);
    });
  });

  test('LG-05: Email rỗng → form validation, không gọi API', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    let apiCalled = false;

    await test.step('FE UI', async () => {
      page.on('request', (req) => {
        if (req.url().includes('/api/auth/login')) apiCalled = true;
      });
      await page.fill('input[type="password"], #password', 'SomePassword@1');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    });

    await test.step('BE API', async () => {
      expect(apiCalled).toBe(false);
    });

    await test.step('DB SQL', async () => {
      // No DB change expected — just confirm table structure OK
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [USER] WHERE [email] = ''`,
      );
      expect(rows[0]?.cnt ?? 0).toBe(0);
    });
  });

  test('LG-06: User bị ban (BANNED) → đăng nhập bị từ chối', async ({ page }) => {
    // Dynamically create a banned user
    const user = await seed.createTestCustomer({ email: `banned-${Date.now()}@test-cinema.local` });

    // Mark as BANNED in DB
    await db.execute(
      `UPDATE [USER] SET [status] = 'BANNED' WHERE [userId] = @id`,
      { id: user.userId },
    );

    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', user.email);
      await page.fill('input[type="password"], #password', user.password);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect([400, 401, 403]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(false);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ status: string }>(
        `SELECT [status] FROM [USER] WHERE [userId] = @id`,
        { id: user.userId },
      );
      expect(rows[0]?.status).toBe('BANNED');
    });

    await seed.deleteUser(user.userId);
  });

  test('LG-07: User chưa xác minh email → đăng nhập bị từ chối', async ({ page }) => {
    const user = await seed.createTestCustomer({ email: `unverified-${Date.now()}@test-cinema.local` });

    // Reset to unverified
    await db.execute(
      `UPDATE [USER] SET [emailVerified]=0, [status]='PENDING_VERIFICATION' WHERE [userId]=@id`,
      { id: user.userId },
    );

    await page.goto(`${BASE}/login`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', user.email);
      await page.fill('input[type="password"], #password', user.password);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      );
      expect([400, 401, 403]).toContain(resp.status());
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ emailVerified: boolean }>(
        `SELECT [emailVerified] FROM [USER] WHERE [userId] = @id`,
        { id: user.userId },
      );
      expect(rows[0]?.emailVerified).toBe(false);
    });

    await seed.deleteUser(user.userId);
  });

});
