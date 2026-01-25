import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CharacterProps } from './config';
import { useCharacterAssets } from './hooks/useCharacterAssets';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';
import { useGameStore, CameraMode } from '../../core/store/gameStore';

export const Character = ({ position = [0, 0, 0], scale = 1 }: CharacterProps) => {
  const groupRef = useRef<Group>(null);
  const prevPositionRef = useRef<THREE.Vector3 | null>(null);

  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const uVelocity = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

  const terrainUniforms = useGameStore((state) => state.terrainUniforms);
  const setCharacterRef = useGameStore((state) => state.setCharacterRef);
  const { scene, animations, helmetRefs } = useCharacterAssets(terrainUniforms || undefined, uWorldPos);
  
  // Get camera mode from store
  const cameraMode = useGameStore((state) => state.cameraMode);

  useCharacterPhysics(groupRef, scene, animations);

  // Publish character ref to global store
  useEffect(() => {
    setCharacterRef(groupRef);
    return () => setCharacterRef(null);
  }, [setCharacterRef]);

  useEffect(() => {
    if (helmetRefs.current && helmetRefs.current.length > 0) {
      const shouldBeVisible = cameraMode !== CameraMode.FPV;
      helmetRefs.current.forEach((helmet) => {
        if (helmet && helmet.visible !== shouldBeVisible) {
          helmet.visible = shouldBeVisible;
        }
      });
    }
  }, [cameraMode, helmetRefs]);

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
};
