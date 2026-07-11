import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import ManagerSidebar from './ManagerSidebar';
import ManagerTopbar from './ManagerTopbar';

export type ManagerThemeMode = 'dark' | 'light';

export type ManagerOutletContext = {
  themeMode: ManagerThemeMode;
  isLightMode: boolean;
};

const THEME_STORAGE_KEY = 'g2c-manager-theme';

const getInitialTheme = (): ManagerThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

const ManagerLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ManagerThemeMode>(getInitialTheme);
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    document.documentElement.dataset.managerTheme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  const toggleSidebar = () => setSidebarCollapsed((current) => !current);
  const toggleTheme = () => {
    setThemeMode((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <div
      className={`flex h-screen overflow-hidden font-['Urbanist'] transition-colors duration-300 ${
        isLightMode ? 'bg-slate-100 text-slate-950' : 'bg-[#07111E] text-white'
      }`}
    >
      <ManagerSidebar collapsed={sidebarCollapsed} isLightMode={isLightMode} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ManagerTopbar
          sidebarCollapsed={sidebarCollapsed}
          isLightMode={isLightMode}
          onToggleSidebar={toggleSidebar}
          onToggleTheme={toggleTheme}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet context={{ themeMode, isLightMode } satisfies ManagerOutletContext} />
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
