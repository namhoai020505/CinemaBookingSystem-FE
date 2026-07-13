import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import AdminLayout from './layouts/admin/AdminLayout';
import ManagerLayout from './layouts/manager/ManagerLayout';
import UserLayout from './layouts/user/UserLayout';
import Dashboard from './pages/admin/Dashboard';
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import ManagerShowtimesPage from './pages/manager/ManagerShowtimesPage';
import ManagerRefundsPage from './pages/manager/ManagerRefundsPage';
import TicketScannerPage from './pages/manager/TicketScannerPage';
import MyCinemaPage from './pages/manager/MyCinemaPage';
import Home from './pages/user/Home';
import Profile from './pages/user/Profile';
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';
import RequireAuth from './components/RequireAuth';
import ManageMovie from './pages/admin/ManageMovie';
import ManageShowtime from './pages/admin/ManageShowtime';
import ManageStaff from './pages/admin/ManageStaff';
import ManageRooms from './pages/admin/ManageRooms';
import ManageSeatLayout from './pages/admin/ManageSeatLayout';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import MovieShowtimes from './pages/user/MovieShowtimes';
import SeatSelection from './pages/user/SeatSelection';
import Checkout from './pages/user/Checkout';
import ReviewModeration from './pages/admin/ReviewModeration';
import BookingSuccess from './pages/user/BookingSuccess';
import MyBookings from './pages/user/MyBookings';

const customerRoles = ['customer'];
const adminRoles = ['admin'];
const managerRoles = ['manager', 'staff'];

/**
 * RootLayout: wrapper ngoài cùng, luôn render bên trong RouterProvider
 * → có thể dùng useNavigate, useLocation, useBlocker...
 */
const RootLayout = () => {
  useIdleTimeout(10);
  return <Outlet />;
};



// Sử dụng createBrowserRouter (Data Router) để hỗ trợ useBlocker
const router = createBrowserRouter([
  {
    // Root wrapper — bao mọi route để GlobalTimer hoạt động trong router context
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/staff/set-password',
        element: <StaffSetPassword />,
      },
      {
        // User layout
        element: <UserLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/movie/:movieId/showtimes', element: <MovieShowtimes /> },
          { path: '/booking/seats/:showtimeId', element: <SeatSelection /> },
          {
            element: <RequireAuth allowedRoles={customerRoles} />,
            children: [
              { path: '/booking/checkout/:showtimeId', element: <Checkout /> },
              { path: '/booking/success/:bookingId', element: <BookingSuccess /> },
              { path: '/my-bookings', element: <MyBookings /> },
              { path: 'profile', element: <Profile /> },
            ],
          },
        ],
      },
      {
        // Admin layout
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
            ],
          },
        ],
      },
      {
        // Manager / Staff layout
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
              { path: 'my-cinema', element: <MyCinemaPage /> },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
