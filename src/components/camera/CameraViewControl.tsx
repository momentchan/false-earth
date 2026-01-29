import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CameraControls } from '@react-three/drei';
import { useFPVCamera } from './hooks/useFPVCamera';
import { useTPSCamera } from './hooks/useTPSCamera';
import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';

type Props = {
  boneName?: string;
};

export function CameraViewControl({ boneName = 'head' }: Props) {
  // Read mode and character ref directly from Store
  const cameraMode = useGameStore((state) => state.cameraMode);
  const characterRef = useGameStore((state) => state.characterRef);
  const isGameLoaded = useGameStore((state) => state.isGameStarted);

  const [introFinished, setIntroFinished] = useState(false);

  // Use TPS camera hook (handles pointer lock and mouse look)
  const { controlsRef } = useTPSCamera({
    characterRef,
    enabled: cameraMode === CameraMode.TPS && introFinished,
  });

  // Use FPV camera hook (handles bone attachment and mouse look)
  useFPVCamera({
    characterRef,
    boneName,
    enabled: cameraMode === CameraMode.FPV && introFinished,
  });

  useEffect(() => {
    if (isGameLoaded && !introFinished && characterRef?.current && controlsRef.current) {
      console.log("Intro Started");
      const charPos = characterRef.current.position;

      controlsRef.current.setLookAt(
        charPos.x, charPos.y + 2, charPos.z - 4,
        charPos.x, charPos.y + 1, charPos.z,
        true
      ).then(() => {
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
