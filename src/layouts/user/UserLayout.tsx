import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#182437]">
      {/* Header cố định cho các trang user: logo, menu, login/logout, theme mode. */}
      <Header />
      
      {/* pt-[94px] chừa chỗ cho header fixed để nội dung không bị che. */}
      <main className="flex-1 bg-[#182437] pt-[94px]">
        <Outlet />
      </main>

      {/* Footer thông tin chính sách, cụm rạp và liên hệ. */}
      <Footer />
    </div>
  );
}
