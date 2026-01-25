import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import { Group } from 'three';

interface UseTPSCameraOptions {
  characterRef: React.MutableRefObject<Group | null> | null;
  enabled: boolean;
}

/**
 * Hook to handle Third Person Shooter (TPS) camera logic
 * Uses CameraControls to follow character with mouse look
 */
export function useTPSCamera({
  characterRef,
  enabled,
}: UseTPSCameraOptions) {
  const controlsRef = useRef<CameraControls>(null);
  const { gl } = useThree();

  // Handle Mouse Look for TPS
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => controlsRef.current?.rotate(-e.movementX * 0.002, -e.movementY * 0.002, true);
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [enabled]);

  // Handle Pointer Lock for TPS
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;

    const requestLock = async () => {
      if (document.pointerLockElement !== canvas) {
        try {
          await canvas.requestPointerLock();
        } catch (e) {
          console.log('Click canvas to lock pointer');
        }
      }
    };

    // Listen to Canvas click events to trigger locking
    const handleClick = () => requestLock();
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [enabled, gl.domElement]);

  // Auto-position camera behind character when switching to TPS mode
  useEffect(() => {
    if (enabled && characterRef?.current && controlsRef.current) {
      const charPos = characterRef.current.position;
      controlsRef.current.setLookAt(
        charPos.x, charPos.y + 3, charPos.z - 4,
        charPos.x, charPos.y, charPos.z,
        true
      );
    }
  }, [enabled, characterRef]);

  // Update camera to follow character
  useFrame(() => {
    if (!enabled || !controlsRef.current || !characterRef?.current) return;
    const { x, y, z } = characterRef.current.position;
    controlsRef.current.moveTo(x, y + 1, z, true);
  });

  return {
    controlsRef,
  };
}
