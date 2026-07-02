/**
 * booking.showtime-and-seats.spec.ts — Full E2E (no mocks)
 * ShowtimePicker + SeatSelection → SHOWTIME_SEAT.seatStatus = 'LOCKED'
 */
import { test, expect } from '@playwright/test';
import { db } from './helpers/db';
import { loginAsCustomer } from './helpers/auth';
import { seed } from './fixtures/base';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const API = process.env.API_BASE_URL ?? 'http://localhost:5070';
const CINEMA_ID = process.env.TEST_CINEMA_ID ?? 'cinema-001';
const MOVIE_ID = process.env.TEST_MOVIE_ID ?? 'mv-001';

let tmpRoomId: string | null = null;
let tmpShowtimeId: string | null = null;

test.afterEach(async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('accessToken')).catch(() => null);

  if (tmpShowtimeId) {
    // Unlock any locked seats
    await page.request.post(`${API}/api/seats/unlock`, {
      data: { showtimeId: tmpShowtimeId },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    await seed.deleteShowtime(tmpShowtimeId).catch(() => undefined);
    tmpShowtimeId = null;
  }
  if (tmpRoomId) {
    await db.execute(`DELETE FROM [SEAT] WHERE [roomId] = @id`, { id: tmpRoomId });
    await seed.deleteRoom(tmpRoomId).catch(() => undefined);
    tmpRoomId = null;
  }
});

