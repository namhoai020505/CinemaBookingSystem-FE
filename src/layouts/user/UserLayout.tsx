import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Chatbot from '../../components/Chatbot';
import MobileBottomNav from './MobileBottomNav';

export default function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#182437] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header />
      
      <main className="flex-1 bg-slate-50 dark:bg-[#182437] pb-24 pt-[66px] transition-colors duration-300 md:pb-0 md:pt-[94px]">
        <Outlet />
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
      <Chatbot />
    </div>
  );
}
