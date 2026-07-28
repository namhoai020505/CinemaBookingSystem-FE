import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import ConfirmDialogHost from './components/ConfirmDialogHost';
import RequireAuth from './components/RequireAuth';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useMultiTabSecurity } from './hooks/useMultiTabSecurity';
import { useSessionHeartbeat } from './lib/sessionHeartbeat';

// Layouts — loaded eagerly (small, always needed)
import AdminLayout from './layouts/admin/AdminLayout';
import ManagerLayout from './layouts/manager/ManagerLayout';
import StaffLayout from './layouts/staff/StaffLayout';
import UserLayout from './layouts/user/UserLayout';

// Auth pages — loaded eagerly (entry point)
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';

// User pages — lazy loaded per route
const Home = lazy(() => import('./pages/user/Home'));
const TicketPrices = lazy(() => import('./pages/user/TicketPrices'));
const Cinemas = lazy(() => import('./pages/user/Cinemas'));
const CinemaSchedule = lazy(() => import('./pages/user/CinemaSchedule'));
const Movies = lazy(() => import('./pages/user/Movies'));
const MovieShowtimes = lazy(() => import('./pages/user/MovieShowtimes'));
const VnpayReturn = lazy(() => import('./pages/user/VnpayReturn'));
const SeatSelection = lazy(() => import('./pages/user/SeatSelection'));
const ConfirmTimeChangePage = lazy(() => import('./pages/user/ConfirmTimeChangePage'));
const Checkout = lazy(() => import('./pages/user/Checkout'));
const BookingSuccess = lazy(() => import('./pages/user/BookingSuccess'));
const MyBookings = lazy(() => import('./pages/user/MyBookings'));
const MyVouchers = lazy(() => import('./pages/user/MyVouchers'));
const Profile = lazy(() => import('./pages/user/Profile'));
const RefundClaimPage = lazy(() => import('./pages/user/RefundClaimPage'));

// Admin pages — lazy loaded (only admins access these)
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageBanner = lazy(() => import('./pages/admin/ManageBanner'));
const ManageCinemas = lazy(() => import('./pages/admin/ManageCinemas'));
const ManageFbItems = lazy(() => import('./pages/admin/ManageFbItems'));
const ManageMovie = lazy(() => import('./pages/admin/ManageMovie'));
const ManageRefunds = lazy(() => import('./pages/admin/ManageRefunds'));
const ManageRooms = lazy(() => import('./pages/admin/ManageRooms'));
const ManageSeatLayout = lazy(() => import('./pages/admin/ManageSeatLayout'));
const ManageShowtime = lazy(() => import('./pages/admin/ManageShowtime'));
const ManageStaff = lazy(() => import('./pages/admin/ManageStaff'));
const ManageVouchers = lazy(() => import('./pages/admin/ManageVouchers'));
const ManageNotifications = lazy(() => import('./pages/admin/ManageNotifications'));
const ReviewModeration = lazy(() => import('./pages/admin/ReviewModeration'));

// Manager pages — lazy loaded
const ManagerDashboardPage = lazy(() => import('./pages/manager/ManagerDashboardPage'));
const ManagerRefundsPage = lazy(() => import('./pages/manager/ManagerRefundsPage'));
const ManagerShowtimesPage = lazy(() => import('./pages/manager/ManagerShowtimesPage'));
const ManagerStaffPage = lazy(() => import('./pages/manager/ManagerStaffPage'));
const MyCinemaPage = lazy(() => import('./pages/manager/MyCinemaPage'));
const TicketScannerPage = lazy(() => import('./pages/manager/TicketScannerPage'));

// Staff pages — lazy loaded
const CounterFbSalesPage = lazy(() => import('./pages/staff/CounterFbSalesPage'));
const StaffSchedulePage = lazy(() => import('./pages/staff/StaffSchedulePage'));
const StaffTicketScannerPage = lazy(() => import('./pages/staff/StaffTicketScannerPage'));

// Fallback spinner while lazy chunks are loading
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const customerRoles = ['customer'];
const adminRoles = ['admin'];
const managerRoles = ['manager'];
const staffRoles = ['staff'];

const RootLayout = () => {
  useIdleTimeout(10);
  useMultiTabSecurity();
  useSessionHeartbeat();
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
          { path: '/vnpay-return', element: <VnpayReturn /> },
          { path: '/booking/seats/:showtimeId', element: <SeatSelection /> },
          { path: '/booking/confirm-time-change', element: <ConfirmTimeChangePage /> },
          {
            element: <RequireAuth allowedRoles={customerRoles} />,
            children: [
              { path: '/booking/seats/:showtimeId', element: <SeatSelection /> },
              { path: '/booking/checkout/:showtimeId', element: <Checkout /> },
              { path: '/booking/success/:bookingId', element: <BookingSuccess /> },
              { path: '/my-bookings', element: <MyBookings /> },
              { path: '/my-vouchers', element: <MyVouchers /> },
              { path: 'profile', element: <Profile /> },
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
              { path: 'cinemas', element: <ManageCinemas /> },
              { path: 'fb-items', element: <ManageFbItems /> },
              { path: 'movies', element: <ManageMovie /> },
              { path: 'showtime', element: <ManageShowtime /> },
              { path: 'staff', element: <ManageStaff /> },
              { path: 'rooms', element: <ManageRooms /> },
              { path: 'rooms/:roomId/seats', element: <ManageSeatLayout /> },
              { path: 'review', element: <ReviewModeration /> },
              { path: 'vouchers', element: <ManageVouchers /> },
              { path: 'banners', element: <ManageBanner /> },
              { path: 'notifications', element: <ManageNotifications /> },
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
              { path: 'fb-items', element: <ManageFbItems /> },
              { path: 'vouchers', element: <ManageVouchers /> },
              { path: 'notifications', element: <ManageNotifications /> },
              { path: 'staff', element: <ManagerStaffPage /> },
              { path: 'staff-shifts', element: <ManagerStaffPage /> },
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
              { path: 'schedule', element: <StaffSchedulePage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <ConfirmDialogHost />
    </>
  );
}

export default App;
