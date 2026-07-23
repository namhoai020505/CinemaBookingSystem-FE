import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { FiCheck, FiChevronDown, FiMapPin, FiMoon, FiSun } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import NotificationCenter from '../../components/NotificationCenter';
import logo from '../../assets/logo.png';
import { AUTH_SESSION_EVENT, getAccessToken, getAuthFullName } from '../../lib/auth';
import {
  readSelectedCinemaId,
  writeSelectedCinemaId,
} from '../../lib/cinemaSelection';
import { logout } from '../../services/authService';
import {
  showtimeService,
  type CinemaResponse,
} from '../../services/showtimeService';

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
  const [activeCinemas, setActiveCinemas] = useState<CinemaResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [isCinemaDropdownOpen, setIsCinemaDropdownOpen] = useState(false);
  const [, setAuthVersion] = useState(0);
  const cinemaDropdownRef = useRef<HTMLDivElement>(null);
  const token = getAccessToken();
  const hasValidToken = Boolean(token);
  const fullName = getAuthFullName();
  const isLightMode = themeMode === 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('light', isLightMode);
    document.documentElement.classList.toggle('dark', !isLightMode);
    document.body.classList.toggle('g2c-light-mode', isLightMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isLightMode, themeMode]);

  useEffect(() => {
    const handleAuthSessionChange = () => {
      setAuthVersion((current) => current + 1);
    };

    window.addEventListener(AUTH_SESSION_EVENT, handleAuthSessionChange);

    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, handleAuthSessionChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      const fetchActiveCinemas = async () => {
        try {
          const cinemas = await showtimeService.getCinemas();
          const activeItems = cinemas.filter(
            (cinema) => cinema.cinemaStatus?.toUpperCase() === 'ACTIVE',
          );

          if (!isMounted) {
            return;
          }

          setActiveCinemas(activeItems);

          const storedCinemaId = readSelectedCinemaId();
          const nextCinemaId = activeItems.some(
            (cinema) => cinema.cinemaId === storedCinemaId,
          )
            ? storedCinemaId
            : activeItems[0]?.cinemaId || '';

          setSelectedCinemaId(nextCinemaId);

          if (nextCinemaId !== storedCinemaId) {
            writeSelectedCinemaId(nextCinemaId);
          }
        } catch (error) {
          console.error('Không tải được danh sách rạp hoạt động:', error);

          if (isMounted) {
            setActiveCinemas([]);
          }
        }
      };

      void fetchActiveCinemas();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        cinemaDropdownRef.current &&
        !cinemaDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCinemaDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

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
  const selectedCinema = activeCinemas.find(
    (cinema) => cinema.cinemaId === selectedCinemaId,
  );
  const selectedCinemaLabel =
    selectedCinema?.cinemaName || activeCinemas[0]?.cinemaName || 'G2Cinema Thái Nguyên';
  const getCinemaLocation = (cinema: CinemaResponse) =>
    [cinema.address, cinema.city].filter(Boolean).join(' - ') || 'Địa chỉ đang cập nhật';

  const handleSelectCinema = (cinema: CinemaResponse) => {
    setSelectedCinemaId(cinema.cinemaId);
    writeSelectedCinemaId(cinema.cinemaId);
    setIsCinemaDropdownOpen(false);
    sessionStorage.removeItem('home-scroll-y');
  };

  const handleCinemaDropdownKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setIsCinemaDropdownOpen(false);
    }
  };

  const themeToggle = (
    <button
      type="button"
      onClick={handleToggleTheme}
      aria-label={isLightMode ? 'Chuyển sang dark mode' : 'Chuyển sang light mode'}
      title={isLightMode ? 'Dark mode' : 'Light mode'}
      className={`g2c-topbar-control inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-black transition ${
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
        className="g2c-topbar g2c-metallic-topbar hidden py-1.5 text-[#1A1305] md:block"
      >
        <div className="container mx-auto flex justify-end px-4 text-[13px]">
          {hasValidToken ? (
            <div className="g2c-topbar-actions flex items-center gap-3">
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
              <Link
                to="/my-vouchers"
                className={`font-medium transition ${linkHoverClass}`}
              >
                Ưu đãi của tôi
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
              <NotificationCenter
                isLightMode={isLightMode}
                buttonClassName={`g2c-topbar-control grid h-8 w-8 place-items-center rounded-full border text-[12px] transition ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-[#FFD166] hover:text-[#B45309]'
                    : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                }`}
              />
              {themeToggle}
            </div>
          ) : (
            <div className="g2c-topbar-actions flex items-center gap-3 font-medium">
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
        className={`border-b py-2 transition-colors md:py-3 ${
          isLightMode ? 'border-[#CBD5E1] bg-white' : 'border-[#474747] bg-[#1E293B]'
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:gap-6">
            <Link to="/" onClick={() => sessionStorage.removeItem('home-scroll-y')} className="flex items-center">
              <img src={logo} alt="G2C Logo" className="h-9 object-contain md:h-10" />
            </Link>

            <div
              className="relative min-w-0 flex-1 sm:w-[320px] sm:max-w-[34vw] lg:flex-none"
              ref={cinemaDropdownRef}
              onKeyDown={handleCinemaDropdownKeyDown}
            >
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isCinemaDropdownOpen}
                onClick={() => setIsCinemaDropdownOpen((current) => !current)}
                className={`group flex h-11 w-full cursor-pointer items-center justify-between gap-2 border px-3 text-left text-sm font-semibold shadow-sm transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] focus-visible:ring-offset-2 md:h-12 md:gap-3 md:px-4 ${
                  isCinemaDropdownOpen
                    ? 'rounded-t-[22px] rounded-b-none border-b-transparent md:rounded-t-[24px]'
                    : 'rounded-full'
                } ${
                  isLightMode
                    ? isCinemaDropdownOpen
                      ? 'border-slate-200 bg-white/95 text-[#0F172A] shadow-slate-900/10 hover:bg-white focus-visible:ring-offset-white'
                      : 'border-[#CBD5E1] bg-white text-[#0F172A] shadow-slate-900/5 hover:border-[#FFD166] hover:bg-[#F8FAFC] focus-visible:ring-offset-white'
                    : isCinemaDropdownOpen
                      ? 'border-[#252C38] bg-black text-white shadow-black/30 hover:bg-black focus-visible:ring-offset-black'
                      : 'border-[#252C38] bg-black text-white shadow-black/20 hover:border-[#FFD166] hover:bg-black focus-visible:ring-offset-black'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isLightMode
                      ? 'bg-[#FFF3C4] text-[#A16207]'
                      : 'bg-[#FFD166]/15 text-[#FFD166]'
                  }`}
                >
                  <FiMapPin size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`hidden text-[10px] font-black uppercase leading-3 tracking-[0.16em] sm:block ${
                      isLightMode ? 'text-slate-500' : 'text-white/45'
                    }`}
                  >
                    Cơ sở
                  </span>
                  <span className="block truncate leading-5">{selectedCinemaLabel}</span>
                </span>
                <FiChevronDown
                  size={18}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                    isCinemaDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isCinemaDropdownOpen ? (
                <div
                  role="listbox"
                  aria-label="Chọn cơ sở rạp"
                  className={`absolute left-0 top-full z-50 -mt-px w-full overflow-hidden rounded-b-2xl rounded-t-none border border-t-0 p-2 shadow-2xl backdrop-blur-xl ${
                    isLightMode
                      ? 'border-slate-200 bg-white/95 text-slate-900 shadow-slate-900/15'
                      : 'border-[#252C38] bg-black text-white shadow-black/45'
                  }`}
                >
                  <div
                    className={`mb-1 flex items-center justify-between px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] ${
                      isLightMode ? 'text-slate-500' : 'text-white/45'
                    }`}
                  >
                    <span>Chọn cơ sở</span>
                    <span>{activeCinemas.length} rạp</span>
                  </div>

                  {activeCinemas.length === 0 ? (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        isLightMode
                          ? 'border-slate-200 bg-slate-50 text-slate-500'
                          : 'border-white/10 bg-white/[0.05] text-white/55'
                      }`}
                    >
                      Chưa có rạp đang hoạt động
                    </div>
                  ) : (
                    <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
                      {activeCinemas.map((cinema) => {
                        const isSelected = cinema.cinemaId === selectedCinemaId;
                        const cinemaLocation = getCinemaLocation(cinema);

                        return (
                          <button
                            key={cinema.cinemaId}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectCinema(cinema)}
                            className={`flex min-h-[64px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                              isSelected
                                ? isLightMode
                                  ? 'border-[#FFD166] bg-[#FFF7D6] text-[#0F172A]'
                                  : 'border-[#FFD166]/70 bg-[#FFD166]/14 text-white'
                                : isLightMode
                                  ? 'border-transparent text-slate-800 hover:border-slate-200 hover:bg-slate-50'
                                  : 'border-transparent text-white hover:border-white/15 hover:bg-white/[0.08]'
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                isSelected
                                  ? 'bg-[#FFD166] text-[#111827]'
                                  : isLightMode
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-white/10 text-white/55'
                              }`}
                            >
                              {isSelected ? (
                                <FiCheck size={17} aria-hidden="true" />
                              ) : (
                                <FiMapPin size={17} aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black">
                                {cinema.cinemaName}
                              </span>
                              <span
                                className={`block truncate text-xs leading-5 ${
                                  isSelected
                                    ? isLightMode
                                      ? 'text-slate-600'
                                      : 'text-white/70'
                                    : isLightMode
                                      ? 'text-slate-500'
                                      : 'text-white/50'
                                }`}
                                title={cinemaLocation}
                              >
                                {cinemaLocation}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <nav
            className={`hidden items-center gap-7 text-sm font-bold tracking-wide lg:flex ${menuTextClass}`}
          >
            <Link to="/ticket-prices" className="transition hover:text-[#FFD166]">
              GIÁ VÉ
            </Link>
            <Link to="/movies" className="transition hover:text-[#FFD166]">
              PHIM
            </Link>
            <Link to="/cinemas" className="transition hover:text-[#FFD166]">
              RẠP
            </Link>
            <Link to="/cinema-schedule" className="transition hover:text-[#FFD166]">
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
