import { Outlet } from 'react-router-dom';

export default function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4 font-bold">
        User Header (Menu, Logo...)
      </header>
      
      <main className="flex-1 p-4">
        {/* Nơi hiển thị các trang con như Home, Profile */}
        <Outlet />
      </main>

      <footer className="bg-gray-200 text-center p-4">
        User Footer © 2026
      </footer>
    </div>
  );
}