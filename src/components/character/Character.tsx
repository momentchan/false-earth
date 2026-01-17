import { useRef, useEffect } from 'react';
import { Group } from 'three';
import { CharacterProps } from './types';
import {
  useCharacterState,
  useCharacterMesh,
  useCharacterMaterials,
  useCharacterAnimations,
  useCharacterControls,
  useCharacterMovement,
} from './hooks';

export function Character({ position = [0, 0, 0], scale = 1, heightmap }: CharacterProps) {
  const groupRef = useRef<Group>(null);
  
  // State management
  const state = useCharacterState();

  // Load and clone mesh
  const { clonedMesh } = useCharacterMesh();

  // Load and assign materials
  useCharacterMaterials(clonedMesh, heightmap, groupRef);

  // Setup animations
  const { actions } = useCharacterAnimations(groupRef);

  // Keyboard controls
  useCharacterControls(state);

  // Movement and animation blending
  useCharacterMovement({ groupRef, state, actions });

  // Add cloned mesh to group
  useEffect(() => {
    if (!groupRef.current || !clonedMesh) return;
    
    groupRef.current.clear();
    groupRef.current.add(clonedMesh);
  }, [clonedMesh]);

  return (
    <group ref={groupRef} position={position} scale={scale} dispose={null}>
      {clonedMesh && <primitive object={clonedMesh} />}
    </group>
  );
}
