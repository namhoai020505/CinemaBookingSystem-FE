/**
 * auth.register.spec.ts — Full E2E (no mocks)
 * POST /api/auth/register + POST /api/auth/verify-email
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

// Track created users for afterEach cleanup
let createdUserId: string | null = null;

test.afterEach(async () => {
  if (createdUserId) {
    await seed.deleteUser(createdUserId).catch(() => undefined);
    createdUserId = null;
  }
});

test.describe('Đăng ký tài khoản (Register)', () => {

  test('RG-01: Happy path — đăng ký thành công → user tạo trong DB với emailVerified=0', async ({ page }) => {
    const email = `reg-${Date.now()}@test-cinema.local`;
    const fullName = 'E2E Register User';

    await page.goto(`${BASE}/register`);

    await test.step('FE UI', async () => {
      await page.fill('input[name="fullName"], #fullName, input[placeholder*="tên"]', fullName);
      await page.fill('input[type="email"], #email', email);
      await page.fill('input[name="password"], #password', 'Register@12345');
      const confirmInput = page.locator('input[name="confirmPassword"], #confirmPassword, input[placeholder*="xác nhận"]');
      if (await confirmInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmInput.fill('Register@12345');
      }
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
      );
      expect([200, 201]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(true);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ userId: string; roleId: string; emailVerified: boolean; status: string }>(
        `SELECT [userId],[roleId],[emailVerified],[status]
         FROM [USER] WHERE [email] = @email`,
        { email },
      );
      expect(rows.length).toBe(1);
      expect(rows[0]!.roleId?.toLowerCase()).toBe('customer');
      expect(rows[0]!.emailVerified).toBe(false);
      expect(rows[0]!.status).toBe('PENDING_VERIFICATION');
      createdUserId = rows[0]!.userId;

      // CUSTOMER_PROFILE should exist
      const cpRows = await db.query<{ customerProfileId: string }>(
        `SELECT [customerProfileId] FROM [CUSTOMER_PROFILE] WHERE [userId] = @uid`,
        { uid: createdUserId },
      );
      expect(cpRows.length).toBe(1);

      // OTP token should exist
      const tokenRows = await db.query<{ tokenId: string; isUsed: boolean }>(
        `SELECT [tokenId],[isUsed] FROM [EMAIL_VERIFICATION_TOKEN] WHERE [userId] = @uid`,
        { uid: createdUserId },
      );
      expect(tokenRows.length).toBeGreaterThan(0);
      expect(tokenRows[0]!.isUsed).toBe(false);
    });
  });

  test('RG-02: Email đã tồn tại → 409 Conflict, form báo lỗi', async ({ page }) => {
    const existingEmail = process.env.TEST_CUSTOMER_EMAIL!;
    await page.goto(`${BASE}/register`);

    await test.step('FE UI', async () => {
      await page.fill('input[name="fullName"], #fullName, input[placeholder*="tên"]', 'Dup User');
      await page.fill('input[type="email"], #email', existingEmail);
      await page.fill('input[name="password"], #password', 'Register@12345');
      const confirmInput = page.locator('input[name="confirmPassword"], #confirmPassword');
      if (await confirmInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmInput.fill('Register@12345');
      }
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
      );
      expect([400, 409]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(false);
    });

    await test.step('DB SQL', async () => {
      // Chỉ 1 user với email này
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [USER] WHERE [email] = @email`,
        { email: existingEmail },
      );
      expect(rows[0]!.cnt).toBe(1);
    });
  });

  test('RG-03: Mật khẩu không khớp → không gọi API (FE validation)', async ({ page }) => {
    let apiCalled = false;
    await page.goto(`${BASE}/register`);

    await test.step('FE UI', async () => {
      page.on('request', (req) => {
        if (req.url().includes('/api/auth/register')) apiCalled = true;
      });
      await page.fill('input[name="fullName"], #fullName', 'Mismatch User');
      await page.fill('input[type="email"], #email', `mismatch-${Date.now()}@test.local`);
      await page.fill('input[name="password"], #password', 'Password@123');
      const confirmInput = page.locator('input[name="confirmPassword"], #confirmPassword');
      if (await confirmInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmInput.fill('DifferentPassword@456');
      }
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1_000);
    });

    await test.step('BE API', async () => {
      expect(apiCalled).toBe(false);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [USER] WHERE [email] LIKE 'mismatch-%@test.local'`,
      );
      expect(rows[0]!.cnt).toBe(0);
    });
  });

  test('RG-04: Verify email với OTP đọc từ DB → tài khoản ACTIVE', async ({ page }) => {
    // Tạo user mới qua SQL seed
    const user = await seed.createTestCustomer({
      email: `verify-${Date.now()}@test-cinema.local`,
    });
    // Reset to unverified
    await db.execute(
      `UPDATE [USER] SET [emailVerified]=0, [status]='PENDING_VERIFICATION' WHERE [userId]=@id`,
      { id: user.userId },
    );
    createdUserId = user.userId;

    // Tạo OTP token trong DB
    const tokenId = `tok-e2e-${Date.now()}`;
    const otp = '999888';
    const expired = new Date(Date.now() + 15 * 60_000).toISOString();
    await db.execute(
      `INSERT INTO [EMAIL_VERIFICATION_TOKEN]
         ([tokenId],[userId],[token],[purpose],[expiredAt])
       VALUES (@tid, @uid, @tok, 'EMAIL_VERIFICATION', @exp)`,
      { tid: tokenId, uid: user.userId, tok: otp, exp: expired },
    );

    await page.goto(`${BASE}/verify-email?email=${encodeURIComponent(user.email)}`);

    await test.step('FE UI', async () => {
      // OTP input (may be 6 separate boxes or single input)
      const singleOtp = page.locator('input[name="otp"], input[maxlength="6"], #otp');
      if (await singleOtp.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await singleOtp.fill(otp);
      } else {
        // Split inputs
        const otpInputs = page.locator('input[maxlength="1"]');
        for (let i = 0; i < 6; i++) {
          await otpInputs.nth(i).fill(otp[i]!);
        }
      }
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/verify-email') && r.request().method() === 'POST',
      );
      expect([200, 201]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(true);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ emailVerified: boolean; status: string }>(
        `SELECT [emailVerified],[status] FROM [USER] WHERE [userId] = @id`,
        { id: user.userId },
      );
      expect(rows[0]!.emailVerified).toBe(true);
      expect(rows[0]!.status).toBe('ACTIVE');
    });
  });

});
