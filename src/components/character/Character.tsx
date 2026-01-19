import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CharacterProps } from './types';
import { useCharacterAssets } from './hooks/useCharacterAssets';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';
import { useCharacterTrail } from './hooks/useCharacterTrail';

export function Character({ position = [0, 0, 0], scale = 1, terrainUniforms, onTrailTextureChange, characterWorldPosRef }: CharacterProps) {
  const groupRef = useRef<Group>(null);
  const prevPositionRef = useRef<THREE.Vector3 | null>(null);

  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const uVelocity = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

  const { scene, animations } = useCharacterAssets(terrainUniforms, uWorldPos);

  useCharacterPhysics(groupRef, scene, animations);

  // const { trailTexture } = useCharacterTrail(uWorldPos, uVelocity);

  // // Notify parent when trail texture changes
  // useEffect(() => {
  //   if (onTrailTextureChange && trailTexture) {
  //     onTrailTextureChange(trailTexture);
  //   }
  // }, [trailTexture, onTrailTextureChange]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.updateMatrixWorld(true);
      const groupWorldPos = new THREE.Vector3();
      groupWorldPos.setFromMatrixPosition(groupRef.current.matrixWorld);
      
      // Update world position uniform
      uWorldPos.value.set(groupWorldPos.x, groupWorldPos.y, groupWorldPos.z);
      
      // Update position ref for grass material
      if (characterWorldPosRef) {
        characterWorldPosRef.current.set(groupWorldPos.x, groupWorldPos.y, groupWorldPos.z);
      }
      
      // Calculate velocity
      if (prevPositionRef.current) {
        const velocity = new THREE.Vector3();
        velocity.subVectors(groupWorldPos, prevPositionRef.current);
        // Divide by delta time to get velocity per second
        if (delta > 0) {
          velocity.divideScalar(delta);
        }
        uVelocity.value.set(velocity.x, velocity.y, velocity.z);
      } else {
        // First frame: velocity is zero
        uVelocity.value.set(0, 0, 0);
      }
      
      // Store current position for next frame
      prevPositionRef.current = groupWorldPos.clone();
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      {scene && <primitive object={scene} />}
    </group>
  );
}
