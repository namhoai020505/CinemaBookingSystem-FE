import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import AdminLayout from './layouts/admin/AdminLayout';
import UserLayout from './layouts/user/UserLayout';
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';
import Dashboard from './pages/admin/Dashboard';
import ManageMovie from './pages/admin/ManageMovie';
import ManageRooms from './pages/admin/ManageRooms';
import ManageSeatLayout from './pages/admin/ManageSeatLayout';
import ManageShowtime from './pages/admin/ManageShowtime';
import ManageStaff from './pages/admin/ManageStaff';
import BookingSuccess from './pages/user/BookingSuccess';
import Checkout from './pages/user/Checkout';
import Home from './pages/user/Home';
import MovieShowtimes from './pages/user/MovieShowtimes';
import MyBookings from './pages/user/MyBookings';
import Profile from './pages/user/Profile';
import SeatSelection from './pages/user/SeatSelection';

// Nhóm role được truyền vào RequireAuth để khóa route theo quyền trong JWT.
const customerRoles = ['customer'];
const adminRoles = ['admin'];

// Gắn bộ đếm idle toàn cục để tự logout khi người dùng không thao tác quá lâu.
const GlobalTimer = () => {
  useIdleTimeout(10);
  return null;
};

// Khai báo toàn bộ route chính của FE: auth, user flow đặt vé, và admin dashboard.
function App() {
  return (
    <BrowserRouter>
      {/* Đặt timer bên trong BrowserRouter để hook có thể điều hướng khi hết phiên. */}
      <GlobalTimer />

      <Routes>
        {/* Route auth dùng chung cho login/register/forgot password. */}
        <Route path="/login" element={<Login />} />
        <Route path="/staff/set-password" element={<StaffSetPassword />} />

        {/* Layout dành cho khách hàng và các trang đặt vé công khai. */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/movie/:movieId/showtimes" element={<MovieShowtimes />} />
          <Route path="/booking/seats/:showtimeId" element={<SeatSelection />} />

          {/* Các bước cần đăng nhập customer mới được vào. */}
          <Route element={<RequireAuth allowedRoles={customerRoles} />}>
            <Route path="/booking/checkout/:showtimeId" element={<Checkout />} />
            <Route path="/booking/success/:bookingId" element={<BookingSuccess />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Cụm route admin yêu cầu JWT có role admin và xác minh lại với backend. */}
        <Route element={<RequireAuth allowedRoles={adminRoles} verifyAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="movies" element={<ManageMovie />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="showtime" element={<ManageShowtime />} />
            <Route path="staff" element={<ManageStaff />} />
            <Route path="rooms" element={<ManageRooms />} />
            <Route path="rooms/:roomId/seats" element={<ManageSeatLayout />} />

            {/* Route index giúp /admin tự chuyển về dashboard tổng quan. */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Route>

        {/* Fallback: URL không tồn tại sẽ về trang chủ user. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
