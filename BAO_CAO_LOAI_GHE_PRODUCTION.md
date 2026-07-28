# Báo cáo xử lý loại ghế trên production

Ngày hoàn tất: 28/07/2026  
Phòng đối chiếu: `ROOM_70958CA5`  
Frontend: <https://cinema.beer/admin/rooms/ROOM_70958CA5/seats>  
Backend: <https://cinemabookingsystem-be-production.up.railway.app>

## 1. Kết quả cuối

- Đã xóa loại ghế `PREMIUM` không được sử dụng.
- Đã chuyển toàn bộ `60` ghế `Standard` trong hệ thống sang `NORMAL`, sau đó xóa `Standard`.
- Catalog production hiện chỉ còn ba loại ghế sử dụng thực tế: `VIP`, `NORMAL`, `SWEETBOX`.
- `NORMAL` có `60` ghế trên toàn hệ thống; phòng đối chiếu hiện có `0` ghế NORMAL.
- `VIP` có `363` ghế trên toàn hệ thống; phòng đối chiếu hiện có `48` ghế.
- `SWEETBOX` có `7` ghế trên toàn hệ thống; phòng đối chiếu hiện có `6` ghế.
- Phần **Danh mục loại ghế** đã được bỏ khỏi giao diện.
- Phần **Chỉnh sửa hàng loạt** đã được đưa lên trước thống kê và cấu hình khung rạp để giảm thao tác cuộn trang.
- Bundle production cuối xác nhận không còn hiển thị `Standard`, `PREMIUM` hoặc **Danh mục loại ghế**.

## 2. Điểm nghẽn và nguyên nhân

### Lỗi tạo ghế Normal/Sweetbox trước đây

Frontend cũ gửi ID loại ghế cố định. ID VIP tình cờ tồn tại trong database nên tạo được, còn ID Normal và Sweetbox không tồn tại nên backend trả `404`. Điểm nghẽn nằm ở sự không đồng bộ giữa ID hardcode phía frontend và catalog trong database, không nằm ở thao tác chọn ghế hoặc cấu hình phòng.

Hướng xử lý đã triển khai:

- Frontend lấy catalog từ API và gửi `seatTypeId` thật do backend cung cấp.
- Backend tự sinh ID loại ghế.
- Ghế đôi được nhận diện bằng `seatSpan = 2`, không dựa vào tên hoặc ID.

### Không xóa được Standard dù phòng hiện tại hiển thị 0

Giao diện cũ quyết định cho phép xóa theo số ghế của **phòng đang mở**. Backend lại kiểm tra khóa ngoại trên **toàn hệ thống**. Vì vậy:

- Phòng `ROOM_70958CA5` có `0` ghế Standard.
- Toàn hệ thống vẫn có `60` ghế Standard ở các phòng khác.
- Giao diện đưa ra hành động xóa nhưng backend từ chối vì loại ghế vẫn đang được tham chiếu.

Đây là chênh lệch phạm vi dữ liệu giữa frontend và backend: `room usage` so với `global usage`.

## 3. Hướng sửa không hardcode

Backend trả thêm `usageCount` toàn hệ thống cho mỗi loại ghế và cung cấp API merge:

`POST /api/seat-types/{sourceSeatTypeId}/merge`

API thực hiện trong một lần lưu dữ liệu:

1. Kiểm tra loại nguồn và loại đích tồn tại.
2. Chỉ cho phép merge nếu hai loại có cùng `seatSpan` và `extraFee`.
3. Chuyển mọi ghế đang tham chiếu loại nguồn sang loại đích.
4. Xóa loại nguồn sau khi không còn tham chiếu.

Frontend không hardcode tên `Standard`, `NORMAL` hay bất kỳ ID nào. Nút merge chỉ xuất hiện khi:

- Loại nguồn còn được sử dụng trên toàn hệ thống nhưng không có ghế trong phòng hiện tại.
- Có đúng một loại đích đang hoạt động cùng `seatSpan` và `extraFee`.

