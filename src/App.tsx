import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/admin/AdminLayout';
import UserLayout from './layouts/user/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import Home from './pages/user/Home';
import Login from './pages/auth/Login';
import RequireAuth from './components/RequireAuth'; 
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

        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
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