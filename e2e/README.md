# E2E Tests — CinemaBookingSystem FE

Playwright full E2E test suite. Tests run against a **live BE + SQL Server**.
No API mocks. Every test verifies: **FE UI → BE API response → DB SQL state**.

---

## Cấu trúc

```
e2e/
├── helpers/
│   ├── db.ts          # mssql connection pool + query helpers
│   ├── auth.ts        # loginAs*, loginAsAdmin, loginAsCustomer
│   └── seed.ts        # createTest*, delete* data factories
├── fixtures/
│   └── base.ts        # Custom Playwright fixtures
├── auth.login.spec.ts
├── auth.register.spec.ts
├── auth.forgot-reset-password.spec.ts
├── session.lifecycle.spec.ts
├── user.profile.spec.ts
├── admin.staff-and-movies.spec.ts
├── admin.rooms-and-showtimes.spec.ts
├── seat-layout-and-home.spec.ts
├── booking.showtime-and-seats.spec.ts
├── booking.checkout-success-history.spec.ts
└── review.spec.ts
```

---

## Prerequisite

### 1. Cài packages

```bash
npm install
```

### 2. Cài Playwright browsers

```bash
npx playwright install chromium
# hoặc
npm run test:e2e:install
```

### 3. Tạo `.env.test`

```bash
cp .env.test.example .env.test
```

Điền vào `.env.test`:
```env
PLAYWRIGHT_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:5070
DB_SERVER=localhost
DB_NAME=CinemaBookingDB
DB_USER=sa
DB_PASSWORD=<mật khẩu SQL Auth của bạn>
DB_PORT=1433
TEST_ADMIN_EMAIL=admin@g2cinema.com
TEST_ADMIN_PASSWORD=Admin@12345
TEST_CUSTOMER_EMAIL=customer@g2cinema.com
TEST_CUSTOMER_PASSWORD=Customer@12345
TEST_CINEMA_ID=<cinemaId từ DB>
TEST_MOVIE_ID=<movieId từ DB>
TEST_SHOWTIME_ID=<showtimeId từ DB>
TEST_ROOM_ID=<roomId từ DB>
```

### 4. Đảm bảo seed users tồn tại trong DB

```sql
-- Kiểm tra
SELECT email, status, emailVerified, roleId FROM [USER]
WHERE email IN ('admin@g2cinema.com', 'customer@g2cinema.com');
```

Users phải có: `status='ACTIVE'`, `emailVerified=1`.

---

## Chạy tests

```bash
# Chạy toàn bộ (cần FE + BE đang chạy)
npm run test:e2e

# Chạy 1 file
npx playwright test e2e/auth.login.spec.ts

# Headed mode (thấy browser)
npx playwright test --headed

# UI mode (interactive)
npm run test:e2e:ui

# Xem báo cáo HTML
npm run test:e2e:report
```

---

## Pattern mỗi test

```
test('XX-01: mô tả', async ({ page }) => {
  // Setup: seed data qua SQL
  const user = await seed.createTestCustomer();

  await test.step('FE UI', async () => {
    // Điều hướng + tương tác browser
  });

  await test.step('BE API', async () => {
    // page.waitForResponse() → assert status + body
  });

  await test.step('DB SQL', async () => {
    // db.query() → assert DB state
  });
});

test.afterEach(async () => {
  await seed.deleteUser(userId); // teardown
});
```

---

## Notes

- **Workers = 1**: tests chạy tuần tự để tránh xung đột FK/UNIQUE trên DB
- **Teardown**: `afterEach` luôn xóa dữ liệu test, theo đúng thứ tự CASCADE
- **Payment**: `booking.checkout-success-history.spec.ts` dùng endpoint `POST /api/payments/dev/force-paid/{bookingId}` (test-only). Nếu endpoint chưa tồn tại, test tự fallback UPDATE DB trực tiếp.
- **OTP**: `auth.forgot-reset-password.spec.ts` đọc OTP từ bảng `EMAIL_VERIFICATION_TOKEN` thay vì email thật.
- **Review status**: Nếu bảng `REVIEW` không có cột `status`, xóa cột đó khỏi INSERT trong `review.spec.ts`.
