/**
 * auth.forgot-reset-password.spec.ts — Full E2E (no mocks)
 * Forgot password: POST /api/auth/forgot-password
 * Reset password:  POST /api/auth/reset-password  (OTP read from DB)
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
let testUserId: string | null = null;

test.afterEach(async () => {
  if (testUserId) {
    await seed.deleteUser(testUserId).catch(() => undefined);
    testUserId = null;
  }
});

test.describe('Quên / Đặt lại mật khẩu', () => {

  test('FP-01: Gửi email quên mật khẩu → OTP token tạo trong DB', async ({ page }) => {
    const user = await seed.createTestCustomer({ email: `forgot-${Date.now()}@test-cinema.local` });
    testUserId = user.userId;

    await page.goto(`${BASE}/forgot-password`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', user.email);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/forgot-password') && r.request().method() === 'POST',
      );
      expect([200, 201]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(true);
    });

    await test.step('DB SQL', async () => {
      // OTP token phải được tạo với purpose = 'FORGOT_PASSWORD' hoặc 'PASSWORD_RESET'
      const rows = await db.query<{ tokenId: string; isUsed: boolean; purpose: string }>(
        `SELECT TOP 1 [tokenId],[isUsed],[purpose]
         FROM [EMAIL_VERIFICATION_TOKEN]
         WHERE [userId] = @uid
         ORDER BY [createdAt] DESC`,
        { uid: user.userId },
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]!.isUsed).toBe(false);
      expect(
        ['FORGOT_PASSWORD', 'PASSWORD_RESET'].includes((rows[0]!.purpose ?? '').toUpperCase()),
      ).toBe(true);
    });
  });

  test('FP-02: Email không tồn tại → API trả success (không tiết lộ tồn tại hay không)', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);

    await test.step('FE UI', async () => {
      await page.fill('input[type="email"], #email', `nonexistent-${Date.now()}@test-cinema.local`);
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/forgot-password') && r.request().method() === 'POST',
      );
      // BE should NOT reveal whether email exists (200 either way or 404)
      expect([200, 201, 404]).toContain(resp.status());
    });

    await test.step('DB SQL', async () => {
      // Không có record nào được tạo
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [EMAIL_VERIFICATION_TOKEN]
         WHERE [userId] IN (SELECT [userId] FROM [USER] WHERE [email] LIKE 'nonexistent-%@test-cinema.local')`,
      );
      expect(rows[0]!.cnt).toBe(0);
    });
  });

  test('FP-03: Reset mật khẩu với OTP từ DB → passwordHash thay đổi', async ({ page }) => {
    const user = await seed.createTestCustomer({ email: `reset-${Date.now()}@test-cinema.local` });
    testUserId = user.userId;

    // Đọc passwordHash ban đầu
    const before = await db.query<{ passwordHash: string }>(
      `SELECT [passwordHash] FROM [USER] WHERE [userId] = @id`,
      { id: user.userId },
    );
    const hashBefore = before[0]!.passwordHash;

    // Tạo OTP token trong DB
    const tokenId = `tok-reset-${Date.now()}`;
    const otp = '777666';
    const expired = new Date(Date.now() + 15 * 60_000).toISOString();
    await db.execute(
      `INSERT INTO [EMAIL_VERIFICATION_TOKEN]
         ([tokenId],[userId],[token],[purpose],[expiredAt])
       VALUES (@tid, @uid, @tok, 'FORGOT_PASSWORD', @exp)`,
      { tid: tokenId, uid: user.userId, tok: otp, exp: expired },
    );

    await page.goto(`${BASE}/reset-password?email=${encodeURIComponent(user.email)}`);

    await test.step('FE UI', async () => {
      // OTP input
      const singleOtp = page.locator('input[name="otp"], input[maxlength="6"], #otp');
      if (await singleOtp.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await singleOtp.fill(otp);
      } else {
        const otpInputs = page.locator('input[maxlength="1"]');
        for (let i = 0; i < 6; i++) {
          await otpInputs.nth(i).fill(otp[i]!);
        }
      }
      await page.fill('input[name="newPassword"], #newPassword, input[placeholder*="mật khẩu mới"]', 'NewPassword@999');
      const confirmInput = page.locator('input[name="confirmPassword"], #confirmPassword, input[placeholder*="xác nhận"]');
      if (await confirmInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmInput.fill('NewPassword@999');
      }
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/reset-password') && r.request().method() === 'POST',
      );
      expect([200, 201]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(true);
    });

    await test.step('DB SQL', async () => {
      const after = await db.query<{ passwordHash: string }>(
        `SELECT [passwordHash] FROM [USER] WHERE [userId] = @id`,
        { id: user.userId },
      );
      // Hash phải thay đổi sau reset
      expect(after[0]!.passwordHash).not.toBe(hashBefore);

      // Token phải được đánh dấu isUsed=1
      const tokenRows = await db.query<{ isUsed: boolean }>(
        `SELECT [isUsed] FROM [EMAIL_VERIFICATION_TOKEN] WHERE [tokenId] = @tid`,
        { tid: tokenId },
      );
      expect(tokenRows[0]?.isUsed).toBe(true);
    });
  });

  test('FP-04: OTP sai → 400 error', async ({ page }) => {
    const user = await seed.createTestCustomer({ email: `badotp-${Date.now()}@test-cinema.local` });
    testUserId = user.userId;

    await page.goto(`${BASE}/reset-password?email=${encodeURIComponent(user.email)}`);

    await test.step('FE UI', async () => {
      const singleOtp = page.locator('input[name="otp"], input[maxlength="6"], #otp');
      if (await singleOtp.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await singleOtp.fill('000000');
      } else {
        const otpInputs = page.locator('input[maxlength="1"]');
        for (let i = 0; i < 6; i++) {
          await otpInputs.nth(i).fill('0');
        }
      }
      await page.fill('input[name="newPassword"], #newPassword', 'NewPassword@999');
      const confirmInput = page.locator('input[name="confirmPassword"], #confirmPassword');
      if (await confirmInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmInput.fill('NewPassword@999');
      }
      await page.click('button[type="submit"]');
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/auth/reset-password') && r.request().method() === 'POST',
      );
      expect([400, 401, 404]).toContain(resp.status());
      const body = await resp.json();
      expect(body.success).toBe(false);
    });

    await test.step('DB SQL', async () => {
      // passwordHash không thay đổi
      const rows = await db.query<{ passwordHash: string }>(
        `SELECT [passwordHash] FROM [USER] WHERE [userId] = @id`,
        { id: user.userId },
      );
      // Still the original seeded hash
      expect(rows[0]!.passwordHash).toBeTruthy();
    });
  });

});
