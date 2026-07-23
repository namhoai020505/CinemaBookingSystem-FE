import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import RequireAuth from './components/RequireAuth';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import AdminLayout from './layouts/admin/AdminLayout';
import ManagerLayout from './layouts/manager/ManagerLayout';
import StaffLayout from './layouts/staff/StaffLayout';
import UserLayout from './layouts/user/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import ManageBanner from './pages/admin/ManageBanner';
import ManageMovie from './pages/admin/ManageMovie';
import ManageRooms from './pages/admin/ManageRooms';
import ManageSeatLayout from './pages/admin/ManageSeatLayout';
import ManageShowtime from './pages/admin/ManageShowtime';
import ManageStaff from './pages/admin/ManageStaff';
import ManageVouchers from './pages/admin/ManageVouchers';
import ManageRefunds from './pages/admin/ManageRefunds';
import ReviewModeration from './pages/admin/ReviewModeration';
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import ManagerRefundsPage from './pages/manager/ManagerRefundsPage';
import ManagerShowtimesPage from './pages/manager/ManagerShowtimesPage';
import MyCinemaPage from './pages/manager/MyCinemaPage';
import TicketScannerPage from './pages/manager/TicketScannerPage';
import CounterFbSalesPage from './pages/staff/CounterFbSalesPage';
import StaffTicketScannerPage from './pages/staff/StaffTicketScannerPage';
import BookingSuccess from './pages/user/BookingSuccess';
import Checkout from './pages/user/Checkout';
import Cinemas from './pages/user/Cinemas';
import CinemaSchedule from './pages/user/CinemaSchedule';
import Home from './pages/user/Home';
import MovieShowtimes from './pages/user/MovieShowtimes';
import Movies from './pages/user/Movies';
import MyBookings from './pages/user/MyBookings';
import MyVouchers from './pages/user/MyVouchers';
import Profile from './pages/user/Profile';
import RefundClaimPage from './pages/user/RefundClaimPage';
import SeatSelection from './pages/user/SeatSelection';
import TicketPrices from './pages/user/TicketPrices';
import VnpayReturn from './pages/user/VnpayReturn';
import ConfirmTimeChangePage from './pages/user/ConfirmTimeChangePage';

const customerRoles = ['customer'];
const adminRoles = ['admin'];
const managerRoles = ['manager'];
const staffRoles = ['staff'];

const RootLayout = () => {
  useIdleTimeout(10);
  return <Outlet />;
};

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/staff/set-password', element: <StaffSetPassword /> },
      {
        element: <UserLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/ticket-prices', element: <TicketPrices /> },
          { path: '/cinemas', element: <Cinemas /> },
          { path: '/cinema-schedule', element: <CinemaSchedule /> },
          { path: '/movies', element: <Movies /> },
          { path: '/movie/:movieId/showtimes', element: <MovieShowtimes /> },
          { path: '/booking/confirm-time-change', element: <ConfirmTimeChangePage /> },
          {
            element: <RequireAuth allowedRoles={customerRoles} />,
            children: [
              { path: '/booking/seats/:showtimeId', element: <SeatSelection /> },
              { path: '/booking/checkout/:showtimeId', element: <Checkout /> },
              { path: '/vnpay-return', element: <VnpayReturn /> },
              { path: '/booking/success/:bookingId', element: <BookingSuccess /> },
              { path: '/my-bookings', element: <MyBookings /> },
              { path: '/my-vouchers', element: <MyVouchers /> },
              { path: '/profile', element: <Profile /> },
              { path: '/refund-claim', element: <RefundClaimPage /> },
              { path: '/refunds/claim', element: <RefundClaimPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth allowedRoles={adminRoles} verifyAdmin />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <Dashboard /> },
              { path: 'movies', element: <ManageMovie /> },
              { path: 'showtime', element: <ManageShowtime /> },
              { path: 'staff', element: <ManageStaff /> },
              { path: 'rooms', element: <ManageRooms /> },
              { path: 'rooms/:roomId/seats', element: <ManageSeatLayout /> },
              { path: 'review', element: <ReviewModeration /> },
              { path: 'vouchers', element: <ManageVouchers /> },
              { path: 'banners', element: <ManageBanner /> },
              { path: 'refunds', element: <ManageRefunds /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth allowedRoles={managerRoles} />,
        children: [
          {
            path: '/manager',
            element: <ManagerLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <ManagerDashboardPage /> },
              { path: 'showtimes', element: <ManagerShowtimesPage /> },
              { path: 'refunds', element: <ManagerRefundsPage /> },
              { path: 'ticket-scanner', element: <TicketScannerPage /> },
              { path: 'vouchers', element: <ManageVouchers /> },
              { path: 'banners', element: <ManageBanner /> },
              { path: 'my-cinema', element: <MyCinemaPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth allowedRoles={staffRoles} />,
        children: [
          {
            path: '/staff',
            element: <StaffLayout />,
            children: [
              { index: true, element: <Navigate to="ticket-scanner" replace /> },
              { path: 'ticket-scanner', element: <StaffTicketScannerPage /> },
              { path: 'fb-counter', element: <CounterFbSalesPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
