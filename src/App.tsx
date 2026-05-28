import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import Home from './pages/user/Home';
import Login from './pages/auth/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;