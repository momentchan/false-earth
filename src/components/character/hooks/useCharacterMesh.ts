import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Object3D } from 'three';

export function useCharacterMesh() {
  // Load the character mesh
  const mesh = useLoader(FBXLoader, '/models/Astronaut_Pilot_Mesh.FBX');

  // Clone mesh only when mesh changes (not when textures change)
  const clonedMesh = useMemo<Object3D | null>(() => {
    if (!mesh) return null;
    const cloned = SkeletonUtils.clone(mesh);
    cloned.scale.setScalar(1);
    return cloned;
  }, [mesh]);

  return { mesh, clonedMesh };
}
