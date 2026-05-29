import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import Home from './pages/user/Home';
import Login from './pages/auth/Login';
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

        {/* 2. BỌC REQUIRE_AUTH Ở ĐÂY ĐỂ BẢO VỆ TOÀN BỘ TRANG ADMIN */}
        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            {/* Nếu sau này có thêm trang quản lý phim, user... bạn cứ ném vào trong cụm này */}
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;