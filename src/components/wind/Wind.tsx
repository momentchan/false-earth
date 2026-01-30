import { useMemo, useEffect } from 'react';
import { useControls } from 'leva';
import { uniform, vec2 } from 'three/tsl';
import { useGameStore } from '../../core/store/gameStore';
import { useFrame } from '@react-three/fiber';
import { WindUniforms } from '../../core/types';

export function Wind() {
  const setWindUniforms = useGameStore((state) => state.setWindUniforms);

  const [windParams] = useControls('Wind', () => ({
    windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
    windDirZ: { value: -0.8, min: -1, max: 1, step: 0.01 },
    windSpeed: { value: 0.35, min: 0, max: 3, step: 0.01 },
    windStrength: { value: 4.5, min: 0, max: 10, step: 0.01 },
    windScale: { value: 0.1, min: 0.01, max: 1, step: 0.01 },
    windFacing: { value: 1, min: 0.0, max: 1.0, step: 0.01 },
  }), { collapsed: true });

  const uniforms = useMemo(() => {
    return {
      uWindDir: uniform(vec2(windParams.windDirX, windParams.windDirZ)),
      uWindScale: uniform(windParams.windScale),
      uWindSpeed: uniform(windParams.windSpeed),
      uWindStrength: uniform(windParams.windStrength),
      uWindFacing: uniform(windParams.windFacing),
      uTime: uniform(0.0),
    };
  }, []);

  // Publish uniforms to global store
  useEffect(() => {
    setWindUniforms(uniforms);
    return () => setWindUniforms(null);
  }, [setWindUniforms, uniforms]);

  // Update uniforms when params change
  useEffect(() => {
    uniforms.uWindDir.value.set(windParams.windDirX, windParams.windDirZ);
    uniforms.uWindScale.value = windParams.windScale;
    uniforms.uWindSpeed.value = windParams.windSpeed;
    uniforms.uWindStrength.value = windParams.windStrength;
    uniforms.uWindFacing.value = windParams.windFacing;
  }, [windParams, uniforms]);

  // Update time uniform each frame
  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return null;
}
