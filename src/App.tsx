import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/admin/AdminLayout';
import UserLayout from './layouts/user/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import Home from './pages/user/Home';
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';
import RequireAuth from './components/RequireAuth'; 
import ManageMovie from './pages/admin/ManageMovie';
import ManageShowtime from './pages/admin/ManageShowtime';
import ManageStaff from './pages/admin/ManageStaff';
import { useIdleTimeout } from './hooks/useIdleTimeout';

const GlobalTimer = () => {
  useIdleTimeout(10); 
  return null;
};

function App() {
  return (
    <BrowserRouter>
    
      {/* 2. Đặt nó ở ĐÂY - bên trong BrowserRouter */}
      <GlobalTimer /> 

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/staff/set-password" element={<StaffSetPassword />} />

        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="movies" element={<ManageMovie />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="showtime" element={<ManageShowtime />} />
            <Route path="staff" element={<ManageStaff />} />
            {/* Nếu sau này có thêm trang quản lý phim, user... bạn cứ ném vào trong cụm này */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
