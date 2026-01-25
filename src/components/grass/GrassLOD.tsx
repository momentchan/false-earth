import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { createBladeGeometry, createGrassData, createPositions } from "./core/grassGeometry";
import { createGrassMaterial } from "./core/grassMaterial";
import { DEFAULT_BLADES_PER_AXIS } from "./core/config";
import type { LODBufferConfig } from "./core/config";
import { useGameStore } from "../../core/store/gameStore";

interface GrassLODProps {
  grassParams: any;
  grassData: ReturnType<typeof createGrassData> | null;
  positions: ReturnType<typeof createPositions> | null;
  lodBuffer: LODBufferConfig;
  uniforms: Record<string, any>;
  trailTexture?: THREE.StorageTexture | null;
}

export function GrassLOD({
  grassParams,
  grassData,
  positions,
  lodBuffer,
  uniforms,
}: GrassLODProps) {

  const bladesPerAxis = DEFAULT_BLADES_PER_AXIS;
  const { scene } = useThree();
  const terrainUniforms = useGameStore((state) => state.terrainUniforms);
  const waveStorageBuffer = useGameStore((state) => state.waveStorageBuffer);
  const activeWaveCount = useGameStore((state) => state.activeWaveCount);

  const mesh = useMemo(() => {
    if (!grassData || !positions || !lodBuffer) {
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
      positions,
      lodBuffer.indices,
      uniforms,
      terrainUniforms || undefined,
      lodDebugColor,
      waveStorageBuffer || undefined,
    );

    // Get environment map from scene if available
    if (scene.environment) {
      material.envMap = scene.environment;
    }

    const mesh = new THREE.Mesh(bladeGeometry, material);
    mesh.count = grassBlades;
    mesh.frustumCulled = false;

    return mesh;
  }, [
    bladesPerAxis,
    grassData,
    positions,
    lodBuffer,
    uniforms,
    terrainUniforms,
    waveStorageBuffer,
    scene.environment,
  ]);

  // Update active wave count uniform dynamically
  useEffect(() => {
    if (!mesh || !uniforms.uActiveWaveCount) return;
    uniforms.uActiveWaveCount.value = activeWaveCount;
  }, [mesh, uniforms, activeWaveCount]);

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