Trong dữ liệu production, `Standard` và `NORMAL` đều là ghế đơn, phụ thu `0đ`, nên hệ thống tự suy ra `NORMAL` là đích tương thích. `PREMIUM` không có ghế tham chiếu nên được xóa trực tiếp.

## 4. Thay đổi giao diện

- Bỏ khu vực tạo/chỉnh sửa **Danh mục loại ghế** theo yêu cầu vì chưa phù hợp quy trình vận hành thực tế.
- Giữ catalog chỉ để hiển thị chú thích và thống kê từ dữ liệu backend.
- Đưa **Chỉnh sửa hàng loạt** lên ngay sau sơ đồ ghế.
- Thống kê hiển thị đồng thời số ghế trong phòng và số ghế toàn hệ thống khi hai số khác nhau.
- Sau khi merge, bộ đếm loại đích được cập nhật ngay trong state; không cần refresh trang.

## 5. Commit và kiểm thử

### Frontend — nhánh `Main`

- `2d6f897 fix(seats): streamline layout controls`
- `5cfe13e fix(seats): merge duplicate seat types safely`
- `47e38df fix(seats): refresh merged usage count immediately`
- `npm run build`: đạt.

### Backend — nhánh `Tom/ticketscan2-postgres-integration`

- `af79f56 feat(seats): safely delete unused seat types`
- `9fb96a6 feat(seats): merge compatible seat types`
- Bộ test `SeatTypeCatalogServiceTests`: `6/6` đạt.

Các test bao gồm:

- Trả đúng số ghế sử dụng trên toàn hệ thống.
- Xóa loại ghế không được sử dụng.
- Từ chối xóa loại còn tham chiếu.
- Merge hai loại tương thích, chuyển khóa ngoại và xóa loại nguồn.
- Từ chối merge hai loại không tương thích.

## 6. Deployment production

### Frontend

- Vercel deployment cuối: `dpl_5Qw4GLb3MkXzSJ6dE2kCvnqZkzAV`.
- Production URL: <https://cinema.beer>.
- Trạng thái: `READY`.

### Backend

- Railway tự triển khai commit `9fb96a6`.
- Health endpoint trả `200 OK`.
- Route merge được xác nhận đã tồn tại và yêu cầu xác thực (`401` khi gọi không có phiên đăng nhập), thay vì `404` của bản cũ.

## 7. Đối chiếu production sau dọn dữ liệu

Sau refresh bằng phiên admin:

| Loại ghế | Trong phòng đối chiếu | Toàn hệ thống |
|---|---:|---:|
| VIP | 48 | 363 |
| NORMAL | 0 | 60 |
| SWEETBOX | 6 | 7 |

`Standard`: không còn.  
`PREMIUM`: không còn.

Giao diện cuối xác nhận:

- Có `VIP`, `NORMAL`, `SWEETBOX`.
- Có **Chỉnh sửa hàng loạt**.
- Không có **Danh mục loại ghế**.
- Không có `Standard` hoặc `PREMIUM`.

## 8. Theo dõi sau deployment

Production được theo dõi đủ `180` giây sau deployment cuối:

| Mốc | Frontend | Backend |
|---:|---:|---:|
| 0 giây | 200 | 200 |
| 45 giây | 200 | 200 |
| 90 giây | 200 | 200 |
| 135 giây | 200 | 200 |
| 180 giây | 200 | 200 |

Không ghi nhận crash trong cửa sổ theo dõi. Frontend và backend duy trì phản hồi `200` ở toàn bộ các mốc.

## 9. File chính đã thay đổi

Frontend:

- `src/pages/admin/ManageSeatLayout.tsx`
- `src/services/roomService.ts`

Backend:

- `CinemaSystem.Contracts/Seats/MergeSeatTypeRequest.cs`
- `CinemaSystem.Contracts/Seats/SeatTypeResponse.cs`
- `CinemaSystem.Application/Interfaces/ISeatTypeCatalogService.cs`
- `CinemaSystem.Infrastructure/Services/SeatTypeCatalogService.cs`
- `CinemaSystem.API/Controllers/SeatTypesController.cs`
- `CinemaSystem.Tests/Services/SeatTypeCatalogServiceTests.cs`
