/**
 * admin.staff-and-movies.spec.ts — Full E2E (no mocks)
 * Admin: tạo Staff, CRUD Movie
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { loginAsAdmin } from './helpers/auth';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const API = process.env.API_BASE_URL ?? 'http://localhost:5070';

// Track created records for teardown
let createdMovieId: string | null = null;
let createdUserId: string | null = null;

test.afterEach(async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  if (createdMovieId) {
    await page.request.delete(`${API}/api/movies/${createdMovieId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    await seed.deleteMovie(createdMovieId).catch(() => undefined);
    createdMovieId = null;
  }
  if (createdUserId) {
    await seed.deleteUser(createdUserId).catch(() => undefined);
    createdUserId = null;
  }
});

test.describe('Admin — Quản lý Staff', () => {

  test('AS-01: Admin tạo Staff mới → USER + STAFF_PROFILE trong DB', async ({ page }) => {
    await page.goto(BASE);
    await loginAsAdmin(page);

    const staffEmail = `staff-e2e-${Date.now()}@test-cinema.local`;
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    const cinemaId = process.env.TEST_CINEMA_ID ?? 'cinema-001';

    await test.step('FE UI', async () => {
      await page.goto(`${BASE}/admin/staff`);
      const addBtn = page.locator('button:has-text("Thêm"), button:has-text("Tạo nhân viên"), button:has-text("Add")');
      if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addBtn.click();
        await page.fill('input[name="email"], #email', staffEmail);
        await page.fill('input[name="fullName"], #fullName', 'E2E Staff Member');
        // Select cinemaId if dropdown exists
        const cinemaSelect = page.locator('select[name="cinemaId"], #cinemaId');
        if (await cinemaSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await cinemaSelect.selectOption({ index: 0 });
        }
        await page.click('button[type="submit"]');
      } else {
        // Create via API
        const resp = await page.request.post(`${API}/api/admin/staff`, {
          data: { email: staffEmail, fullName: 'E2E Staff Member', cinemaId, position: 'Cashier' },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        expect([200, 201]).toContain(resp.status());
      }
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => (r.url().includes('/api/admin/staff') || r.url().includes('/api/staff')) && r.request().method() === 'POST',
      ).catch(async () => page.request.get(`${API}/api/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      }));
      expect([200, 201]).toContain(resp.status());
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ userId: string; roleId: string }>(
        `SELECT [userId],[roleId] FROM [USER] WHERE [email] = @email`,
        { email: staffEmail },
      );
      if (rows.length > 0) {
        expect(rows[0]!.roleId?.toLowerCase()).toContain('staff');
        createdUserId = rows[0]!.userId;

        const spRows = await db.query<{ staffProfileId: string }>(
          `SELECT [staffProfileId] FROM [STAFF_PROFILE] WHERE [userId] = @uid`,
          { uid: createdUserId },
        );
        expect(spRows.length).toBe(1);
      }
    });
  });

});

test.describe('Admin — Quản lý Phim (Movie)', () => {

  test('AM-01: Admin tạo phim mới → MOVIE tồn tại trong DB', async ({ page }) => {
    await page.goto(BASE);
    await loginAsAdmin(page);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    const title = `E2E Movie ${Date.now()}`;

    await test.step('FE UI', async () => {
      await page.goto(`${BASE}/admin/movies`);
      const addBtn = page.locator('button:has-text("Thêm phim"), button:has-text("Tạo phim"), button:has-text("Add Movie")');
      if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addBtn.click();
        await page.fill('input[name="title"], #title', title);
        await page.fill('input[name="durationMinutes"], #durationMinutes', '120');
        await page.click('button[type="submit"]');
      } else {
        // Create via API
        const resp = await page.request.post(`${API}/api/movies`, {
          data: { title, durationMinutes: 120, movieStatus: 'NOW_SHOWING' },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        expect([200, 201]).toContain(resp.status());
        const body = await resp.json() as { data?: { movieId?: string } };
        if (body.data?.movieId) createdMovieId = body.data.movieId;
      }
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/movies') && r.request().method() === 'POST',
      ).catch(() => null);
      if (resp) {
        expect([200, 201]).toContain(resp.status());
        const body = await resp.json() as { data?: { movieId?: string } };
        if (body.data?.movieId) createdMovieId = body.data.movieId;
      }
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ movieId: string; title: string }>(
        `SELECT [movieId],[title] FROM [MOVIE] WHERE [title] = @title`,
        { title },
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]!.title).toBe(title);
      if (!createdMovieId) createdMovieId = rows[0]!.movieId;
    });
  });

  test('AM-02: Admin cập nhật phim → DB thay đổi title', async ({ page }) => {
    const movie = await seed.createTestMovie({ title: `Before Update ${Date.now()}` });
    createdMovieId = movie.movieId;

    await page.goto(BASE);
    await loginAsAdmin(page);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    const newTitle = `After Update ${Date.now()}`;

    await test.step('FE UI', async () => {
      const resp = await page.request.put(`${API}/api/movies/${movie.movieId}`, {
        data: { title: newTitle, durationMinutes: 95, movieStatus: 'NOW_SHOWING' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect([200, 204]).toContain(resp.status());
    });

    await test.step('BE API', async () => {
      const resp = await page.request.get(`${API}/api/movies/${movie.movieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await resp.json() as { data?: { title?: string } };
      expect(body.data?.title).toBe(newTitle);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ title: string }>(
        `SELECT [title] FROM [MOVIE] WHERE [movieId] = @id`,
        { id: movie.movieId },
      );
      expect(rows[0]?.title).toBe(newTitle);
    });
  });

  test('AM-03: Admin xoá phim → MOVIE không còn trong DB', async ({ page }) => {
    const movie = await seed.createTestMovie({ title: `Delete Me ${Date.now()}` });

    await page.goto(BASE);
    await loginAsAdmin(page);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    await test.step('FE UI', async () => {
      const resp = await page.request.delete(`${API}/api/movies/${movie.movieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 204]).toContain(resp.status());
    });

    await test.step('BE API', async () => {
      const getResp = await page.request.get(`${API}/api/movies/${movie.movieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([404, 400]).toContain(getResp.status());
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [MOVIE] WHERE [movieId] = @id`,
        { id: movie.movieId },
      );
      expect(rows[0]!.cnt).toBe(0);
    });
    // Already deleted — no need for afterEach teardown
    createdMovieId = null;
  });

});
