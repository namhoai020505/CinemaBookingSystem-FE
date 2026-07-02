# Ma Trận Tích Hợp FE ↔ BE — CinemaBookingSystem

> Cập nhật: 2026-06-29 | Phân tích: 17 BE Controllers · 9 FE Services · 14 Pages/Screens

---

## 🔐 Xác Thực & Phân Quyền

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Đăng ký tài khoản Customer | Guest | 🟢 | Ready for E2E | FE: `Login.tsx`, `useLoginController.ts` · BE: `AuthController` → `IAuthService` |
| Xác minh email bằng OTP | Guest | 🟢 | Ready for E2E | FE: `useLoginController.ts` (verify step) · BE: `AuthController.VerifyEmail`, `ResendVerificationOtp` |
| Đăng nhập email/password | Guest | 🟢 | Ready for E2E | FE: `Login.tsx`, `useLoginController.ts` · BE: `AuthController.Login` |
| Đăng nhập Google OAuth | Guest | 🟢 | Ready for E2E | FE: `AuthShell.tsx` (GoogleLogin), `useLoginController.ts` · BE: `AuthController.GoogleLogin` |
| Đăng xuất | Customer/Admin | 🟢 | Ready for E2E | FE: `authUtils.ts`, `useLoginController.ts` · BE: `AuthController.Logout` |
| Refresh Access Token | Customer/Admin | 🟢 | Ready for E2E | FE: `lib/api.ts` (interceptor) · BE: `AuthController.RefreshToken` |
| Quên mật khẩu (request OTP) | Guest | 🟢 | Ready for E2E | FE: `useLoginController.ts` (forgot step) · BE: `AuthController.ForgotPassword` |
| Đặt lại mật khẩu bằng OTP | Guest | 🟢 | Ready for E2E | FE: `useLoginController.ts` (reset step) · BE: `AuthController.ResetPassword` |
| Đổi mật khẩu (đã đăng nhập) | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.ChangePassword` |
| Admin tạo tài khoản Staff | Admin | 🟢 | Ready for E2E | FE: `ManageStaff.tsx`, `staffService.ts` · BE: `AdminController.CreateStaff` |
| Staff thiết lập mật khẩu lần đầu | Staff | 🟢 | Ready for E2E | FE: `StaffSetPassword.tsx` · BE: `AuthController` (token invite flow) |
| Idle auto-logout | Customer/Admin | 🟢 | Ready for E2E | FE: `hooks/useIdleTimeout.ts` · BE: stateless (JWT) |

---

## 👤 Quản Lý Hồ Sơ Khách Hàng

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Xem thông tin cá nhân | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.GetProfile` |
| Cập nhật hồ sơ (tên, SĐT, địa chỉ) | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.UpdateProfile` |
| Yêu cầu đổi email (gửi OTP) | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.RequestEmailChange` |
| Xác nhận OTP đổi email | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.VerifyEmailChange` |
| Xem lịch sử booking (từ profile) | Customer | 🟢 | Ready for E2E | FE: `Profile.tsx`, `customerService.ts` · BE: `CustomersController.GetBookingHistory` |

---

## 🎬 Quản Lý Phim (Admin)

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Danh sách phim (bao gồm đã xoá) | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageMovie.tsx`, `movieService.ts` · BE: `MoviesController.GetMovies` |
| Xem chi tiết phim | Admin/Manager/Guest | 🟢 | Ready for E2E | FE: `Home.tsx`, `MovieShowtimes.tsx`, `movieService.ts` · BE: `MoviesController.GetMovieById` |
| Tạo phim mới (có upload poster) | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageMovie.tsx`, `movieService.ts` · BE: `MoviesController.CreateMovie`, `UploadController` |
| Cập nhật phim (có upload poster) | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageMovie.tsx`, `movieService.ts` · BE: `MoviesController.UpdateMovie` |
| Xoá phim (soft-delete) | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageMovie.tsx`, `movieService.ts` · BE: `MoviesController.DeleteMovie` |
| Tăng view phim (auto-call) | Guest/Customer | 🔴 | FE không gọi `POST /api/movies/{id}/view` khi vào trang | FE: `MovieShowtimes.tsx` (thiếu gọi) · BE: `MoviesController.IncrementMovieView` |
| Upload ảnh riêng (không qua movie) | Admin/Manager | 🔴 | FE không có UI/service gọi `POST /api/upload/image` trực tiếp | FE: không có · BE: `UploadController.UploadImage` |

---

## 🏛️ Quản Lý Phòng Chiếu (Admin)

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Danh sách phòng | Admin/Manager/Staff | 🟢 | Ready for E2E | FE: `ManageRooms.tsx`, `roomService.ts` · BE: `RoomsController.GetRooms` |
| Tạo phòng mới | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageRooms.tsx`, `roomService.ts` · BE: `RoomsController.CreateRoom` |
| Cập nhật phòng | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageRooms.tsx`, `roomService.ts` · BE: `RoomsController.UpdateRoom` |
| Xoá phòng | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageRooms.tsx`, `roomService.ts` · BE: `RoomsController.DeleteRoom` |
| Tạo ghế hàng loạt (generate) | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageSeatLayout.tsx`, `roomService.ts` · BE: `RoomsController.GenerateSeats` |

---

## 💺 Quản Lý Ghế (Admin)

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Xem sơ đồ ghế theo phòng | Admin/Manager/Staff | 🟢 | Ready for E2E | FE: `ManageSeatLayout.tsx`, `roomService.ts` · BE: `SeatsController.GetSeatsByRoom` |
| Tạo ghế đơn lẻ | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageSeatLayout.tsx` · BE: `SeatsController.CreateSeatRequest` |
| Cập nhật ghế | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageSeatLayout.tsx` · BE: `SeatsController.UpdateSeat` |
| Xoá ghế | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageSeatLayout.tsx` · BE: `SeatsController.DeleteSeat` |
| Xem ghế theo showtime (seat map) | Customer/Guest | 🟢 | Ready for E2E | FE: `SeatSelection.tsx` · BE: `SeatsController.GetSeatMap` (policy: `CanSelectSeat`) |
| Khoá ghế (seat lock) | Customer | 🟢 | Ready for E2E | FE: `SeatSelection.tsx` · BE: `SeatsController.LockSeat` |
| Mở khoá ghế | Customer | 🟢 | Ready for E2E | FE: `SeatSelection.tsx` · BE: `SeatsController.UnlockSeat` |
| Danh sách ghế phân trang (admin) | Admin/Manager | 🔴 | FE không có UI trang phân trang ghế toàn bộ | FE: không có · BE: `SeatsController.GetSeats`, `GetSeatById` |

