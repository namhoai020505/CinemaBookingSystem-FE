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

// 2. Interceptor RESPONSE: Xử lý dữ liệu trả về và lỗi (CHỈ DÙNG 1 BLOCK NÀY DUY NHẤT)
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const originalRequestUrl = error.config?.url;

    if (error.response?.status === 401) {
      // Nếu là API login thì bỏ qua, để component Login tự hiển thị lỗi sai mật khẩu
      if (originalRequestUrl && originalRequestUrl.includes('/api/auth/login')) {
        return Promise.reject(error);
      }

      // Các API khác bị 401 (thực sự hết hạn token) thì mới đá về login
      console.error('Token hết hạn hoặc không hợp lệ. Về trang Login...');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('role');
      localStorage.removeItem('fullName');
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

export default api;