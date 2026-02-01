import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { CharacterProps } from './config';
import { useCharacterAssets } from './hooks/useCharacterAssets';
import { useCharacterPhysics } from './hooks/useCharacterPhysics';
import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CharacterAudio, CharacterAudioHandle } from './CharacterAudio';

export const Character = ({ position = [0, 0, 0], scale = 1 }: CharacterProps) => {
  const groupRef = useRef<Group>(null);
  const audioRef = useRef<CharacterAudioHandle>(null);

  const hasPrevFrameRef = useRef(false);
  const worldPosRef = useRef(new THREE.Vector3());
  const prevWorldPosRef = useRef(new THREE.Vector3());
  const velocityRef = useRef(new THREE.Vector3());

  const uWorldPos = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);
  const uVelocity = useMemo(() => uniform(new THREE.Vector3(0, 0, 0)), []);

  const terrainUniforms = useGameStore((state) => state.terrainUniforms);
  const setCharacterRef = useGameStore((state) => state.setCharacterRef);
  const { scene, animations, helmets } = useCharacterAssets(terrainUniforms || undefined, uWorldPos);

  // Get camera mode from store
  const cameraMode = useGameStore((state) => state.cameraMode);

  useCharacterPhysics(groupRef, scene, animations, (event) => {
    audioRef.current?.playStep(event.type, event.volume);
  });

  // Publish character ref to global store
  useEffect(() => {
    setCharacterRef(groupRef);
    return () => setCharacterRef(null);
  }, [setCharacterRef]);

  useEffect(() => {
    if (helmets && helmets.length > 0) {
      const shouldBeVisible = cameraMode !== CameraMode.FPV;
      helmets.forEach((helmet) => {
        helmet.visible = shouldBeVisible;
      });
    }
  }, [cameraMode, helmets]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.updateMatrixWorld(true);
    const worldPos = worldPosRef.current;
    worldPos.setFromMatrixPosition(groupRef.current.matrixWorld);

    uWorldPos.value.set(worldPos.x, worldPos.y, worldPos.z);

    if (hasPrevFrameRef.current) {
      const velocity = velocityRef.current;
      velocity.subVectors(worldPos, prevWorldPosRef.current);
      if (delta > 0) velocity.divideScalar(delta);
      uVelocity.value.set(velocity.x, velocity.y, velocity.z);
    } else {
      uVelocity.value.set(0, 0, 0);
      hasPrevFrameRef.current = true;
    }

    prevWorldPosRef.current.copy(worldPos);
  });

  if (!scene) return null;

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      {scene && <primitive object={scene} />}

      <Suspense fallback={null}>
        <CharacterAudio ref={audioRef} />
      </Suspense>
    </group>
  );
};
