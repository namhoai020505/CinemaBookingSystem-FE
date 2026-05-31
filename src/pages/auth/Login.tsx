import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api'; // Đường dẫn import file cấu hình axios ở trên

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // In ra dữ liệu FE chuẩn bị gửi đi xem có đúng không
    console.log(">>> [FE] Dữ liệu gửi đi:", { email, password });

    try {
      const response = await api.post('/api/auth/login', {
        Email: email,
        Password: password,
      });

      // === ĐOẠN KIỂM TRA QUAN TRỌNG NHẤT ===
      console.log(">>> [FE] Kết quả thô nhận từ Backend (response):", response);
      console.log(">>> [FE] Cục dữ liệu chính (response.data):", response.data);

      // Thử tìm token theo cả 2 trường hợp (bị bọc bởi ServiceResult hoặc không)
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
        // Cập nhật lại giá trị mặc định cho hợp lý với cả 2 đối tượng
        localStorage.setItem('fullName', fullName || 'Người dùng');
        
        console.log(">>> [FE] Đăng nhập thành công! Đang phân luồng...");
        
        // === XỬ LÝ ĐIỀU HƯỚNG THEO ROLE TẠI ĐÂY ===
        if (role === 'Admin') {
          navigate('/admin/dashboard'); // Admin thì vào Dashboard
        } else if (role === 'Customer' || role === 'ROLE_CUSTOMER') {
          navigate('/'); // Customer thì về trang chủ đặt vé
        } else {
          // Trừ hao trường hợp role lạ hoặc chưa define rõ, cho về trang chủ luôn
          navigate('/'); 
        }
        
      } else {
        setError('Đăng nhập thành công nhưng cấu trúc trả về không có token. Hãy kiểm tra Console!');
      }

    } catch (err: any) {
      // In lỗi chi tiết ra console để biết lỗi mạng, lỗi sai pass hay lỗi gì
      console.error(">>> [FE] Lỗi xảy ra khi gọi API:", err);
      console.log(">>> [FE] Chi tiết phản hồi lỗi từ Server:", err.response);

      if (err.response) {
        // Server có trả về lỗi (Ví dụ: 400, 401, 500)
        setError(err.response.data?.message || `Lỗi từ Server (${err.response.status})`);
      } else if (err.request) {
        // Gửi yêu cầu đi nhưng không nhận được phản hồi (Lỗi mạng/CORS/Sai URL)
        setError('Không thể kết nối đến Backend. Hãy kiểm tra xem Backend đã bật chưa hoặc lỗi CORS.');
      } else {
        setError('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Đăng Nhập</h2>

      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label>Email:</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label>Mật khẩu:</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: '10px', background: '#3498db', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {isLoading ? 'Đang xử lý...' : 'Đăng Nhập'}
        </button>
      </form>
    </div>
  );
};

export default Login;