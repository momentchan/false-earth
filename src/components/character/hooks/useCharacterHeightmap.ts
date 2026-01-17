import { useRef, useEffect, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { Group } from 'three';
import { Fn, vec2, vec3, vec4, float, positionLocal, modelWorldMatrix, cameraViewMatrix, cameraProjectionMatrix, texture, oneMinus, uniform } from 'three/tsl';
import { DEFAULT_GRASS_AREA_SIZE } from '../../grass/core/constants';
import { useGridSnapping } from '../../terrain/useGridSnapping';

export interface UseCharacterHeightmapParams {
  heightmap?: THREE.StorageTexture | THREE.DataTexture;
  groupRef?: MutableRefObject<Group | null>;
  bodyMat: THREE.MeshStandardNodeMaterial | null;
  detailMat: THREE.MeshStandardNodeMaterial | null;
}

/**
 * Hook to handle heightmap-based vertex displacement for character
 * Updates uniforms and applies vertex shader node for terrain height sampling
 */
export function useCharacterHeightmap({
  heightmap,
  groupRef,
  bodyMat,
  detailMat,
}: UseCharacterHeightmapParams) {
  // Create uniforms for shader computation
  const uGroupWorldPosRef = useRef(uniform(new THREE.Vector3(0, 0, 0)));
  const uCameraPosRef = useRef(uniform(new THREE.Vector3(0, 0, 0)));
  const uGridCellSizeRef = useRef(uniform(0));
  const lastHeightmapRef = useRef<THREE.StorageTexture | THREE.DataTexture | null>(null);

  // Use grid snapping to get grid cell size
  const { camera } = useThree();
  const { gridCellSize } = useGridSnapping({
    camera,
    grassAreaSize: DEFAULT_GRASS_AREA_SIZE,
    onSnap: () => {
      // Not needed - all computation in shader
    },
  });

  // Apply vertex shader node for heightmap displacement when materials and texture are available
  useEffect(() => {
    if (!heightmap || !bodyMat || !detailMat) return;
    
    // Check if heightmap changed
    const heightmapChanged = lastHeightmapRef.current !== heightmap;
    if (lastHeightmapRef.current && !heightmapChanged) return;

    const uGroupWorldPos = uGroupWorldPosRef.current;
    const uCameraPos = uCameraPosRef.current;
    const uGridCellSize = uGridCellSizeRef.current;

    const vertexNodeFn = Fn(() => {
      const worldPos = modelWorldMatrix.mul(vec4(positionLocal, float(1.0))).xyz;
      
      // Compute snapped position from camera position and grid cell size
      const cameraXZ = uCameraPos.xz;
      const gridCellSize = float(uGridCellSize);
      const currentCellXZ = cameraXZ.div(gridCellSize).floor();
      const snappedPos = currentCellXZ.mul(gridCellSize);
      
      // Calculate offset using group world position: groupWorldPos.xz - snappedPos
      const groupWorldXZ = uGroupWorldPos.xz;
      const offsetXZ = groupWorldXZ.sub(snappedPos);
      
      // Calculate UV coordinates using offset for sampling
      const grassAreaSize = float(DEFAULT_GRASS_AREA_SIZE);
      const uvCoord = offsetXZ.div(grassAreaSize).add(vec2(0.5));
      const uvCoordInverted = vec2(uvCoord.x, oneMinus(uvCoord.y));
      
      const heightmapSample = texture(heightmap, uvCoordInverted);
      const terrainHeight = heightmapSample.r;
      
      const displacedWorldPos = vec3(worldPos.x, worldPos.y.add(terrainHeight), worldPos.z);

      const viewPos = cameraViewMatrix.mul(vec4(displacedWorldPos, float(1.0)));
      return cameraProjectionMatrix.mul(viewPos);
    });
    
    bodyMat.vertexNode = vertexNodeFn();
    detailMat.vertexNode = vertexNodeFn();
    
    lastHeightmapRef.current = heightmap;
  }, [heightmap, bodyMat, detailMat]);

  // Update uniforms every frame (group world position, camera position and grid cell size)
  useFrame(() => {
    if (groupRef?.current && uGroupWorldPosRef.current && uCameraPosRef.current && uGridCellSizeRef.current) {
      // Update group world position uniform
      groupRef.current.updateMatrixWorld(true);
      const groupWorldPos = new THREE.Vector3();
      groupWorldPos.setFromMatrixPosition(groupRef.current.matrixWorld);
      uGroupWorldPosRef.current.value.set(groupWorldPos.x, groupWorldPos.y, groupWorldPos.z);
      
      // Update camera position uniform
      uCameraPosRef.current.value.set(camera.position.x, camera.position.y, camera.position.z);
      
      // Update grid cell size uniform
      uGridCellSizeRef.current.value = gridCellSize;
    }
  });
}
