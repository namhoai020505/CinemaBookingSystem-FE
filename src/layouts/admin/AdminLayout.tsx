import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Cột trái: Sidebar */}
      <Sidebar />

      {/* Cột phải: Topbar + Nội dung trang */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar />
        
        {/* Khu vực thay đổi nội dung (Dashboard, Movies, v.v. sẽ render ở đây) */}
        <div style={{ padding: '20px', background: '#fff', flex: 1 }}>
          <Outlet /> 
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;