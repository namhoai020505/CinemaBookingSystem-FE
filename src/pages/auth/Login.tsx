import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiRefreshCw } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import api from '../../lib/api';
import Header from '../../layouts/user/Header';
import Footer from '../../layouts/user/Footer';

export default function Login() {
  const navigate = useNavigate();

  // State chuyển tab
  const [isLoginTab, setIsLoginTab] = useState(true);

  // State form dữ liệu
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State cho Captcha
  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');

  // Hàm tạo mã captcha 5 số ngẫu nhiên
  const generateCaptcha = () => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setCaptchaText(randomNum.toString());
    setCaptchaInput(''); // Xóa ô nhập khi đổi mã mới
  };

  // Tự động tạo Captcha khi load trang lần đầu
  useEffect(() => {
    generateCaptcha();
  }, []);

  // Xử lý Submit Form (Đăng nhập / Đăng ký)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Kiểm tra Captcha trước
    if (captchaInput !== captchaText) {
      setError('Mã xác thực không đúng. Vui lòng thử lại!');
      generateCaptcha(); // Bắt người dùng nhập mã mới nếu sai
      return;
    }

    // 2. Xử lý logic Đăng Ký (Nếu đang ở tab Đăng Ký)
    if (!isLoginTab) {
      alert('Tính năng đăng ký đang được tích hợp. Vui lòng thử lại sau!');
      return;
    }

    // 3. Logic Đăng Nhập (Từ file cũ của bạn)
    setIsLoading(true);
    console.log(">>> [FE] Dữ liệu gửi đi:", { email, password });

    try {
      const response = await api.post('/api/auth/login', {
        Email: email,
        Password: password,
      });

      console.log(">>> [FE] Kết quả thô nhận từ Backend (response):", response);
      console.log(">>> [FE] Cục dữ liệu chính (response.data):", response.data);

      const backendData = response.data?.data ? response.data.data : response.data;
      console.log(">>> [FE] Dữ liệu sau khi bóc tách lớp bọc:", backendData);

      const token = backendData?.accessToken || backendData?.token;
      const role = backendData?.role;
      const fullName = backendData?.fullName;

      console.log(">>> [FE] Token tìm thấy:", token);
      console.log(">>> [FE] Role tìm thấy:", role);

      if (token) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('role', role || '');
        localStorage.setItem('fullName', fullName || 'Người dùng');

        console.log(">>> [FE] Đăng nhập thành công! Đang phân luồng...");

        if (role === 'Admin') {
          navigate('/admin/dashboard');
        } else if (role === 'Customer' || role === 'ROLE_CUSTOMER') {
          navigate('/');
        } else {
          navigate('/');
        }
      } else {
        setError('Đăng nhập thành công nhưng không có token. Hãy kiểm tra Console!');
      }

    } catch (err: any) {
      console.error(">>> [FE] Lỗi xảy ra khi gọi API:", err);
      console.log(">>> [FE] Chi tiết phản hồi lỗi từ Server:", err.response);

      if (err.response) {
        setError(err.response.data?.message || `Lỗi từ Server (${err.response.status})`);
      } else if (err.request) {
        setError('Không thể kết nối đến Backend. Hãy kiểm tra xem Backend đã bật chưa hoặc lỗi CORS.');
      } else {
        setError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1E293B]">
      {/* 1. HEADER Ở TRÊN CÙNG */}
      <Header />

      <div className="min-h-[80vh] flex items-center justify-center bg-[#1E293B] px-4 py-12">
        <div className="w-full max-w-md">

          {/* TABS */}
          <div className="flex bg-[#0F172A] rounded-t-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => { setIsLoginTab(true); setError(''); }}
              className={`flex-1 py-3 text-center font-bold text-sm transition ${isLoginTab
                ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              Đăng Nhập
            </button>
            <button
              onClick={() => { setIsLoginTab(false); setError(''); }}
              className={`flex-1 py-3 text-center font-bold text-sm transition ${!isLoginTab
                ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              Đăng Ký
            </button>
          </div>

          {/* KHU VỰC FORM */}
          <div className="bg-transparent border-x border-b border-gray-700 rounded-b-lg p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Hiển thị thông báo lỗi */}
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 text-sm p-3 rounded text-center">
                  {error}
                </div>
              )}

              {/* Input: Họ tên (Chỉ hiện khi Đăng ký) */}
              {!isLoginTab && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">Họ và Tên</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <FiUser />
                    </span>
                    <input
                      type="text"
                      placeholder="Vui lòng nhập họ tên"
                      className="w-full bg-transparent border border-gray-600 text-white rounded-md pl-10 pr-4 py-2 focus:outline-none focus:border-[#FFD166] placeholder-gray-500 text-sm transition"
                    />
                  </div>
                </div>
              )}

              {/* Input: Email */}
              <div>
                <label className="text-gray-300 text-sm mb-1 block">Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <FiMail />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Vui lòng nhập email của bạn"
                    className="w-full bg-transparent border border-gray-600 text-white rounded-md pl-10 pr-4 py-2 focus:outline-none focus:border-[#FFD166] placeholder-gray-500 text-sm transition"
                  />
                </div>
              </div>

              {/* Input: Mật khẩu */}
              <div>
                <label className="text-gray-300 text-sm mb-1 block">Mật khẩu</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <FiLock />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Vui lòng nhập mật khẩu"
                    className="w-full bg-transparent border border-gray-600 text-white rounded-md pl-10 pr-4 py-2 focus:outline-none focus:border-[#FFD166] placeholder-gray-500 text-sm transition"
                  />
                </div>
              </div>

              {/* Quên mật khẩu */}
              {isLoginTab && (
                <div className="text-right">
                  <Link to="#" className="text-sm text-gray-400 hover:text-white italic">
                    Quên Mật Khẩu?
                  </Link>
                </div>
              )}

              {/* MÃ XÁC THỰC (CAPTCHA) */}
              <div className="flex items-center gap-3 my-2">
                {/* Box hiển thị số */}
                <div
                  className="bg-white px-4 py-1 text-green-700 font-bold tracking-[0.2em] text-lg rounded line-through decoration-gray-400 select-none cursor-not-allowed"
                  title="Mã xác thực"
                >
                  {captchaText}
                </div>

                {/* Nút làm mới */}
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="text-gray-400 hover:text-white transition"
                  title="Đổi mã khác"
                >
                  <FiRefreshCw size={20} />
                </button>

                {/* Ô nhập mã */}
                <input
                  type="text"
                  required
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Mã xác thực"
                  className="flex-1 bg-transparent border border-gray-600 text-white rounded-md px-3 py-1.5 focus:outline-none focus:border-[#FFD166] text-sm"
                />
              </div>

              {/* Nút Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black font-bold py-2.5 rounded-md mt-2 transition shadow-lg uppercase text-sm ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
              >
                {isLoading ? 'Đang xử lý...' : (isLoginTab ? 'Đăng Nhập Bằng Tài Khoản' : 'Đăng Ký Tài Khoản')}
              </button>

              {/* Nút Đăng nhập Google */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black font-bold py-2.5 rounded-md transition shadow text-sm mt-2 uppercase"
              >
                <FcGoogle size={20} />
                Đăng Nhập Bằng Google
              </button>

            </form>
          </div>
        </div>
      </div>
      {/* 3. FOOTER Ở DƯỚI CÙNG */}
      <Footer />
    </div>
  );
}