---

## 🕐 Quản Lý Suất Chiếu

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Danh sách suất chiếu | Guest/Admin | 🟢 | Ready for E2E | FE: `ManageShowtime.tsx`, `MovieShowtimes.tsx`, `showtimeService.ts` · BE: `ShowtimesController.GetShowtimes` |
| Tạo suất chiếu | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageShowtime.tsx`, `showtimeService.ts` · BE: `ShowtimesController.CreateShowtime` |
| Cập nhật suất chiếu | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageShowtime.tsx`, `showtimeService.ts` · BE: `ShowtimesController.UpdateShowtime` |
| Xoá suất chiếu | Admin/Manager | 🟢 | Ready for E2E | FE: `ManageShowtime.tsx`, `showtimeService.ts` · BE: `ShowtimesController.DeleteShowtime` |
| Đổi phòng chiếu (change room) | Admin/Manager | 🔴 | FE `showtimeService.ts` không gọi `POST /{id}/change-room` | FE: không có · BE: `ShowtimesController.ChangeRoom` |
| Xác nhận thay đổi giờ chiếu qua email | Customer | 🔴 | FE không có trang/route xử lý link email confirm-time-change | FE: không có · BE: `BookingsController.ConfirmTimeChange` |

---

## 🎟️ Đặt Vé & Checkout

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Trang chủ — danh sách phim | Guest/Customer | 🟢 | Ready for E2E | FE: `Home.tsx`, `movieService.ts` · BE: `MoviesController.GetMovies` |
| Xem suất chiếu theo phim | Guest/Customer | 🟢 | Ready for E2E | FE: `MovieShowtimes.tsx`, `showtimeService.ts` · BE: `ShowtimesController` |
| Chọn ghế (seat map) | Guest/Customer | 🟢 | Ready for E2E | FE: `SeatSelection.tsx` · BE: `SeatsController.GetSeatMap`, `LockSeat` |
| Tạo booking (checkout) | Customer | 🟢 | Ready for E2E | FE: `Checkout.tsx`, `bookingService.ts` · BE: `BookingsController.CreateBooking` |
| Chọn combo F&B khi checkout | Customer | 🟡 | BE chưa có API F&B items; FE hard-code danh sách combo | FE: `Checkout.tsx` (FNB_ITEMS hard-coded) · BE: không có `FoodBeverageController` |
| Áp dụng voucher giảm giá | Customer | 🟡 | BE nhận `voucherCode` nhưng chưa có API tra cứu/validate voucher | FE: `Checkout.tsx` (UI placeholder) · BE: schema có `voucherCode`, chưa có endpoint |
| Đổi điểm thưởng (reward points) | Customer | 🔴 | FE hard-code `pointDiscount = 0`; BE chưa có endpoint áp dụng điểm | FE: `Checkout.tsx` (placeholder) · BE: không có |
| Thanh toán QR SePay | Customer | 🟢 | Ready for E2E | FE: `Checkout.tsx`, `paymentService.ts` · BE: `PaymentController.CreatePayment`, `SepayWebhook` |
| Polling trạng thái thanh toán | Customer | 🟢 | Ready for E2E | FE: `Checkout.tsx` (interval poll `GET /api/bookings/{id}`) · BE: `BookingsController.GetBookingDetails` |
| Trang xác nhận đặt vé thành công | Customer | 🟢 | Ready for E2E | FE: `BookingSuccess.tsx`, `bookingService.ts` · BE: `BookingsController.GetBookingDetails` |
| Xem lịch sử vé của tôi | Customer | 🟢 | Ready for E2E | FE: `MyBookings.tsx`, `bookingService.ts` · BE: `BookingsController.GetMyBookings` |
| Ẩn booking hết hạn khỏi lịch sử | Customer | 🟢 | Ready for E2E (client-only, localStorage) | FE: `bookingService.ts` (`hideExpiredBookingFromHistory`) · BE: không cần |
| Resume booking cũ (pending payment) | Customer | 🟢 | Ready for E2E | FE: `Checkout.tsx` (`resumeBooking` state) · BE: `BookingsController.GetBookingDetails` |

