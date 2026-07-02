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
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">{TEXT.DASHBOARD.TITLE}</h1>
      <p className="mt-4 text-gray-600">{TEXT.DASHBOARD.SUBTITLE}</p>
    </div>
  );
}