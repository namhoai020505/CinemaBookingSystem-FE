import { Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-slate-800 text-white p-4">
        <h2 className="text-xl font-bold">Admin Panel</h2>
        {/* Menu Sidebar có thể thêm sau */}
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Nơi hiển thị các trang con như Dashboard */}
        <Outlet />
      </main>
    </div>
  );
}