import { useEffect, useRef } from 'react';
import './GlowingMouseGradientBlob.css';

const followStrength = 0.16;

type GlowingMouseGradientBlobProps = {
  variant?: 'demo' | 'background';
};

const GlowingMouseGradientBlob = ({
  variant = 'demo',
}: GlowingMouseGradientBlobProps) => {
  const blobRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentPositionRef = useRef({ x: 0, y: 0 });
  const targetPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const blobElement = blobRef.current;

    if (!blobElement) {
      return undefined;
    }

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    currentPositionRef.current = { x: centerX, y: centerY };
    targetPositionRef.current = { x: centerX, y: centerY };

    const updateBlobPosition = (): void => {
      const currentPosition = currentPositionRef.current;
      const targetPosition = targetPositionRef.current;

      currentPosition.x += (targetPosition.x - currentPosition.x) * followStrength;
      currentPosition.y += (targetPosition.y - currentPosition.y) * followStrength;

      blobElement.style.transform = `translate3d(${currentPosition.x}px, ${currentPosition.y}px, 0) translate(-50%, -50%)`;
      animationFrameRef.current = window.requestAnimationFrame(updateBlobPosition);
    };

    const handleMouseMove = (event: MouseEvent): void => {
      targetPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameRef.current = window.requestAnimationFrame(updateBlobPosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (variant === 'background') {
    return (
      <div className="glowing-blob-background" aria-hidden="true">
        <div ref={blobRef} className="glowing-blob glowing-blob--background" />
      </div>
    );
  }

  return (
    <main className="glowing-blob-page" aria-label="Glowing mouse-follow gradient blob demo">
      <div ref={blobRef} className="glowing-blob" aria-hidden="true" />
      <h1 className="glowing-blob-title">Background Gradient Animation</h1>
    </main>
  );
};

export default GlowingMouseGradientBlob;
