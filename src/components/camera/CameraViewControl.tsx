import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CameraControls } from '@react-three/drei';
import { useFPVCamera } from './hooks/useFPVCamera';
import { useTPVCamera } from './hooks/useTPVCamera';
import { useEffect, useState } from 'react';
import * as THREE from 'three/webgpu';

type Props = {
  boneName?: string;
};

export const CAMERA_INITIAL_POSITION = new THREE.Vector3(-4, 2, -0.5);
export const CAMERA_INITIAL_LOOKAT = new THREE.Vector3(0, 1, 0);

export function CameraViewControl({ boneName = 'head' }: Props) {
  // Read mode and character ref directly from Store
  const cameraMode = useGameStore((state) => state.cameraMode);
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameLoaded = useGameStore((state) => state.isGameStarted);

  const [introFinished, setIntroFinished] = useState(false);

  // Use TPS camera hook (handles pointer lock and mouse look)
  const { controlsRef } = useTPVCamera({
    characterRef,
    enabled: cameraMode === CameraMode.TPV && introFinished,
  });

  // Use FPV camera hook (handles bone attachment and mouse look)
  useFPVCamera({
    characterRef,
    boneName,
    enabled: cameraMode === CameraMode.FPV && introFinished,
  });

  useEffect(() => {
    if (isGameLoaded && !introFinished && characterRef?.current && controlsRef.current) {
      const charPos = characterRef.current.position;
      const pos = charPos.clone().add(CAMERA_INITIAL_POSITION);
      const lookAt = charPos.clone().add(CAMERA_INITIAL_LOOKAT);

      controlsRef.current.setLookAt(pos.x, pos.y, pos.z, lookAt.x, lookAt.y, lookAt.z, true).then(() => {
        setIntroFinished(true);
      });
    }
  }, [isGameLoaded, introFinished, characterRef]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode !== CameraMode.FPV && introFinished}
      minDistance={2}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2}
      smoothTime={ introFinished ? 0.1 : 1.2 }
    />
  );
}
