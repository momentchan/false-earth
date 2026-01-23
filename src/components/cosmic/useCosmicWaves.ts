import { useMemo, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three/webgpu';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/gameStore';
import { useThree } from '@react-three/fiber';
import { struct } from 'three/tsl';

// Wave data structure for shockwave effects
// Each wave contains: x position, z position, start time, max radius, lifetime
export const waveStructure = struct({
  x: 'float',
  z: 'float',
  startTime: 'float',
  maxRadius: 'float',
  lifetime: 'float',
});

const MAX_WAVES = 16; // Maximum number of waves that can exist simultaneously
const DATA_PER_WAVE = 5; // x, z, startTime, maxRadius, lifetime

export function useCosmicWaves() {
  const { clock } = useThree();

  const setWaveStorageBuffer = useGameStore((state) => state.setWaveStorageBuffer);
  const setActiveWaveCount = useGameStore((state) => state.setActiveWaveCount);
  
  // 1. Create data buffer
  const waveDataArray = useMemo(() => new Float32Array(MAX_WAVES * DATA_PER_WAVE), []);
  
  // 2. Create WebGPU Storage Buffer
  // Use StorageBufferAttribute to allow Shader to read the array
  const waveStorageBuffer = useMemo(() => {
    const attr = new THREE.StorageBufferAttribute(waveDataArray, DATA_PER_WAVE);
    return attr;
  }, [waveDataArray]);

  // Update global store when buffer is created
  useEffect(() => {
    setWaveStorageBuffer(waveStorageBuffer);
    return () => {
      setWaveStorageBuffer(null);
    };
  }, [waveStorageBuffer, setWaveStorageBuffer]);

  // Track active waves on the JS side
  const activeWaves = useRef<any[]>([]);

  // 3. Trigger function: called externally (e.g., when a ray hits the ground)
  const triggerShockwave = useCallback((position: THREE.Vector3, maxRadius: number = 15.0, lifetime: number = 5.0) => {
    activeWaves.current.push({
      pos: new THREE.Vector2(position.x, position.z),
      startTime: clock.getElapsedTime(),
      maxRadius,
      lifetime
    });

    // Limit count, remove oldest
    if (activeWaves.current.length > MAX_WAVES) {
      activeWaves.current.shift();
    }
  }, []);

  // 4. Update Buffer every frame
  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    // Clear array (or only overwrite needed region)
    waveDataArray.fill(0);

    // Filter out expired waves - this compacts the array so active waves are contiguous
    activeWaves.current = activeWaves.current.filter(wave => {
      const age = now - wave.startTime;
      return age <= wave.lifetime;
    });

    // Update data to Array - active waves are written contiguously starting from index 0
    // This allows the shader to loop only through activeWaveCount instead of all 16
    let activeCount = 0;
    for (let i = 0; i < activeWaves.current.length; i++) {
      const wave = activeWaves.current[i];
      const age = now - wave.startTime;
      
      // Early break if we find an expired wave (shouldn't happen after filter, but safety check)
      if (age > wave.lifetime) break;

      const index = activeCount * DATA_PER_WAVE;
      waveDataArray[index + 0] = wave.pos.x;
      waveDataArray[index + 1] = wave.pos.y;
      waveDataArray[index + 2] = wave.startTime;
      waveDataArray[index + 3] = wave.maxRadius;
      waveDataArray[index + 4] = wave.lifetime;
      activeCount++;
    }
    
    setActiveWaveCount(activeCount);
    waveStorageBuffer.needsUpdate = true;
  });

  return {
    triggerShockwave,
    waveCount: MAX_WAVES
  };
}
