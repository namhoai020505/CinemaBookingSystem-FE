import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export type ThemeMode = 'dark' | 'light';

export type AdminOutletContext = {
  themeMode: ThemeMode;
  isLightMode: boolean;
};

const THEME_STORAGE_KEY = 'g2c-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('light', isLightMode);
    document.body.classList.toggle('g2c-light-mode', isLightMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isLightMode, themeMode]);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);
  const toggleTheme = () => {
    setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <div
      className={`flex min-h-screen font-['Urbanist'] transition-colors duration-300 ${
        isLightMode
          ? 'bg-slate-100 text-slate-950'
          : 'bg-[#070B14] text-white'
      }`}
    >
      <Sidebar collapsed={sidebarCollapsed} isLightMode={isLightMode} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          isLightMode={isLightMode}
          onToggle={toggleSidebar}
          onToggleTheme={toggleTheme}
        />

        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet context={{ themeMode, isLightMode } satisfies AdminOutletContext} />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
