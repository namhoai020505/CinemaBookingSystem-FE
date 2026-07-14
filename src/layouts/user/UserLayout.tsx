import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Chatbot from '../../components/Chatbot';

export default function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#182437] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header />
      
      <main className="flex-1 bg-slate-50 dark:bg-[#182437] pt-[94px] transition-colors duration-300">
        <Outlet />
      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}
