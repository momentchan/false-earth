import { useEffect, useRef, MutableRefObject, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Group, Vector3, Quaternion, Bone, Euler, Object3D, MathUtils } from 'three';
import { useControls } from 'leva';
// Import Store
import { useGameStore, CameraMode } from '../../store/gameStore';

type Props = {
  characterRef: MutableRefObject<Group | null>;
  boneName?: string;
};

export function CameraViewControl({ characterRef, boneName = 'head' }: Props) {
  const controlsRef = useRef<CameraControls>(null);
  const { gl, camera } = useThree();

  // Read mode directly from Store
  const cameraMode = useGameStore((state) => state.cameraMode);

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

  const targetBone = useRef<Bone | undefined>(undefined);
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });

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

  // Input Handling: Only handle view side effects (Pointer Lock)
  useEffect(() => {
    if (cameraMode === CameraMode.TPS) gl.domElement.requestPointerLock();
    else document.exitPointerLock();
  }, [cameraMode, gl.domElement]);

  // Handle Mouse Look for TPS
  useEffect(() => {
    if (cameraMode !== CameraMode.TPS) return;
    const onMove = (e: MouseEvent) => controlsRef.current?.rotate(-e.movementX * 0.002, -e.movementY * 0.002, true);
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [cameraMode]);

  // Handle Mouse Look for FPV
  useEffect(() => {
    if (cameraMode !== CameraMode.FPV) return;

    const onMove = (e: MouseEvent) => {
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      const ndcY = (e.clientY / window.innerHeight) * 2 - 1;

      targetRotation.current.x = MathUtils.degToRad(MathUtils.mapLinear(ndcX, -1, 1, 150, -150));
      targetRotation.current.y = MathUtils.degToRad(MathUtils.mapLinear(ndcY, -1, 1, 90, -30));
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [cameraMode]);

  // Auto-position camera behind character when switching to TPS mode
  useEffect(() => {
    if (cameraMode === CameraMode.TPS && characterRef.current && controlsRef.current) {
      const charPos = characterRef.current.position;
      controlsRef.current.setLookAt(
        charPos.x, charPos.y + 3, charPos.z - 4,
        charPos.x, charPos.y, charPos.z,
        true
      );
    }
  }, [cameraMode]);


  useFrame(() => {
    if (!characterRef.current) return;

    // === FPV MODE ===
    if (cameraMode === CameraMode.FPV) {
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
        // currentRotation.x is yaw (horizontal), currentRotation.y is pitch (vertical)
        dummyEuler.set(currentRotation.current.y, currentRotation.current.x, 0, 'YXZ');
        mouseQuat.setFromEuler(dummyEuler);
        quat.multiply(mouseQuat);

        const offset = new Vector3(config.offsetX, config.offsetY, config.offsetZ);
        offset.applyQuaternion(quat);
        vec3.add(offset);

        camera.position.copy(vec3);
        camera.quaternion.copy(quat);
      }
      return;
    }

    // === TPS MODE ===
    if (cameraMode === CameraMode.TPS && controlsRef.current) {
      const { x, y, z } = characterRef.current.position;
      controlsRef.current.moveTo(x, y + 1, z, true);
    }
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={cameraMode !== CameraMode.FPV}
      minDistance={2}
      maxDistance={20}
      // minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2}
      dampingFactor={0.05}
    />
  );
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