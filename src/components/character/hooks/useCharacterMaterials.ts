import { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import { Object3D } from 'three';

const BODY_MESH_NAMES = [
  'Astronaut_Suit_Body_Detail_01_Mesh',
  'Astronaut_Suit_Body_Mesh',
  'Astronaut_Suit_Shoes_Mesh',
];

export function useCharacterMaterials(clonedMesh: Object3D | null) {
  // Load textures using useTexture hook
  const bodyTex = useTexture({
    map: 'textures/Body/Astronaut_Suit_Body_Albedo.png',
    metalnessMap: 'textures/Body/Astronaut_Suit_Body_Metallic.png',
    aoMap: 'textures/Body/Astronaut_Suit_Body_Ao.png',
    normalMap: 'textures/Body/Astronaut_Suit_Body_Normals.png'
  });
  bodyTex.map.colorSpace = THREE.SRGBColorSpace;

  const detailTex = useTexture({
    map: 'textures/Details/Astronaut_Suit_Details_Albedo.png',
    metalnessMap: 'textures/Details/Astronaut_Suit_Details_Metallic.png',
    aoMap: 'textures/Details/Astronaut_Suit_Details_Ao.png',
    normalMap: 'textures/Details/Astronaut_Suit_Details_Normals.png'
  });
  detailTex.map.colorSpace = THREE.SRGBColorSpace;

  // Assign materials in useEffect to avoid re-cloning on texture changes
  useEffect(() => {
    if (!clonedMesh || !bodyTex.map || !detailTex.map) return;

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

    // Assign materials based on mesh names
    clonedMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (BODY_MESH_NAMES.includes(child.name)) {
          child.material = bodyMat;
        } else if (!child.name.includes('Person')) {
          child.material = detailMat;
        }
      }
    });
  }, [clonedMesh, bodyTex, detailTex]);

  return { bodyTex, detailTex };
}
