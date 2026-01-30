// components/core/AudioManager.tsx
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { AudioListener } from 'three/webgpu';
import { useGameStore } from '../../core/store/gameStore';

export function AudioManager() {
  const { camera } = useThree();
  const setAudioListener = useGameStore((state) => state.setAudioListener);
  
  const [listener] = useState(() => new AudioListener());

  useEffect(() => {
    camera.add(listener);
    setAudioListener(listener);

    return () => {
      camera.remove(listener);
    };
  }, [camera, listener, setAudioListener]);

  return null;
}