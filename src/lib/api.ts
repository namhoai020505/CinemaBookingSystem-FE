import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.yourdomain.com/v1',
  timeout: 10000,
});

// Gắn Token tự động
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý 401 Unauthorized
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Token hết hạn. Về trang Login...');
      localStorage.removeItem('access_token');
      // Ép trình duyệt load lại về trang login
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }

  
);

export default api;