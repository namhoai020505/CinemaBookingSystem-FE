import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`flex h-screen overflow-hidden font-['Urbanist'] transition-colors duration-300 ${
        isLightMode
          ? 'bg-slate-100 text-slate-950'
          : 'bg-[#070B14] text-white'
      }`}
    >
      <Sidebar collapsed={sidebarCollapsed} isLightMode={isLightMode} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          isLightMode={isLightMode}
          onToggle={toggleSidebar}
          onToggleTheme={toggleTheme}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet context={{ themeMode, isLightMode } satisfies AdminOutletContext} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;