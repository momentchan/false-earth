import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { createBladeGeometry, createGrassData } from "./core/grassGeometry";
import { createGrassMaterial } from "./core/grassMaterial";
import { DEFAULT_BLADES_PER_AXIS } from "./core/config";
import type { LODBufferConfig } from "./core/config";

interface GrassLODProps {
  grassParams: any;
  grassData: ReturnType<typeof createGrassData> | null;
  lodBuffer: LODBufferConfig;
  uniforms: Record<string, any>;
  trailTexture?: THREE.StorageTexture | null;
}

export function GrassLOD({
  grassParams,
  grassData,
  lodBuffer,
  uniforms,
}: GrassLODProps) {

  const { scene } = useThree();
  const bladesPerAxis = DEFAULT_BLADES_PER_AXIS;

  const mesh = useMemo(() => {
    if (!grassData || !lodBuffer) {
      return null;
    }

    const grassBlades = bladesPerAxis * bladesPerAxis;

    const bladeGeometry = createBladeGeometry(lodBuffer.segments);
    bladeGeometry.setIndirect(lodBuffer.drawBuffer);

    // Get debug color from LOD config
    const lodDebugColor = lodBuffer.debugColor 
      ? new THREE.Color(...lodBuffer.debugColor)
      : new THREE.Color(1, 1, 0);

    const { material } = createGrassMaterial(
      grassData,
      lodBuffer.indices,
      uniforms,
      lodDebugColor,
    );

    // Get environment map from scene if available
    if (scene.environment) {
      material.envMap = scene.environment;
    }

    const mesh = new THREE.Mesh(bladeGeometry, material);
    mesh.count = grassBlades;
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    mesh.castShadow = false;

    return mesh;
  }, [
    bladesPerAxis,
    grassData,
    lodBuffer,
    uniforms,
    scene.environment,
  ]);

  // Update material properties
  useEffect(() => {
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardNodeMaterial;
    mat.roughness = grassParams.roughness ?? 0.3;
    mat.metalness = grassParams.metalness ?? 0.5;
    mat.emissive = new THREE.Color(grassParams.emissive);
    mat.envMapIntensity = grassParams.envMapIntensity ?? 0.5;
  }, [mesh, grassParams.roughness, grassParams.metalness, grassParams.emissive, grassParams.envMapIntensity]);

  // Cleanup geometry and material when mesh is removed
  useEffect(() => {
    if (!mesh) return;
    return () => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshStandardNodeMaterial;
        mat.dispose();
      }
    };
  }, [mesh]);

  if (!mesh) return null;

  return <primitive object={mesh} />;
}

