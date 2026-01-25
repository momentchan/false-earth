import { useGameStore, CameraMode } from '../../core/store/gameStore';
import { CameraControls } from '@react-three/drei';
import { useFPVCamera } from './hooks/useFPVCamera';
import { useTPSCamera } from './hooks/useTPSCamera';

type Props = {
  boneName?: string;
};

export function CameraViewControl({ boneName = 'head' }: Props) {
  // Read mode and character ref directly from Store
  const cameraMode = useGameStore((state) => state.cameraMode);
  const characterRef = useGameStore((state) => state.characterRef);

  // Use TPS camera hook (handles pointer lock and mouse look)
  const { controlsRef } = useTPSCamera({
    characterRef,
    enabled: cameraMode === CameraMode.TPS,
  });

  // Use FPV camera hook (handles bone attachment and mouse look)
  useFPVCamera({
    characterRef,
    boneName,
    enabled: cameraMode === CameraMode.FPV,
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode !== CameraMode.FPV}
      minDistance={2}
      maxDistance={20}
      maxPolarAngle={Math.PI / 2}
      smoothTime={0.1}
    />
  );
}
