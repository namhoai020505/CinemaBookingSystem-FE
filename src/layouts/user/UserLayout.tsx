import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Chatbot from '../../components/Chatbot';
import GlowingMouseGradientBlob from '../../components/GlowingMouseGradientBlob';
import MobileBottomNav from './MobileBottomNav';

export default function UserLayout() {
  return (
    <div className="user-gradient-shell min-h-screen flex flex-col bg-white dark:bg-black text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <GlowingMouseGradientBlob variant="background" />
      <Header />
      
      <main className="user-page-surface relative z-10 flex-1 bg-transparent pb-24 pt-[66px] transition-colors duration-300 md:pb-0 md:pt-[94px]">
        <Outlet />
      </main>

      <div className="user-layout-footer relative z-20 hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
      <Chatbot />
    </div>
  );
}
