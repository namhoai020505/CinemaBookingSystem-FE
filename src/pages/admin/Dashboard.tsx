import { Link, useOutletContext } from 'react-router-dom';
import {
  FaArrowRight,
  FaCalendarAlt,
  FaComments,
  FaDatabase,
  FaFilm,
  FaServer,
  FaTicketAlt,
  FaUsersCog,
} from 'react-icons/fa';
import type { AdminOutletContext } from '../../layouts/admin/AdminLayout';

const kpis = [
  {
    label: 'Movies',
    value: 'Catalog',
    meta: 'Quản lý phim đang bán vé',
    icon: <FaFilm />,
    iconClass: 'from-blue-600 to-cyan-500',
  },
  {
    label: 'Showtimes',
    value: 'Timeline',
    meta: 'Kéo thả suất chiếu trực quan',
    icon: <FaCalendarAlt />,
    iconClass: 'from-violet-600 to-blue-600',
  },
  {
    label: 'Tickets',
    value: 'Live Ops',
    meta: 'Ghế, booking và thanh toán',
    icon: <FaTicketAlt />,
    iconClass: 'from-emerald-600 to-cyan-600',
  },
  {
    label: 'Moderation',
    value: 'Queue',
    meta: 'Duyệt review cần xử lý',
    icon: <FaComments />,
    iconClass: 'from-amber-600 to-red-600',
  },
];

const quickActions = [
  {
    to: '/admin/movies',
    title: 'Cập nhật catalog phim',
    description: 'Thêm phim mới, trailer, thời lượng và thông tin hiển thị.',
  },
  {
    to: '/admin/showtime',
    title: 'Điều phối lịch chiếu',
    description: 'Sắp xếp timeline theo rạp, phòng và ngày vận hành.',
  },
  {
    to: '/admin/rooms',
    title: 'Kiểm tra phòng chiếu',
    description: 'Quản lý room status, sức chứa và đi tới sơ đồ ghế.',
  },
  {
    to: '/admin/staff',
    title: 'Mời nhân viên mới',
    description: 'Tạo tài khoản staff và gửi email thiết lập mật khẩu.',
  },
];

const healthItems = [
  ['API gateway', 'Ready'],
  ['Database', 'Connected'],
  ['Seat lock store', 'Active'],
  ['Payment webhook', 'Listening'],
];

export default function Dashboard() {
  const { isLightMode } = useOutletContext<AdminOutletContext>();

  const cardClass = [
    'rounded-lg border shadow-xl transition-colors',
    isLightMode
      ? 'border-slate-200 bg-white shadow-slate-200/70'
      : 'border-white/10 bg-[#111C44] shadow-black/20',
  ].join(' ');

  const mutedClass = isLightMode ? 'text-slate-500' : 'text-slate-400';
  const headingClass = isLightMode ? 'text-slate-950' : 'text-white';
  const rowBorderClass = isLightMode ? 'border-slate-200' : 'border-white/10';

  return (
    <div
      className={[
        'min-h-screen p-6 transition-colors',
        isLightMode ? 'bg-slate-100 text-slate-950' : 'bg-[#0A0A0C] text-white',
      ].join(' ')}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">
              Cinema operations
            </div>
            <h1 className={`mt-2 text-3xl font-black leading-tight lg:text-4xl ${headingClass}`}>
              Admin Dashboard
            </h1>
            <p className={`mt-3 max-w-3xl text-sm leading-6 ${mutedClass}`}>
              Một màn tổng quan gọn cho các tác vụ vận hành hằng ngày: phim, phòng,
              lịch chiếu, nhân sự và kiểm duyệt nội dung.
            </p>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <article className={`${cardClass} p-5`} key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <div className={`text-[11px] font-black uppercase tracking-[0.12em] ${mutedClass}`}>
                  {item.label}
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${item.iconClass} text-white shadow-lg`}>
                  {item.icon}
                </div>
              </div>
              <div className={`mt-5 text-3xl font-black ${headingClass}`}>{item.value}</div>
              <div className={`mt-2 text-xs font-bold ${mutedClass}`}>{item.meta}</div>
            </article>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className={cardClass}>
            <div className={`flex items-center justify-between gap-4 border-b p-5 ${rowBorderClass}`}>
              <div>
                <div className={`text-base font-black ${headingClass}`}>Quick actions</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  Các luồng thao tác admin hay dùng nhất.
                </div>
              </div>
              <FaServer className="text-blue-500" />
            </div>

            <div className="grid gap-3 p-5">
              {quickActions.map((item) => (
                <Link
                  to={item.to}
                  className={[
                    'flex min-h-[64px] items-center justify-between gap-4 rounded-lg border p-4 no-underline transition hover:-translate-y-0.5',
                    isLightMode
                      ? 'border-slate-200 bg-white text-slate-950 hover:border-blue-200 hover:bg-blue-50'
                      : 'border-white/10 bg-white/[0.03] text-white hover:border-blue-400/30 hover:bg-blue-500/10',
                  ].join(' ')}
                  key={item.to}
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-black">{item.title}</strong>
                    <span className={`mt-1 block text-xs leading-5 ${mutedClass}`}>
                      {item.description}
                    </span>
                  </div>
                  <FaArrowRight className="shrink-0 text-blue-500" />
                </Link>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <div className={`flex items-center justify-between gap-4 border-b p-5 ${rowBorderClass}`}>
              <div>
                <div className={`text-base font-black ${headingClass}`}>System health</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  Trạng thái tham chiếu cho môi trường hiện tại.
                </div>
              </div>
              <FaDatabase className="text-emerald-500" />
            </div>

            <div className="p-5">
              {healthItems.map(([label, value]) => (
                <div
                  className={`flex items-center justify-between gap-3 border-b py-3 last:border-b-0 ${rowBorderClass}`}
                  key={label}
                >
                  <div>
                    <strong className={`text-sm font-black ${headingClass}`}>{label}</strong>
                    <p className={`mt-1 text-xs font-semibold ${mutedClass}`}>{value}</p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
                </div>
              ))}

              <Link
                to="/admin/reviews"
                className={[
                  'mt-4 flex min-h-[64px] items-center justify-between gap-4 rounded-lg border p-4 no-underline transition hover:-translate-y-0.5',
                  isLightMode
                    ? 'border-slate-200 bg-white text-slate-950 hover:border-blue-200 hover:bg-blue-50'
                    : 'border-white/10 bg-white/[0.03] text-white hover:border-blue-400/30 hover:bg-blue-500/10',
                ].join(' ')}
              >
                <div>
                  <strong className="block text-sm font-black">Review queue</strong>
                  <span className={`mt-1 block text-xs leading-5 ${mutedClass}`}>
                    Xử lý nội dung người dùng cần kiểm duyệt.
                  </span>
                </div>
                <FaUsersCog className="text-blue-500" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
