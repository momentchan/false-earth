import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Group, Object3D, AnimationClip } from 'three';
import { CharacterInputState } from './useCharacterInput';
import { calculateBlendWeights } from './calculateBlendWeights';


export type StepType = 'walk' | 'run'
export interface StepEvent{
  type: StepType;
  volume: number;
}


export function useCharacterPhysics(
  groupRef: MutableRefObject<Group | null>,
  scene: Object3D | null,
  animations: AnimationClip[],
  input: CharacterInputState,
  onStep: (event: StepEvent) => void
) {
  const sceneRef = useRef<Object3D | null>(null);
  sceneRef.current = scene;
  const { actions } = useAnimations(animations, sceneRef);

  const animState = useRef({
    lastWalkTime: 0,
    lastRunTime: 0
  });

  // Physics State
  const state = useRef({
    speed: 0,
    rotationVelocity: 0, // Current smoothed rotation velocity
    // Animation weights
    idleWeight: 1.0,
    walkWeight: 0.0,
    runWeight: 0.0,
    // Parameters
    walkSpeed: 1.0,
    runSpeed: 3.5,
    rotateSpeed: 2.5,
    speedLerpFactor: 0.1,
    rotationLerpFactor: 0.15, // Smoothing factor for rotation
    animBlendLerpFactor: 0.15,
  });


  // Initial Animation Start
  useEffect(() => {
    ['Idle', 'Walk', 'Run'].forEach(name => {
      const action = actions[name];
      if (action) {
        action.reset().play();
        action.setEffectiveWeight(name === 'Idle' ? 1.0 : 0.0);
      }
    });
  }, [actions]);

  // Game Loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = state.current;

    // --- Rotation ---
    let targetRotationVelocity = 0;
    if (input.rotateLeft) {
      targetRotationVelocity = s.rotateSpeed;
    } else if (input.rotateRight) {
      targetRotationVelocity = -s.rotateSpeed;
    }
    
    s.rotationVelocity = THREE.MathUtils.lerp(s.rotationVelocity, targetRotationVelocity, s.rotationLerpFactor);
    
    if (Math.abs(s.rotationVelocity) > 0.001) {
      groupRef.current.rotation.y += s.rotationVelocity * delta;
    }

    // --- Movement Calculation ---
    const currentMaxSpeed = input.run ? s.runSpeed : s.walkSpeed;
    const targetSpeed = input.moveForward ? currentMaxSpeed : 0;
    
    s.speed = THREE.MathUtils.lerp(s.speed, targetSpeed, s.speedLerpFactor);
    
    if (Math.abs(s.speed) > 0.01) {
      groupRef.current.translateZ(s.speed * delta);
    }

    // --- Animation Blending Logic (Blend Tree) ---
    const isRotating = input.rotateLeft || input.rotateRight;

    const targetWeights = calculateBlendWeights(
      s.speed,
      isRotating,
      s.walkSpeed,
      s.runSpeed
    );

    // Apply smooth weight transitions
    s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, targetWeights.idle, s.animBlendLerpFactor);
    s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, targetWeights.walk, s.animBlendLerpFactor);
    s.runWeight = THREE.MathUtils.lerp(s.runWeight, targetWeights.run, s.animBlendLerpFactor);

    actions['Idle']?.setEffectiveWeight(s.idleWeight);
    actions['Walk']?.setEffectiveWeight(s.walkWeight);
    actions['Run']?.setEffectiveWeight(s.runWeight);


    const walkAction = actions['Walk'];
    if (walkAction && s.walkWeight > 0.5) {
      // Get normalized time (0 to 1)
      const duration = walkAction.getClip().duration;
      const time = (walkAction.time % duration) / duration;

      [0.05, 0.55].forEach(threshold => {
        if (animState.current.lastWalkTime < threshold && time >= threshold) {
          onStep?.({ type: 'walk', volume: s.walkWeight });
        }
      });
      animState.current.lastWalkTime = time;
    }

    // 2. Check Run
    const runAction = actions['Run'];
    if (runAction && s.runWeight > 0.5) {
      const duration = runAction.getClip().duration;
      const time = (runAction.time % duration) / duration;
      
      [0.1, 0.6].forEach(threshold => {
        if (animState.current.lastRunTime < threshold && time >= threshold) {
          onStep?.({ type: 'run', volume: s.runWeight});
        }
      });
      animState.current.lastRunTime = time;
    }
  });
}
