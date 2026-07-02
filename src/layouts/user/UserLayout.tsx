import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

export default function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#182437]">
      <Header />
      
      <main className="flex-1 bg-[#182437] pt-[94px]">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
