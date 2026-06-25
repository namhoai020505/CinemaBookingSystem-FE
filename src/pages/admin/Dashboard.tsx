export default function Dashboard() {
  return (
    // Container chính của trang Dashboard admin.
    // Sau này có thể đặt các card thống kê và biểu đồ tổng quan toàn rạp trong khối này.
    <div>
      {/* Tiêu đề trang để admin biết đang ở khu vực tổng quan. */}
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>

      {/* Mô tả ngắn cho khu vực quản trị, hiện tại đang là nội dung placeholder. */}
      <p className="mt-4 text-gray-600">Đây là khu vực quản trị.</p>
    </div>
  );
}
