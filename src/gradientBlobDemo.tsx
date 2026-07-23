import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GlowingMouseGradientBlob from './components/GlowingMouseGradientBlob';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlowingMouseGradientBlob />
  </StrictMode>,
);
