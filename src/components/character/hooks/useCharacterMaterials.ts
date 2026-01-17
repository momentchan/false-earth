import { useEffect, useRef, MutableRefObject } from 'react';
import * as THREE from 'three/webgpu';
import { Object3D, Group } from 'three';
import { BODY_MESH_NAMES } from '../constants';
import { useCharacterTextures } from './useCharacterTextures';
import { useCharacterHeightmap } from './useCharacterHeightmap';

export function useCharacterMaterials(clonedMesh: Object3D | null, heightmap?: THREE.StorageTexture | THREE.DataTexture, groupRef?: MutableRefObject<Group | null>) {
  // Load textures
  const { bodyTex, detailTex } = useCharacterTextures();

  // Track if materials have been assigned to prevent re-assignment
  const materialsAssignedRef = useRef(false);
  const lastBodyTexMapRef = useRef<THREE.Texture | null>(null);
  const lastDetailTexMapRef = useRef<THREE.Texture | null>(null);
  const lastHeightmapRef = useRef<THREE.StorageTexture | THREE.DataTexture | null>(null);
  const bodyMatRef = useRef<THREE.MeshStandardNodeMaterial | null>(null);
  const detailMatRef = useRef<THREE.MeshStandardNodeMaterial | null>(null);

  // Assign materials in useEffect to avoid re-cloning on texture changes
  useEffect(() => {
    if (!clonedMesh || !bodyTex.map || !detailTex.map) return;

    // Check if textures have actually changed
    const bodyTexChanged = lastBodyTexMapRef.current !== bodyTex.map;
    const detailTexChanged = lastDetailTexMapRef.current !== detailTex.map;
    const heightmapChanged = lastHeightmapRef.current !== heightmap;
    
    // Only reassign if textures changed or materials haven't been assigned yet
    if (materialsAssignedRef.current && !bodyTexChanged && !detailTexChanged && !heightmapChanged) {
      return;
    }

    // Create materials
    const bodyMat = new THREE.MeshStandardNodeMaterial({
      map: bodyTex.map,
      aoMap: bodyTex.aoMap,
      normalMap: bodyTex.normalMap,
      metalnessMap: bodyTex.metalnessMap,
    });

    const detailMat = new THREE.MeshStandardNodeMaterial({
      map: detailTex.map,
      aoMap: detailTex.aoMap,
      normalMap: detailTex.normalMap,
      metalnessMap: detailTex.metalnessMap,
    });

    // Store material refs
    bodyMatRef.current = bodyMat;
    detailMatRef.current = detailMat;

    // Assign materials based on mesh names
    clonedMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (BODY_MESH_NAMES.includes(child.name)) {
          child.material = bodyMat;
        } else if (!child.name.includes('Person')) {
          child.material = detailMat;
        } else {
          child.visible = false;
        }
      }
    });

    // Update refs to track current state
    materialsAssignedRef.current = true;
    lastBodyTexMapRef.current = bodyTex.map;
    lastDetailTexMapRef.current = detailTex.map;
    lastHeightmapRef.current = heightmap || null;
  }, [clonedMesh, bodyTex.map, bodyTex.aoMap, bodyTex.normalMap, bodyTex.metalnessMap, detailTex.map, detailTex.aoMap, detailTex.normalMap, detailTex.metalnessMap, heightmap]);

  // Apply heightmap displacement if materials are created
  // Note: This hook must be called unconditionally (React hooks rule)
  // It will only apply shader if heightmap and materials are available
  useCharacterHeightmap({
    heightmap,
    groupRef,
    bodyMat: bodyMatRef.current || ({} as THREE.MeshStandardNodeMaterial),
    detailMat: detailMatRef.current || ({} as THREE.MeshStandardNodeMaterial),
  });

  return { bodyTex, detailTex };
}
