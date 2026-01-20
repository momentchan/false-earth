import { useEffect, useRef, useState, MutableRefObject, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Group, Vector3, Quaternion, Bone, Euler, Object3D, MathUtils } from 'three';
import { useControls } from 'leva';

// Define three camera modes
export enum CameraMode {
  TPS = 0,
  FREE = 1,
  FPV = 2,
}

type Props = {
  characterRef: MutableRefObject<Group | null>;
  boneName?: string;
  onModeChange?: (mode: CameraMode) => void;
};

export function CameraViewControl({ characterRef, boneName = 'head', onModeChange }: Props) {
  const controlsRef = useRef<CameraControls>(null);
  const [mode, setMode] = useState<CameraMode>(CameraMode.TPS);
  const { gl, camera } = useThree();

  // Notify parent when mode changes
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const { vec3, quat, quatOffset, quatBone, quatLookForward, modelCorrectionQuat, dummyEuler } = useMemo(() => ({
    vec3: new Vector3(),
    quat: new Quaternion(),
    quatOffset: new Quaternion(),
    quatBone: new Quaternion(),
    quatLookForward: new Quaternion(),
    modelCorrectionQuat: new Quaternion().setFromEuler(new Euler(0, Math.PI, 0, 'YXZ')),
    dummyEuler: new Euler(),
  }), []);

  const targetBone = useRef<Bone | undefined>(undefined);

  const config = useControls('FPV Settings', {
    rotateX: { value: -90, min: -180, max: 180, step: 1 },
    rotateY: { value: -90, min: -180, max: 180, step: 1 },
    rotateZ: { value: 0, min: -180, max: 180, step: 1 },
    offsetX: { value: 0, min: -2, max: 2, step: 0.01 },
    offsetY: { value: 0.7, min: -2, max: 2, step: 0.01 },
    offsetZ: { value: -0.2, min: -2, max: 2, step: 0.01 },
    smoothing: { value: 0.97, min: 0, max: 1, step: 0.01 },
  }, { collapsed: true });

  // Input Handling (Mode Switching) ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') setMode((m) => (m + 1) % 3);
    };

    if (mode === CameraMode.TPS) gl.domElement.requestPointerLock();
    else document.exitPointerLock();

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, gl.domElement]);

  // Handle Mouse Look for TPS
  useEffect(() => {
    if (mode !== CameraMode.TPS) return;
    const onMove = (e: MouseEvent) => controlsRef.current?.rotate(-e.movementX * 0.002, -e.movementY * 0.002, true);
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [mode]);

  // Auto-position camera behind character when switching to TPS mode
  useEffect(() => {
    if (mode === CameraMode.TPS && characterRef.current && controlsRef.current) {
      const charPos = characterRef.current.position;
      controlsRef.current.setLookAt(
        charPos.x, charPos.y + 3, charPos.z - 4,
        charPos.x, charPos.y, charPos.z,
        true
      );
    }
  }, [mode]); // Listen to mode changes


  useFrame(() => {
    if (!characterRef.current) return;

    // === FPV MODE ===
    if (mode === CameraMode.FPV) {
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

        quat.copy(quatBone).slerp(quatLookForward, config.smoothing);

        const offset = new Vector3(config.offsetX, config.offsetY, config.offsetZ);
        offset.applyQuaternion(quat);
        vec3.add(offset);

        camera.position.copy(vec3);
        camera.quaternion.copy(quat);
      }
      return;
    }

    // === TPS MODE ===
    if (mode === CameraMode.TPS && controlsRef.current) {
      const { x, y, z } = characterRef.current.position;
      controlsRef.current.moveTo(x, y + 1, z, true);
    }
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={mode !== CameraMode.FPV}
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
    console.log('FPV Camera attached to:', found.name);
    return found;
  }
  return undefined;
}