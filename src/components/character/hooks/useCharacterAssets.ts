import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, float, positionLocal, modelWorldMatrix, cameraViewMatrix, cameraProjectionMatrix } from 'three/tsl';
import { getTerrainHeight } from '../../terrain/terrainHelpers';
import { TerrainUniforms } from '../../terrain/types';
import { BODY_MESH_NAMES } from '../constants';

export function useCharacterAssets(terrainUniforms?: TerrainUniforms, uWorldPos?: any) {
  const mesh = useLoader(FBXLoader, '/models/Astronaut_Pilot_Mesh.FBX');
  const idleAnim = useLoader(FBXLoader, '/models/Idle.fbx');
  const walkAnim = useLoader(FBXLoader, '/models/Walking.fbx');

  const bodyTex = useTexture({
    map: 'textures/Body/Astronaut_Suit_Body_Albedo.png',
    metalnessMap: 'textures/Body/Astronaut_Suit_Body_Metallic.png',
    aoMap: 'textures/Body/Astronaut_Suit_Body_Ao.png',
    normalMap: 'textures/Body/Astronaut_Suit_Body_Normals.png',
  });
  bodyTex.map.colorSpace = THREE.SRGBColorSpace;

  const detailTex = useTexture({
    map: 'textures/Details/Astronaut_Suit_Details_Albedo.png',
    metalnessMap: 'textures/Details/Astronaut_Suit_Details_Metallic.png',
    aoMap: 'textures/Details/Astronaut_Suit_Details_Ao.png',
    normalMap: 'textures/Details/Astronaut_Suit_Details_Normals.png',
  });
  detailTex.map.colorSpace = THREE.SRGBColorSpace;

  const { scene, animations } = useMemo(() => {
    if (!mesh || !bodyTex.map || !detailTex.map) return { scene: null, animations: [] };

    const clonedScene = SkeletonUtils.clone(mesh);

    // --- TSL Terrain Logic (baked into materials from the start) ---
    let vertexNode: any = null;
    if (terrainUniforms) {
      const terrainHeightFn = getTerrainHeight(
        terrainUniforms.uTerrainAmp,
        terrainUniforms.uTerrainFreq,
        terrainUniforms.uTerrainSeed
      );

      vertexNode = Fn(() => {
        // Standard vertex transform
        const worldPos = modelWorldMatrix.mul(vec4(positionLocal, float(1.0))).xyz;
        
        // Calculate Terrain Height at the GROUP'S position (not vertex position)
        // This ensures the whole character moves up/down as one unit
        const th = terrainHeightFn(uWorldPos.xz);
        
        const displacedPos = vec3(worldPos.x, worldPos.y.add(th), worldPos.z);
        const viewPos = cameraViewMatrix.mul(vec4(displacedPos, float(1.0)));
        return cameraProjectionMatrix.mul(viewPos);
      })();
    }

    // --- Material Setup ---
    const bodyMat = new THREE.MeshStandardNodeMaterial({
      map: bodyTex.map,
      aoMap: bodyTex.aoMap,
      normalMap: bodyTex.normalMap,
      metalnessMap: bodyTex.metalnessMap,
    });
    if (vertexNode) {
      bodyMat.vertexNode = vertexNode;
    }

    const detailMat = new THREE.MeshStandardNodeMaterial({
      map: detailTex.map,
      aoMap: detailTex.aoMap,
      normalMap: detailTex.normalMap,
      metalnessMap: detailTex.metalnessMap,
      metalness: 0.8,
      roughness: 0.3,
    });

    if (vertexNode) {
      detailMat.vertexNode = vertexNode;
    }

    // Assign materials based on mesh names
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.frustumCulled = false;
        if (BODY_MESH_NAMES.includes(child.name)) {
          child.material = bodyMat;
        } else if (!child.name.includes('Person')) {
          child.material = detailMat;
        } else {
          child.visible = false;
        }
      }
    });

    // --- Animations Setup ---
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

    return { scene: clonedScene, animations: anims };
  }, [mesh, idleAnim, walkAnim, bodyTex.map, bodyTex.aoMap, bodyTex.normalMap, bodyTex.metalnessMap, detailTex.map, detailTex.aoMap, detailTex.normalMap, detailTex.metalnessMap, terrainUniforms, uWorldPos]);

  return { scene, animations };
}
