import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css'
import App from './App.tsx'

// Client ID Google lấy từ biến môi trường, dùng cho nút đăng nhập Google nếu BE hỗ trợ.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// Điểm khởi động React: bọc App bằng GoogleOAuthProvider và ToastContainer global.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
      <ToastContainer theme="dark" position="top-right" autoClose={3000} />
    </GoogleOAuthProvider>
  </StrictMode>,
)
