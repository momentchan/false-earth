import { useRef } from 'react';
import { CharacterState } from '../types';

export function useCharacterState() {
  const state = useRef<CharacterState>({
    currentSpeed: 0,
    targetSpeed: 0,
    maxSpeed: 1.0, // Maximum movement speed
    rotateSpeed: 2.5, // Rotation speed (radians per second)
    speedLerpFactor: 0.1, // Speed transition smoothing (0-1, smaller = more inertia)
    animBlendLerpFactor: 0.15, // Animation blend smoothing (0-1, smaller = smoother blend)
    currentIdleWeight: 1.0, // Current idle animation weight
    currentWalkWeight: 0.0, // Current walk animation weight
    isMoving: false,
    rotateLeft: false, // Press A
    rotateRight: false, // Press D
  });

  return state;
}
