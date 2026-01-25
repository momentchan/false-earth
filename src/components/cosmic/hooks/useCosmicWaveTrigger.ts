// ============================================================================
// Cosmic Wave Trigger Hook
// ============================================================================

import { useMemo } from 'react';
import * as THREE from 'three/webgpu';
import { MathUtils } from 'three';
import { useCosmicWaves } from './useCosmicWaves';
import { RoseHandle } from '../../Rose/Rose';
import { useGameStore } from '../../../core/store/gameStore';

interface UseCosmicWaveTriggerOptions {
  waveParams: {
    radiusMin: number;
    radiusMax: number;
    lifetimeMin: number;
    lifetimeMax: number;
  };
}

/**
 * Hook to handle wave triggering when beams hit the ground
 */
export function useCosmicWaveTrigger({ waveParams }: UseCosmicWaveTriggerOptions) {
  const { triggerShockwave } = useCosmicWaves();
  const roseRef = useGameStore((state) => state.roseRef);

  // Create callback function that triggers wave and spawns roses
  const onBeamHit = useMemo(() => {
    return (beamPosition: THREE.Vector3) => {
      const radius = MathUtils.lerp(waveParams.radiusMin, waveParams.radiusMax, Math.random());
      const lifetime = MathUtils.lerp(waveParams.lifetimeMin, waveParams.lifetimeMax, Math.random());
      
      // Trigger shockwave
      triggerShockwave(beamPosition, radius, lifetime);
      
      // Spawn roses at impact point
      roseRef?.current?.spawn(beamPosition, 256, radius);
    };
  }, [triggerShockwave, waveParams, roseRef]);

  return {
    onBeamHit,
  };
}
