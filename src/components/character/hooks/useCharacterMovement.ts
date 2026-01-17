import { useFrame } from '@react-three/fiber';
import { MutableRefObject } from 'react';
import * as THREE from 'three/webgpu';
import { Group } from 'three';
import { CharacterState } from '../types';
import { AnimationAction } from 'three';

interface UseCharacterMovementParams {
  groupRef: MutableRefObject<Group | null>;
  state: MutableRefObject<CharacterState>;
  actions: {
    [key: string]: AnimationAction | null;
  };
}

export function useCharacterMovement({ groupRef, state, actions }: UseCharacterMovementParams) {
  // Frame Loop: handle rotation, movement and blending logic
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const { isMoving, rotateLeft, rotateRight, maxSpeed, rotateSpeed } = state.current;

    // A. Handle rotation
    // If A is pressed, increase Y rotation; if D is pressed, decrease Y rotation
    if (rotateLeft) {
      groupRef.current.rotation.y += rotateSpeed * delta;
    }
    if (rotateRight) {
      groupRef.current.rotation.y -= rotateSpeed * delta;
    }

    // B. Handle speed (Lerp)
    const target = isMoving ? maxSpeed : 0;
    state.current.currentSpeed = THREE.MathUtils.lerp(
      state.current.currentSpeed, 
      target, 
      state.current.speedLerpFactor
    );
    const speed = state.current.currentSpeed;

    // C. Handle movement (TranslateZ)
    // translateZ automatically moves in the direction the object is facing based on rotation.y
    // Note: If the model moves backwards, change speed to -speed
    if (Math.abs(speed) > 0.01) {
      groupRef.current.translateZ(speed * delta);
    }

    // D. Handle animation blending with smooth weight transition
    const speedFactor = Math.min(speed / maxSpeed, 1);
    const targetIdleWeight = 1 - speedFactor;
    const targetWalkWeight = speedFactor;
    
    // Smoothly interpolate animation weights
    state.current.currentIdleWeight = THREE.MathUtils.lerp(
      state.current.currentIdleWeight,
      targetIdleWeight,
      state.current.animBlendLerpFactor
    );
    state.current.currentWalkWeight = THREE.MathUtils.lerp(
      state.current.currentWalkWeight,
      targetWalkWeight,
      state.current.animBlendLerpFactor
    );

    const idleAction = actions['Idle'];
    const walkAction = actions['Walk'];

    if (idleAction && walkAction) {
      // Apply smoothly interpolated weights
      idleAction.setEffectiveWeight(state.current.currentIdleWeight);
      walkAction.setEffectiveWeight(state.current.currentWalkWeight);
    }
  });
}
