import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import Layouts
import AdminLayout from './layouts/admin/AdminLayout';
import UserLayout from './layouts/user/UserLayout';

// Import Pages
import Dashboard from './pages/admin/Dashboard';
import Home from './pages/user/Home';
import Login from './pages/auth/Login';

// Import Components
import RequireAuth from './components/RequireAuth'; 

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tuyến đường công khai: Đăng nhập */}
        <Route path="/login" element={<Login />} />

        {/* Tuyến đường cho khách xem phim */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        {/* CỤM TRANG ADMIN (Được bảo vệ bởi RequireAuth) */}
        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            {/* Tự động chuyển hướng từ /admin sang /admin/dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
            
            <Route path="dashboard" element={<Dashboard />} />
            {/* Nếu sau này có thêm trang quản lý phim, user... bạn cứ ném vào trong cụm này */}
          </Route>
        </Route>

        {/* Xử lý lỗi 404: Bất kỳ URL nào không tồn tại sẽ bị đá về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;