import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5070', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 1. Interceptor REQUEST: Gắn Token tự động vào mỗi API gửi đi
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Interceptor RESPONSE: Tinh chỉnh bẫy lỗi 403/401 linh hoạt
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const originalRequestUrl = error.config?.url;
    const errorStatus = error.response?.status;

    // 💡 BẪY ĐIỀU KIỆN: Nếu dính 403 hoặc 401
    if (errorStatus === 401 || errorStatus === 403) {
      
      // Nếu là API sơ đồ ghế hoặc API login thì CHẶN KHÔNG CHO ĐÁ VỀ LOGIN
      if (
        (originalRequestUrl && originalRequestUrl.includes('/api/seats/showtimes')) ||
        (originalRequestUrl && originalRequestUrl.includes('/api/auth/login'))
      ) {
        return Promise.reject(error); // Trả lỗi về cho Component tự xử lý UI, không logout
      }

      // Các API bắt buộc khác thì mới kích hoạt cơ chế dọn dẹp và đẩy về Login
      console.error('Hết hạn quyền truy cập hệ thống. Điều hướng về Login...');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('role');
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

export default api;
