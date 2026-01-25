import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bone, Group, Vector3, Quaternion, Euler, MathUtils, Object3D } from 'three';
import { useControls } from 'leva';

interface UseFPVCameraOptions {
  characterRef: React.MutableRefObject<Group | null> | null;
  boneName: string;
  enabled: boolean;
}

/**
 * Hook to handle First Person View (FPV) camera logic
 * Attaches camera to character's head bone with mouse look
 */
export function useFPVCamera({
  characterRef,
  boneName,
  enabled,
}: UseFPVCameraOptions) {
  const { camera } = useThree();
  const targetBone = useRef<Bone | undefined>(undefined);
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });

  const { vec3, quat, quatOffset, quatBone, quatLookForward, modelCorrectionQuat, dummyEuler, mouseQuat } = useMemo(() => ({
    vec3: new Vector3(),
    quat: new Quaternion(),
    quatOffset: new Quaternion(),
    quatBone: new Quaternion(),
    quatLookForward: new Quaternion(),
    modelCorrectionQuat: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0, 'YXZ')),
    dummyEuler: new Euler(),
    mouseQuat: new Quaternion(),
  }), []);

  const config = useControls('FPV Settings', {
    rotateX: { value: -90, min: -180, max: 180, step: 1 },
    rotateY: { value: -90, min: -180, max: 180, step: 1 },
    rotateZ: { value: 0, min: -180, max: 180, step: 1 },
    offsetX: { value: 0, min: -2, max: 2, step: 0.01 },
    offsetY: { value: 0.5, min: -2, max: 2, step: 0.01 },
    offsetZ: { value: -0.2, min: -2, max: 2, step: 0.01 },
    headBodySmoothing: { value: 0.97, min: 0, max: 1, step: 0.01 },
    mouseRotationSmoothing: { value: 0.5, min: 0.01, max: 1, step: 0.01 },
  }, { collapsed: true });

  // Handle Mouse Look for FPV
  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: MouseEvent) => {
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      const ndcY = (e.clientY / window.innerHeight) * 2 - 1;

      targetRotation.current.x = MathUtils.degToRad(MathUtils.mapLinear(ndcX, -1, 1, 150, -150));
      targetRotation.current.y = MathUtils.degToRad(MathUtils.mapLinear(ndcY, -1, 1, 90, -30));
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled]);

  // Update camera position and rotation each frame
  useFrame(() => {
    if (!enabled || !characterRef?.current) return;

    if (!targetBone.current || !isBoneAttached(targetBone.current, characterRef.current)) {
      targetBone.current = findBone(characterRef.current, boneName);
    }

    if (targetBone.current) {
      characterRef.current.updateMatrixWorld(true);

      targetBone.current.getWorldPosition(vec3);
      targetBone.current.getWorldQuaternion(quatBone);

      characterRef.current.getWorldQuaternion(quatLookForward);
      quatLookForward.multiply(modelCorrectionQuat);

      dummyEuler.set(
        MathUtils.degToRad(config.rotateX),
        MathUtils.degToRad(config.rotateY),
        MathUtils.degToRad(config.rotateZ),
        'YXZ'
      );
      quatOffset.setFromEuler(dummyEuler);

      quatBone.multiply(quatOffset);

      quat.copy(quatBone).slerp(quatLookForward, config.headBodySmoothing);

      // Smoothly interpolate current rotation towards target rotation
      currentRotation.current.x = MathUtils.lerp(
        targetRotation.current.x,
        currentRotation.current.x,
        config.mouseRotationSmoothing
      );
      currentRotation.current.y = MathUtils.lerp(
        targetRotation.current.y,
        currentRotation.current.y,
        config.mouseRotationSmoothing
      );

      // Apply smoothed mouse rotation to camera quaternion
      dummyEuler.set(currentRotation.current.y, currentRotation.current.x, 0, 'YXZ');
      mouseQuat.setFromEuler(dummyEuler);
      quat.multiply(mouseQuat);

      const offset = new Vector3(config.offsetX, config.offsetY, config.offsetZ);
      offset.applyQuaternion(quat);
      vec3.add(offset);

      camera.position.copy(vec3);
      camera.quaternion.copy(quat);
    }
  });
}

function isBoneAttached(bone: Object3D, characterRoot: Object3D): boolean {
  let ancestor: Object3D | null = bone.parent;
  while (ancestor) {
    if (ancestor === characterRoot) return true;
    ancestor = ancestor.parent;
  }
  return false;
}

function findBone(character: Group, name: string): Bone | undefined {
  const found = character.getObjectByName(name);
  if (found && found instanceof Bone) {
    return found;
  }
  return undefined;
}
