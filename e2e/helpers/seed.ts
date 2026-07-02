/**
 * e2e/helpers/seed.ts
 * ───────────────────
 * Data factories: create test records directly via SQL before a test,
 * delete them afterwards (teardown). Never call the API to seed —
 * use SQL so seed is independent of application logic.
 *
 * Naming convention:
 *   create*()  → INSERT → return generated IDs
 *   delete*()  → DELETE (handles CASCADE order)
 */

import { db } from './db';

// ─── Tiny ID generator ────────────────────────────────────────────────────────
let _seq = 0;
function tid(prefix: string): string {
  _seq += 1;
  return `${prefix}-e2e-${Date.now()}-${_seq}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SeedUser {
  userId: string;
  email: string;
  password: string;   // plain-text, only known at seed time
  roleId: string;
  fullName: string;
}

export interface SeedMovie {
  movieId: string;
  title: string;
}

export interface SeedRoom {
  roomId: string;
  roomName: string;
  cinemaId: string;
}

export interface SeedShowtime {
  showtimeId: string;
  movieId: string;
  roomId: string;
}

export interface SeedBooking {
  bookingId: string;
  customerProfileId: string;
  showtimeId: string;
}

export interface SeedReview {
  reviewId: string;
  customerProfileId: string;
  movieId: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

/**
 * Insert a Customer user with a pre-hashed password.
 * IMPORTANT: The hash below is BCrypt of "Test@12345". If your backend uses a
 * different hash algo, replace with the correct hash for "Test@12345".
 * The returned `password` field holds the plain-text for use in login forms.
 */
export async function createTestCustomer(overrides?: {
  email?: string;
  fullName?: string;
}): Promise<SeedUser> {
  const userId = tid('usr');
  const customerProfileId = tid('cp');
  const email = overrides?.email ?? `e2e-${Date.now()}@test-cinema.local`;
  const fullName = overrides?.fullName ?? 'E2E Test Customer';
  // BCrypt hash of "Test@12345" (cost=12) — replace if your BE uses a different cost
  const passwordHash = '$2a$12$pVZWFNwb4iNFwOZ0R5b2pO7T2RA9YgBNL2OALQAGBxW8JFbSQD4u.';
  const plainPassword = 'Test@12345';

  await db.execute(
    `INSERT INTO [USER] ([userId],[roleId],[email],[passwordHash],[fullName],[status],[emailVerified])
     VALUES (@userId,'customer',@email,@passwordHash,@fullName,'ACTIVE',1)`,
    { userId, email, passwordHash, fullName },
  );

  await db.execute(
    `INSERT INTO [CUSTOMER_PROFILE] ([customerProfileId],[userId]) VALUES (@cpId, @userId)`,
    { cpId: customerProfileId, userId },
  );

  return { userId, email, password: plainPassword, roleId: 'customer', fullName };
}

/** Delete user + profile + tokens (CASCADE order). */
export async function deleteUser(userId: string): Promise<void> {
  // Child tables first
  await db.execute(`DELETE FROM [REFRESH_TOKEN] WHERE [userId] = @id`, { id: userId });
  await db.execute(`DELETE FROM [EMAIL_VERIFICATION_TOKEN] WHERE [userId] = @id`, { id: userId });
  await db.execute(`DELETE FROM [CUSTOMER_PROFILE] WHERE [userId] = @id`, { id: userId });
  await db.execute(`DELETE FROM [STAFF_PROFILE] WHERE [userId] = @id`, { id: userId });
  await db.execute(`DELETE FROM [USER] WHERE [userId] = @id`, { id: userId });
}

// ─── Movie ────────────────────────────────────────────────────────────────────

export async function createTestMovie(overrides?: { title?: string }): Promise<SeedMovie> {
  const movieId = tid('mv');
  const title = overrides?.title ?? 'E2E Test Movie';

  await db.execute(
    `INSERT INTO [MOVIE]
       ([movieId],[title],[durationMinutes],[movieStatus])
     VALUES (@id, @title, 90, 'NOW_SHOWING')`,
    { id: movieId, title },
  );

  return { movieId, title };
}

export async function deleteMovie(movieId: string): Promise<void> {
  await db.execute(`DELETE FROM [REVIEW] WHERE [movieId] = @id`, { id: movieId });
  await db.execute(`DELETE FROM [MOVIE] WHERE [movieId] = @id`, { id: movieId });
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export async function createTestRoom(cinemaId: string, overrides?: { name?: string }): Promise<SeedRoom> {
  const roomId = tid('room');
  const roomName = overrides?.name ?? `E2E Room ${roomId}`;

  await db.execute(
    `INSERT INTO [ROOM] ([roomId],[cinemaId],[roomName],[capacity]) VALUES (@id,@cid,@name,50)`,
    { id: roomId, cid: cinemaId, name: roomName },
  );

  return { roomId, roomName, cinemaId };
}

export async function deleteRoom(roomId: string): Promise<void> {
  await db.execute(`DELETE FROM [SEAT] WHERE [roomId] = @id`, { id: roomId });
  await db.execute(`DELETE FROM [ROOM] WHERE [roomId] = @id`, { id: roomId });
}

// ─── Showtime ─────────────────────────────────────────────────────────────────

export async function createTestShowtime(
  movieId: string,
  roomId: string,
  daysFromNow = 1,
): Promise<SeedShowtime> {
  const showtimeId = tid('st');
  const start = new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
  const end = new Date(Date.now() + daysFromNow * 86_400_000 + 7_200_000).toISOString();

  await db.execute(
    `INSERT INTO [SHOWTIME] ([showtimeId],[movieId],[roomId],[startTime],[endTime],[basePrice],[status])
     VALUES (@id,@mid,@rid,@start,@end,75000,'OPEN')`,
    { id: showtimeId, mid: movieId, rid: roomId, start, end },
  );

  return { showtimeId, movieId, roomId };
}

export async function deleteShowtime(showtimeId: string): Promise<void> {
  await db.execute(
    `UPDATE [SHOWTIME_SEAT] SET [seatStatus]='AVAILABLE' WHERE [showtimeId]=@id`,
    { id: showtimeId },
  );
  await db.execute(`DELETE FROM [SHOWTIME_SEAT] WHERE [showtimeId] = @id`, { id: showtimeId });
  await db.execute(`DELETE FROM [SHOWTIME] WHERE [showtimeId] = @id`, { id: showtimeId });
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export async function deleteBooking(bookingId: string): Promise<void> {
  // Ticket → BookingSeat → Payment → Booking
  await db.execute(
    `DELETE T FROM [TICKET] T
     JOIN [BOOKING_SEAT] BS ON T.[bookingSeatId] = BS.[bookingSeatId]
     WHERE BS.[bookingId] = @id`,
    { id: bookingId },
  );
  await db.execute(
    `UPDATE SS SET SS.[seatStatus]='AVAILABLE', SS.[lockedUntil]=NULL, SS.[lockedByUserId]=NULL
     FROM [SHOWTIME_SEAT] SS JOIN [BOOKING_SEAT] BS ON SS.[showtimeSeatId]=BS.[showtimeSeatId]
     WHERE BS.[bookingId]=@id`,
    { id: bookingId },
  );
  await db.execute(`DELETE FROM [BOOKING_SEAT] WHERE [bookingId] = @id`, { id: bookingId });
  await db.execute(`DELETE FROM [PAYMENT] WHERE [bookingId] = @id`, { id: bookingId });
  await db.execute(`DELETE FROM [BOOKING] WHERE [bookingId] = @id`, { id: bookingId });
}

// ─── Review ───────────────────────────────────────────────────────────────────

export async function deleteReview(reviewId: string): Promise<void> {
  await db.execute(`DELETE FROM [REVIEW] WHERE [reviewId] = @id`, { id: reviewId });
}

export async function deleteReviewsByCustomer(customerProfileId: string): Promise<void> {
  await db.execute(
    `DELETE FROM [REVIEW] WHERE [customerProfileId] = @id`,
    { id: customerProfileId },
  );
}

// ─── Convenience: find customerProfileId from userId ─────────────────────────

export async function getCustomerProfileId(userId: string): Promise<string | null> {
  const rows = await db.query<{ customerProfileId: string }>(
    `SELECT [customerProfileId] FROM [CUSTOMER_PROFILE] WHERE [userId] = @id`,
    { id: userId },
  );
  return rows[0]?.customerProfileId ?? null;
}
