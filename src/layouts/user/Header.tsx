import { useEffect, useState } from 'react';
import { FiChevronDown, FiMoon, FiSun } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { getAccessToken } from '../../lib/auth';
import { logout } from '../../services/authService';

type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'g2c-theme';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

export default function Header() {
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const token = getAccessToken();
  const hasValidToken = Boolean(token);
  const fullName = localStorage.getItem('fullName');
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('light', isLightMode);
    document.body.classList.toggle('g2c-light-mode', isLightMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isLightMode, themeMode]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleToggleTheme = () => {
    setThemeMode((currentMode) => (currentMode === 'light' ? 'dark' : 'light'));
  };

  const linkHoverClass = isLightMode ? 'hover:text-[#1E293B]' : 'hover:text-white';
  const dividerClass = isLightMode ? 'text-slate-400' : 'text-gray-600';
  const menuTextClass = isLightMode ? 'text-slate-800' : 'text-white';

  const themeToggle = (
    <button
      type="button"
      onClick={handleToggleTheme}
      aria-label={isLightMode ? 'Chuyển sang dark mode' : 'Chuyển sang light mode'}
      title={isLightMode ? 'Dark mode' : 'Light mode'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-black transition ${
        isLightMode
          ? 'border-[#FFD166] bg-[#FFD166] text-[#1E293B] hover:brightness-105'
          : 'border-white/25 bg-white/10 text-[#FFD166] hover:bg-white/15'
      }`}
    >
      {isLightMode ? <FiMoon size={14} /> : <FiSun size={14} />}
      <span>{isLightMode ? 'Dark' : 'Light'}</span>
    </button>
  );

  return (
    <header className="fixed left-0 top-0 z-50 w-full shadow-lg">
      <div
        className={`g2c-topbar py-1.5 transition-colors ${
          isLightMode ? 'bg-[#E2E8F0] text-[#1E293B]' : 'bg-[#0F172A] text-gray-300'
        }`}
      >
        <div className="container mx-auto flex justify-end px-4 text-[13px]">
          {hasValidToken ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className={`transition ${linkHoverClass}`}>
                Chào, {fullName || 'Thành viên'}
              </Link>
              <span className={dividerClass}>|</span>
              <Link
                to="/my-bookings"
                className={`font-medium transition ${linkHoverClass}`}
              >
                Vé của tôi
              </Link>
              <span className={dividerClass}>|</span>
              <button
                type="button"
                onClick={handleLogout}
                className={`font-medium transition ${linkHoverClass}`}
              >
                Đăng xuất
              </button>
              <span className={dividerClass}>|</span>
              {themeToggle}
            </div>
          ) : (
            <div className="flex items-center gap-3 font-medium">
              <Link to="/login" state={{ mode: 'login' }} className={`transition ${linkHoverClass}`}>
                Đăng nhập
              </Link>
              <span className={dividerClass}>|</span>
              <Link to="/login" state={{ mode: 'register' }} className={`transition ${linkHoverClass}`}>
                Đăng ký
              </Link>
              <span className={dividerClass}>|</span>
              {themeToggle}
            </div>
          )}
        </div>
      </div>

      <div
        className={`border-b py-3 transition-colors ${
          isLightMode ? 'border-[#CBD5E1] bg-white' : 'border-[#474747] bg-[#1E293B]'
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="flex items-center">
              <img src={logo} alt="G2C Logo" className="h-10 object-contain" />
            </Link>

            <button
              className={`hidden items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition sm:flex ${
                isLightMode
                  ? 'border-[#CBD5E1] text-[#1E293B] hover:bg-[#F8FAFC]'
                  : 'border-white text-white hover:bg-white/10'
              }`}
            >
              <span>G2Cinema Thái Nguyên</span>
              <FiChevronDown size={18} />
            </button>
          </div>

          <nav
            className={`hidden items-center gap-7 text-sm font-bold tracking-wide lg:flex ${menuTextClass}`}
          >
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="transition hover:text-[#FFD166]">
              GIÁ VÉ
            </Link>
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="transition hover:text-[#FFD166]">
              PHIM
            </Link>
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="transition hover:text-[#FFD166]">
              RẠP
            </Link>
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="transition hover:text-[#FFD166]">
              LỊCH CHIẾU THEO RẠP
            </Link>
            <Link to="/profile" className="transition hover:text-[#FFD166]">
              THÀNH VIÊN
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
