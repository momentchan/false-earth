import { useEffect, useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Group, Object3D, AnimationClip } from 'three';

export function useCharacterPhysics(
  groupRef: MutableRefObject<Group | null>,
  scene: Object3D | null,
  animations: AnimationClip[]
) {
  // 1. Animation System - bind to scene (contains skeleton), not parent group
  const sceneRef = useRef<Object3D | null>(null);
  sceneRef.current = scene;
  const { actions } = useAnimations(animations, sceneRef);

  // 2. Physics State
  const state = useRef({
    speed: 0,
    isMoving: false,
    rotateLeft: false,
    rotateRight: false,
    idleWeight: 1.0,
    walkWeight: 0.0,
    maxSpeed: 1.0,
    rotateSpeed: 2.5,
    speedLerpFactor: 0.1,
    animBlendLerpFactor: 0.15,
  });

  // 3. Input Listeners
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      const key = e.key.toLowerCase();
      if (key === 'w') state.current.isMoving = isDown;
      if (key === 'a') state.current.rotateLeft = isDown;
      if (key === 'd') state.current.rotateRight = isDown;
    };
    const onDown = (e: KeyboardEvent) => handleKey(e, true);
    const onUp = (e: KeyboardEvent) => handleKey(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // 4. Initial Animation Start
  useEffect(() => {
    const idleAction = actions['Idle'];
    const walkAction = actions['Walk'];
    if (idleAction && walkAction) {
      idleAction.reset().play();
      walkAction.reset().play();
      idleAction.setEffectiveWeight(1.0);
      walkAction.setEffectiveWeight(0.0);
    }
  }, [actions]);

  // 5. Game Loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = state.current;

    // --- Rotation ---
    if (s.rotateLeft) {
      groupRef.current.rotation.y += s.rotateSpeed * delta;
    }
    if (s.rotateRight) {
      groupRef.current.rotation.y -= s.rotateSpeed * delta;
    }

    // --- Movement ---
    const targetSpeed = s.isMoving ? s.maxSpeed : 0;
    s.speed = THREE.MathUtils.lerp(s.speed, targetSpeed, s.speedLerpFactor);
    
    if (Math.abs(s.speed) > 0.01) {
      groupRef.current.translateZ(s.speed * delta);
    }

    // --- Animation Blending Logic ---
    
    // 1. Determine basic states
    const isWalking = Math.abs(s.speed) > 0.1;
    const isRotating = s.rotateLeft || s.rotateRight;
    const isTurningInPlace = isRotating && !isWalking;

    let targetIdle = 0;
    let targetWalk = 0;

    if (isWalking) {
      targetWalk = 1;
    } else if (isTurningInPlace) {
      targetWalk = 0.7;
      targetIdle = 0.3;
    } else {
      targetIdle = 1;
    }

    s.idleWeight = THREE.MathUtils.lerp(s.idleWeight, targetIdle, s.animBlendLerpFactor);
    s.walkWeight = THREE.MathUtils.lerp(s.walkWeight, targetWalk, s.animBlendLerpFactor);

    // 4. Apply weights
    actions['Idle']?.setEffectiveWeight(s.idleWeight);
    actions['Walk']?.setEffectiveWeight(s.walkWeight);
  });
}