---

## 💳 Hoàn Tiền (Refund)

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Admin xem danh sách refund | Admin | 🔴 | FE không có trang/UI quản lý refund | FE: không có · BE: `AdminRefundsController.GetRefunds` |
| Admin xác nhận hoàn tiền | Admin | 🔴 | FE không có nút/form confirm refund | FE: không có · BE: `AdminRefundsController.ConfirmRefund` |
| Customer yêu cầu hoàn tiền | Customer | 🔴 | Không có UI lẫn API endpoint yêu cầu từ phía customer | FE: không có · BE: không có endpoint `POST /refund/request` |

---

## ⭐ Đánh Giá Phim (Review)

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Xem review phim (public) | Guest/Customer | 🟢 | Ready for E2E | FE: `MovieShowtimes.tsx`, `reviewService.ts` · BE: `ReviewsController.GetMovieReviews` |
| Gửi review phim | Customer | 🟢 | Ready for E2E | FE: `MovieShowtimes.tsx`, `reviewService.ts` · BE: `ReviewsController.CreateReview` |
| Sửa review của mình | Customer | 🔴 | FE không có UI cho `PUT /api/reviews/{id}` | FE: không có · BE: `ReviewsController.EditReview` |
| Xem review của tôi | Customer | 🔴 | FE không có UI cho `GET /api/reviews/me` | FE: không có · BE: `ReviewsController.GetCustomerReviews` |
| Admin xem hàng đợi kiểm duyệt | Admin | 🟡 | FE gọi `/api/reviews/admin/moderation-queue` nhưng BE không có endpoint này | FE: `ReviewModeration.tsx`, `reviewService.ts` · BE: không có endpoint |
| Admin duyệt review | Admin | 🟢 | Ready for E2E | FE: `ReviewModeration.tsx`, `reviewService.ts` · BE: `ReviewsController.AdminApproveReview` |
| Admin từ chối review | Admin | 🟡 | FE gọi `PUT /api/reviews/admin/{id}/reject` nhưng BE chưa implement endpoint này | FE: `ReviewModeration.tsx`, `reviewService.ts` · BE: không có endpoint `reject` |

---

## 🤖 Chatbot AI

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Chatbot hỏi đáp phim/suất chiếu | Guest/Customer | 🔴 | FE không có UI/service gọi `POST /api/chatbot` | FE: không có · BE: `ChatbotController.Ask`, `IChatbotService` |

---

## 📊 Dashboard Admin

| Tên Luồng / Feature | Role | Trạng Thái | Chi Tiết Lệch Pha / Bug | Files Liên Quan |
|---|---|---|---|---|
| Trang tổng quan (Dashboard) | Admin | 🔴 | `Dashboard.tsx` là stub rỗng; không có API thống kê | FE: `Dashboard.tsx` (596 bytes) · BE: không có `StatisticsController` |
| Quản lý Staff (danh sách/tìm kiếm) | Admin | 🔴 | FE chỉ tạo được staff; không có API GET danh sách staff | FE: `ManageStaff.tsx` · BE: `AdminController` chỉ có `POST /api/admin/staff` |

---

## 🏷️ Tóm Tắt Tổng Thể

| Trạng Thái | Số Luồng | Ghi Chú |
|---|---|---|
| 🟢 Hoàn chỉnh | **31** | Sẵn sàng E2E test |
| 🔴 FE thiếu UI | **15** | BE có API nhưng FE chưa implement |
| 🟡 BE thiếu API | **4** | FE có UI/gọi nhưng BE chưa có endpoint |

> **Ưu tiên xử lý 🟡 trước**: endpoint reject review, moderation-queue, voucher validate — ảnh hưởng trực tiếp tới flow đặt vé và kiểm duyệt đang live.
