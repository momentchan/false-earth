// ============================================================================
// Cosmic Beam Spawner Hook
// ============================================================================

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { MathUtils } from 'three';
import { useGameStore } from '../../../core/store/gameStore';
import { CosmicBeamsRef } from '../CosmicBeams';
import { MAX_POSITION_ATTEMPTS } from '../config';
import { isPositionValid, generateRandomDonutPosition } from '../utils/beamPositionValidator';

interface UseCosmicBeamSpawnerOptions {
  beamsRef: React.RefObject<CosmicBeamsRef | null>;
  waveParams: {
    donutMinRadius: number;
    donutMaxRadius: number;
    autoSpawn: boolean;
    minSpawnInterval: number;
    maxSpawnInterval: number;
    speedThreshold: number;
  };
  onBeamSpawn: (position: THREE.Vector3) => void;
}

/**
 * Hook to handle automatic beam spawning based on character movement
 */
export function useCosmicBeamSpawner({
  beamsRef,
  waveParams,
  onBeamSpawn,
}: UseCosmicBeamSpawnerOptions) {
  const characterRef = useGameStore((state) => state.characterRef);
  const characterPos = useMemo(() => new THREE.Vector3(), []);
  const prevCharacterPos = useRef<THREE.Vector3 | null>(null);
  const spawnTimer = useRef<number>(0);

  // Function to spawn a beam at a valid position
  const spawnBeam = () => {
    if (!characterRef?.current) {
      return;
    }
    characterRef.current.getWorldPosition(characterPos);

    const beamPositions = beamsRef.current?.getBeamPositions() || [];

    let position: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt++) {
      const candidatePosition = generateRandomDonutPosition(
        characterPos,
        waveParams.donutMinRadius,
        waveParams.donutMaxRadius
      );
      if (isPositionValid(candidatePosition, beamPositions)) {
        position = candidatePosition;
        break;
      }
    }

    // If no valid position found after attempts, use a random one anyway
    if (!position) {
      position = generateRandomDonutPosition(
        characterPos,
        waveParams.donutMinRadius,
        waveParams.donutMaxRadius
      );
    }

    onBeamSpawn(position);
  };

  // Auto-spawn logic based on character speed
  useFrame((_, delta) => {
    if (!waveParams.autoSpawn || !characterRef?.current) {
      return;
    }

    const currentPos = new THREE.Vector3();
    characterRef.current.getWorldPosition(currentPos);

    let speed = 0;
    if (prevCharacterPos.current) {
      const distance = currentPos.distanceTo(prevCharacterPos.current);
      speed = distance / delta;
    } else {
      prevCharacterPos.current = currentPos.clone();
      return;
    }

    prevCharacterPos.current = currentPos.clone();
    characterPos.copy(currentPos);

    if (speed < waveParams.speedThreshold) {
      spawnTimer.current = 0;
      return;
    }

    const speedNormalized = Math.min(speed / 5.0, 1.0);
    const spawnInterval = MathUtils.lerp(
      waveParams.maxSpawnInterval,
      waveParams.minSpawnInterval,
      speedNormalized
    );

    spawnTimer.current += delta;

    if (spawnTimer.current >= spawnInterval) {
      spawnTimer.current = 0;
      spawnBeam();
    }
  });

  return {
    spawnBeam,
  };
}
