import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { CharacterProps } from './types';
import { useCharacterAssets } from './hooks/useCharacterAssets';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';
import { useCharacterTrail } from './hooks/useCharacterTrail';

export function Character({ position = [0, 0, 0], scale = 1, terrainUniforms, onTrailTextureChange }: CharacterProps) {
  const groupRef = useRef<Group>(null);

  const { scene, animations, uCharacterWorldPos } = useCharacterAssets(terrainUniforms);

  useCharacterPhysics(groupRef, scene, animations);

  const { trailTexture } = useCharacterTrail(uCharacterWorldPos);

  // Notify parent when trail texture changes
  useEffect(() => {
    if (onTrailTextureChange && trailTexture) {
      onTrailTextureChange(trailTexture);
    }
  }, [trailTexture, onTrailTextureChange]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.updateMatrixWorld(true);
      const groupWorldPos = new THREE.Vector3();
      groupWorldPos.setFromMatrixPosition(groupRef.current.matrixWorld);
      uCharacterWorldPos.value.set(groupWorldPos.x, groupWorldPos.y, groupWorldPos.z);
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      {scene && <primitive object={scene} />}
    </group>
  );
}
