import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { createVATMaterial } from "./core/vatMaterial";
import type { RoseLODBufferConfig } from "./core/config";
import { useKTX2Texture } from "../../core/utils/useKTX2Texture";
import { ROSE_TEXTURES } from "./core/config";

interface RoseLODProps {
  count: number;
  lodBuffer: RoseLODBufferConfig;
  uniforms: Record<string, any>;
  vatData: ReturnType<typeof import('three/tsl').instancedArray>;
  config: any;
}

export function RoseLOD({
  count,
  lodBuffer,
  uniforms,
  vatData,
  config,
}: RoseLODProps) {
  const textures = useKTX2Texture(ROSE_TEXTURES);

  const mesh = useMemo(() => {
    if (!lodBuffer || !vatData || !textures.petal || !textures.outline || !textures.normal) {
      return null;
    }

    // Configure textures
    textures.petal.colorSpace = THREE.SRGBColorSpace;
    textures.normal.colorSpace = THREE.NoColorSpace;
    textures.normal.repeat.set(0.8, 1);
    textures.normal.offset.set(0.1, 0);

    // Get debug color from LOD config
    const lodDebugColor = lodBuffer.debugColor 
      ? new THREE.Color(...lodBuffer.debugColor)
      : new THREE.Color(1, 1, 0);

    const material = createVATMaterial(
      lodBuffer.posTex,
      lodBuffer.nrmTex,
      vatData,
      lodBuffer.indices,
      lodBuffer.meta,
      uniforms,
      textures.petal,
      textures.outline,
      textures.normal,
      lodDebugColor,
    );

    const mesh = new THREE.Mesh(lodBuffer.geometry, material);
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    mesh.castShadow = false;

    return mesh;
  }, [
    count,
    lodBuffer,
    vatData,
    uniforms,
    textures.petal,
    textures.outline,
    textures.normal,
  ]);

  // Update material properties
  useEffect(() => {
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardNodeMaterial;
    mat.roughness = config.roughness ?? 0.3;
    mat.metalness = config.metalness ?? 0.5;
  }, [mesh, config.roughness, config.metalness]);

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
