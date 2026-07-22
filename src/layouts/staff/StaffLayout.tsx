import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FaBarcode, FaBars, FaCashRegister, FaDoorOpen, FaMoon, FaPowerOff, FaShieldAlt, FaSun } from 'react-icons/fa';
import NotificationCenter from '../../components/NotificationCenter';
import { getCurrentUserProfile } from '../../lib/auth';
import { logout } from '../../services/authService';

export type StaffThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'g2c-staff-theme';

const staffRouteMeta: Record<string, { title: string; subtitle: string }> = {
  '/staff/ticket-scanner': {
    title: 'Ticket Scanner',
    subtitle: 'Scan QR tickets or enter ticket codes manually.',
  },
  '/staff/fb-counter': {
    title: 'Counter F&B',
    subtitle: 'Sell popcorn and drinks directly at the cinema counter.',
  },
};

const getInitialTheme = (): StaffThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

const StaffLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = getCurrentUserProfile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<StaffThemeMode>(getInitialTheme);
  const isLightMode = themeMode === 'light';
  const currentRouteMeta = staffRouteMeta[location.pathname] ?? staffRouteMeta['/staff/ticket-scanner'];

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.dataset.staffTheme = themeMode;
    document.documentElement.classList.toggle('light', isLightMode);
    document.documentElement.classList.toggle('dark', !isLightMode);
    document.body.classList.toggle('g2c-light-mode', isLightMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isLightMode, themeMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div
      className={`flex h-screen overflow-hidden font-['Urbanist'] transition-colors duration-300 ${
        isLightMode ? 'bg-slate-100 text-slate-950' : 'bg-[#07111E] text-white'
      }`}
    >
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden border-r transition-all duration-200 lg:relative lg:inset-auto lg:h-screen',
          isLightMode
            ? 'border-slate-200 bg-white shadow-[12px_0_34px_rgba(15,23,42,0.08)]'
            : 'border-white/10 bg-[#07111E] shadow-[12px_0_34px_rgba(0,0,0,0.34)]',
          sidebarCollapsed
            ? 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
            : 'w-72 translate-x-0',
        ].join(' ')}
      >
        <div className={`flex min-h-[72px] items-center gap-3 border-b px-5 ${
          isLightMode ? 'border-slate-200' : 'border-white/10'
        }`}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-700 text-white shadow-lg shadow-cyan-900/30">
            <FaShieldAlt />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className={`truncate text-[15px] font-black leading-tight ${
                isLightMode ? 'text-slate-900' : 'text-white'
              }`}>
                Staff Console
              </div>
              <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                isLightMode ? 'text-slate-500' : 'text-cyan-200/70'
              }`}>
                Ticket gate
              </div>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Staff navigation">
          {!sidebarCollapsed && (
            <div className={`px-2 pb-3 text-[10px] font-black uppercase tracking-[0.16em] ${
              isLightMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Operations
            </div>
          )}

          <NavLink
            to="/staff/ticket-scanner"
            title={sidebarCollapsed ? 'Ticket Scanner' : 'Scan tickets at the gate'}
            className={({ isActive }) =>
              [
                'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold no-underline transition-all duration-150',
                sidebarCollapsed ? 'justify-center' : 'justify-start',
                isActive
                  ? isLightMode
                    ? 'bg-emerald-50 text-emerald-600 shadow-[inset_3px_0_0_#10b981]'
                    : 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/10 text-white shadow-[inset_3px_0_0_#34d399]'
                  : isLightMode
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <span className="inline-flex shrink-0 text-base">
              <FaBarcode />
            </span>
            {!sidebarCollapsed && <span className="block truncate">Ticket Scanner</span>}
          </NavLink>

          <NavLink
            to="/staff/fb-counter"
            title={sidebarCollapsed ? 'Counter F&B' : 'Sell F&B at the counter'}
            className={({ isActive }) =>
              [
                'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold no-underline transition-all duration-150',
                sidebarCollapsed ? 'justify-center' : 'justify-start',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/10 text-white shadow-[inset_3px_0_0_#34d399]'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <span className="inline-flex shrink-0 text-base">
              <FaCashRegister />
            </span>
            {!sidebarCollapsed && <span className="block truncate">Bán F&B</span>}
          </NavLink>
        </nav>

        <div className={`shrink-0 border-t p-3 ${
          isLightMode ? 'border-slate-200' : 'border-white/10'
        }`}>
          <div className={`flex items-center gap-3 rounded-lg border p-2.5 ${
            isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]'
          }`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
              <FaDoorOpen />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className={`truncate text-sm font-black ${
                  isLightMode ? 'text-slate-900' : 'text-white'
                }`}>Staff</div>
                <div className={`mt-0.5 text-[11px] font-bold ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Ticket operations
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={[
            'sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-4 border-b px-5 backdrop-blur-xl transition-colors',
            isLightMode
              ? 'border-slate-200 bg-white/90 text-slate-950'
              : 'border-white/10 bg-[#0B1220]/90 text-white',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={[
              'grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition',
              isLightMode
                ? 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-white',
            ].join(' ')}
            title={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
          >
            <FaBars />
          </button>

          <div className="min-w-0">
            <strong className="block truncate text-base font-black">{currentRouteMeta.title}</strong>
            <span className={`mt-0.5 hidden truncate text-xs font-semibold sm:block ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {currentRouteMeta.subtitle}
            </span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <NotificationCenter
              isLightMode={isLightMode}
              buttonClassName={[
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition',
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-white',
              ].join(' ')}
            />

            <button
              type="button"
              onClick={() => setThemeMode((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label={isLightMode ? 'Dark mode' : 'Light mode'}
              className={[
                'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black uppercase tracking-wide transition',
                isLightMode
                  ? 'border-slate-200 bg-slate-950 text-white hover:bg-slate-800'
                  : 'border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20',
              ].join(' ')}
            >
              {isLightMode ? <FaMoon /> : <FaSun />}
              <span className="hidden sm:inline">{isLightMode ? 'Dark' : 'Light'}</span>
            </button>

            <div
              className={[
                'hidden min-h-10 items-center gap-2 rounded-lg border px-2 py-1 no-underline transition lg:flex',
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-950 hover:border-emerald-200'
                  : 'border-white/10 bg-white/5 text-white hover:border-emerald-400/40',
              ].join(' ')}
              title="Profile"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-xs font-black text-white">
                {(profile?.fullName || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="max-w-32 truncate text-xs font-black">{profile?.fullName || 'Staff'}</div>
                <div className={`text-[10px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {profile?.role || 'STAFF'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className={[
                'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black transition',
                isLightMode
                  ? 'border-red-100 bg-red-50 text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white'
                  : 'border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-600 hover:text-white',
              ].join(' ')}
            >
              <FaPowerOff />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet context={{ themeMode, isLightMode }} />
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
