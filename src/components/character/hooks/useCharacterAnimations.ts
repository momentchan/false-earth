import { useEffect, useMemo, RefObject } from 'react';
import { useLoader } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as THREE from 'three/webgpu';
import { Group } from 'three';

export function useCharacterAnimations(groupRef: RefObject<Group | null>) {
  // Load animation files
  const idleAnim = useLoader(FBXLoader, '/models/Idle.fbx');
  const walkAnim = useLoader(FBXLoader, '/models/Walking.fbx');

  // Prepare animation clips with renamed clips (key step)
  const { animations } = useMemo(() => {
    const anims: THREE.AnimationClip[] = [];
    if (idleAnim && idleAnim.animations && idleAnim.animations.length > 0) {
      const clip = idleAnim.animations[0].clone();
      clip.name = 'Idle';
      anims.push(clip);
    }
    if (walkAnim && walkAnim.animations && walkAnim.animations.length > 0) {
      const clip = walkAnim.animations[0].clone();
      clip.name = 'Walk';
      anims.push(clip);
    }
    return { animations: anims };
  }, [idleAnim, walkAnim]);

  // Animation system
  const { actions } = useAnimations(animations, groupRef);

  // Initialize animations (set weights)
  useEffect(() => {
    const idleAction = actions['Idle'];
    const walkAction = actions['Walk'];

    if (idleAction && walkAction) {
      // Play both animations simultaneously
      idleAction.reset().play();
      walkAction.reset().play();

      // Initial state: completely idle
      idleAction.setEffectiveWeight(1.0);
      walkAction.setEffectiveWeight(0.0);
    }
  }, [actions]);

  return { actions };
}
