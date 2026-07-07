import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css'
import App from './App.tsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
      <ToastContainer theme="dark" position="top-right" autoClose={3000} />
    </GoogleOAuthProvider>
  </StrictMode>,
)
