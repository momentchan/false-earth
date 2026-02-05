import { useEffect, useState } from "react";
import { storage } from "three/tsl";
import * as THREE from "three/webgpu";
import { extractGeometryFromScene, setupVATGeometry, preloadVATAssets } from "../core";
import type { RoseLODConfig, RoseLODBufferConfig, VATMeta } from "../core/config";
import { drawIndirectStructure } from "../../grass/core/config";
import { createVisibleIndicesBuffer } from "../core/vatCompute";

/**
 * Hook to load and setup multiple LOD levels for Rose VAT
 */
export function useRoseLODLoader(count: number, lodConfigs: RoseLODConfig[]) {
    const [lodBuffers, setLodBuffers] = useState<RoseLODBufferConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadAllLODs() {
            setIsLoading(true);
            const buffers: RoseLODBufferConfig[] = [];

            try {
                // Load all VAT data in parallel
                const loaders = await Promise.all(
                    lodConfigs.map(config => preloadVATAssets(config.metaPath))
                );

                if (cancelled) return;

                // Create LOD buffer configurations
                for (let i = 0; i < lodConfigs.length; i++) {
                    const config = lodConfigs[i];
                    const loader = loaders[i];

                    if (!loader.scene || !loader.meta || !loader.posTex || !loader.nrmTex) {
                        console.warn(`Failed to load VAT data for LOD ${i}: ${config.metaPath}`);
                        continue;
                    }

                    // Extract and setup geometry
                    const geometry = extractGeometryFromScene(loader.scene);
                    if (!geometry) {
                        console.warn(`Failed to extract geometry for LOD ${i}`);
                        continue;
                    }

                    setupVATGeometry(geometry as any, loader.meta as VATMeta);

                    // Setup indirect draw buffer
                    const indexCount = geometry.index 
                        ? geometry.index.count 
                        : geometry.attributes.position.count;

                    const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(5), 5);
                    const drawStorage = storage(drawBuffer, drawIndirectStructure, 1);
                    geometry.setIndirect(drawBuffer);

                    // Create visible indices buffer for this LOD
                    const indices = createVisibleIndicesBuffer(count);

                    buffers.push({
                        ...config,
                        geometry,
                        posTex: loader.posTex,
                        nrmTex: loader.nrmTex,
                        meta: loader.meta,
                        indices,
                        drawBuffer,
                        drawStorage,
                        vertexCount: indexCount,
                    });
                }

                if (!cancelled) {
                    setLodBuffers(buffers);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error loading Rose LOD data:', error);
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadAllLODs();

        return () => {
            cancelled = true;
            // Cleanup geometries
            lodBuffers.forEach(buffer => {
                buffer.geometry.dispose();
            });
        };
    }, [count, JSON.stringify(lodConfigs.map(c => c.metaPath))]);

    return {
        lodBuffers,
        isLoading,
    };
}
