import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function DeviceDetector() {
  const setIsMobile = useGameStore((state) => state.setIsMobile);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [setIsMobile]);

  return null;
}