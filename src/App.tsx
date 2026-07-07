import { useIdleTimeout } from './hooks/useIdleTimeout';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import AdminLayout from './layouts/admin/AdminLayout';
import UserLayout from './layouts/user/UserLayout';
import Login from './pages/auth/Login';
import StaffSetPassword from './pages/auth/StaffSetPassword';
import Dashboard from './pages/admin/Dashboard';
import RequireAuth from './components/RequireAuth';
import ManageMovie from './pages/admin/ManageMovie';
import ManageRooms from './pages/admin/ManageRooms';
import ManageSeatLayout from './pages/admin/ManageSeatLayout';
import ManageShowtime from './pages/admin/ManageShowtime';
import ManageStaff from './pages/admin/ManageStaff';
import ReviewModeration from './pages/admin/ReviewModeration';
import BookingSuccess from './pages/user/BookingSuccess';
import Checkout from './pages/user/Checkout';
import Home from './pages/user/Home';
import MovieShowtimes from './pages/user/MovieShowtimes';
import MyBookings from './pages/user/MyBookings';
import Profile from './pages/user/Profile';
import SeatSelection from './pages/user/SeatSelection';

// Nhóm role được truyền vào RequireAuth để khóa route theo quyền trong JWT.
const customerRoles = ['customer'];
const adminRoles = ['admin'];

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
              { path: 'reviews', element: <ReviewModeration /> },
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
