import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Sidebar quản trị, có thể thu gọn để tăng diện tích nội dung. */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* Cột phải chứa topbar và vùng nội dung thay đổi theo route con. */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Topbar sidebarCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(prev => !prev)} />

        {/* Outlet render trang admin hiện tại: dashboard, phim, phòng, lịch chiếu... */}
        <main
          style={{
            padding: '24px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