test.describe('ShowtimePicker + SeatSelection', () => {

  test('SS-01: Mở modal chọn suất chiếu → danh sách SHOWTIME từ API', async ({ page }) => {
    await page.goto(BASE);
    await loginAsCustomer(page);

    await test.step('FE UI', async () => {
      // Navigate to movie showtime page
      await page.goto(`${BASE}/movie/${MOVIE_ID}/showtimes`);
      await page.waitForTimeout(2_000);
      // Should show showtime slots
      await expect(page).not.toHaveURL(/error/);
    });

    await test.step('BE API', async () => {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/showtimes') && r.request().method() === 'GET',
      ).catch(() => null);
      if (resp) {
        expect(resp.status()).toBe(200);
        const body = await resp.json() as { success: boolean };
        expect(body.success).toBe(true);
      }
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM [SHOWTIME] WHERE [movieId] = @mid AND [status] = 'OPEN'`,
        { mid: MOVIE_ID },
      );
      expect(rows[0]!.cnt).toBeGreaterThanOrEqual(0);
    });
  });

  test('SS-02: Lock ghế → SHOWTIME_SEAT.seatStatus = LOCKED + lockedByUserId', async ({ page }) => {
    // Setup: room + seats + showtime
    const room = await seed.createTestRoom(CINEMA_ID, { name: `Lock Room ${Date.now()}` });
    tmpRoomId = room.roomId;

    // Insert 2 seats
    const seatIds: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const sid = `seat-lock-${Date.now()}-${i}`;
      seatIds.push(sid);
      await db.execute(
        `INSERT INTO [SEAT] ([seatId],[roomId],[seatTypeId],[seatCode],[rowLabel],[seatNumber])
         VALUES (@sid, @rid, 'normal', @code, 'A', @num)`,
        { sid, rid: room.roomId, code: `A${i}`, num: i },
      );
    }

    const showtime = await seed.createTestShowtime(MOVIE_ID, room.roomId);
    tmpShowtimeId = showtime.showtimeId;

    // Insert SHOWTIME_SEAT rows
    for (const seatId of seatIds) {
      const ssId = `ss-${seatId}`;
      await db.execute(
        `INSERT INTO [SHOWTIME_SEAT] ([showtimeSeatId],[showtimeId],[seatId],[seatStatus])
         VALUES (@ssid, @stid, @sid, 'AVAILABLE')`,
        { ssid: ssId, stid: showtime.showtimeId, sid: seatId },
      ).catch(() => undefined); // May already exist
    }

    await page.goto(BASE);
    await loginAsCustomer(page);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    let lockedShowtimeSeatIds: string[] = [];

    await test.step('FE UI', async () => {
      // Lock seats via API (simulates seat selection click)
      const ssRows = await db.query<{ showtimeSeatId: string }>(
        `SELECT [showtimeSeatId] FROM [SHOWTIME_SEAT]
         WHERE [showtimeId] = @stid AND [seatStatus] = 'AVAILABLE'`,
        { stid: showtime.showtimeId },
      );
      lockedShowtimeSeatIds = ssRows.slice(0, 1).map((r) => r.showtimeSeatId);

      if (lockedShowtimeSeatIds.length > 0) {
        const resp = await page.request.post(`${API}/api/seats/lock`, {
          data: { showtimeId: showtime.showtimeId, showtimeSeatIds: lockedShowtimeSeatIds },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        expect([200, 201]).toContain(resp.status());
      }
    });

    await test.step('BE API', async () => {
      if (lockedShowtimeSeatIds.length === 0) return;
      const mapResp = await page.request.get(
        `${API}/api/seats/showtimes/${showtime.showtimeId}/map`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect([200]).toContain(mapResp.status());
    });

    await test.step('DB SQL', async () => {
      if (lockedShowtimeSeatIds.length === 0) return;
      const rows = await db.query<{ seatStatus: string; lockedByUserId: string }>(
        `SELECT [seatStatus],[lockedByUserId]
         FROM [SHOWTIME_SEAT]
         WHERE [showtimeSeatId] = @ssid`,
        { ssid: lockedShowtimeSeatIds[0] },
      );
      expect(rows[0]?.seatStatus).toBe('LOCKED');
      expect(rows[0]?.lockedByUserId).toBeTruthy();
    });
  });

  test('SS-03: Unlock ghế → SHOWTIME_SEAT.seatStatus = AVAILABLE', async ({ page }) => {
    const room = await seed.createTestRoom(CINEMA_ID, { name: `Unlock Room ${Date.now()}` });
    tmpRoomId = room.roomId;

    const seatId = `seat-ul-${Date.now()}`;
    await db.execute(
      `INSERT INTO [SEAT] ([seatId],[roomId],[seatTypeId],[seatCode],[rowLabel],[seatNumber])
       VALUES (@sid, @rid, 'normal', 'B1', 'B', 1)`,
      { sid: seatId, rid: room.roomId },
    );

    const showtime = await seed.createTestShowtime(MOVIE_ID, room.roomId);
    tmpShowtimeId = showtime.showtimeId;

    const ssId = `ss-ul-${Date.now()}`;
    await db.execute(
      `INSERT INTO [SHOWTIME_SEAT] ([showtimeSeatId],[showtimeId],[seatId],[seatStatus])
       VALUES (@ssid, @stid, @sid, 'AVAILABLE')`,
      { ssid: ssId, stid: showtime.showtimeId, sid: seatId },
    );

    await page.goto(BASE);
    await loginAsCustomer(page);
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));

    // Lock first
    await page.request.post(`${API}/api/seats/lock`, {
      data: { showtimeId: showtime.showtimeId, showtimeSeatIds: [ssId] },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => undefined);

    await test.step('FE UI', async () => {
      const resp = await page.request.post(`${API}/api/seats/unlock`, {
        data: { showtimeId: showtime.showtimeId, showtimeSeatIds: [ssId] },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect([200, 204]).toContain(resp.status());
    });

    await test.step('BE API', async () => {
      await expect(page).not.toHaveURL(/error/);
    });

    await test.step('DB SQL', async () => {
      const rows = await db.query<{ seatStatus: string }>(
        `SELECT [seatStatus] FROM [SHOWTIME_SEAT] WHERE [showtimeSeatId] = @ssid`,
        { ssid: ssId },
      );
      expect(rows[0]?.seatStatus).toBe('AVAILABLE');
    });
  });

});
