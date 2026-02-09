import { instancedArray, storage, struct, vec3, uniform } from "three/tsl";
import * as THREE from "three/webgpu";
import { vatStructure } from "../core/config";
import type { RoseLODBufferConfig } from "../core/config";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createResetCountCompute, createResetInstanceCompute, createSpawnCompute, createUpdateCompute } from "../core/vatCompute";
import { useFrame } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import { useThree } from "@react-three/fiber";

const BATCH_SIZE = 1024;

export function useRoseCompute(
    count: number,
    lodBuffers: RoseLODBufferConfig[],
    uniforms: Record<string, any>
) {
    const { gl, camera } = useThree()
    const computeRefs = useRef<{ resetCount: THREE.ComputeNode[], resetInstance: THREE.ComputeNode, spawn: THREE.ComputeNode, update: THREE.ComputeNode } | null>(null)

    const spawnUniforms = useMemo(() => ({
        uSpawnPos: uniform(vec3(0)),
        uSpawnCount: uniform(0),    // Number of instances to spawn (0-64)
        uSpawnRadius: uniform(0.5), // Scatter radius around spawn position
    }), [])

    const spawnStorage = useMemo(() => {
        const spawnStateStruct = struct({
            index: { type: 'uint', atomic: true }
        })
        const buffer = new THREE.StorageBufferAttribute(new Uint32Array([0]), 1)
        return storage(buffer, spawnStateStruct, 1)
    }, [])

    const { vatData } = useMemo(() => {
        // VAT Instance Data
        const vatDataArr = new Float32Array(count * 8); // 8 floats per instance (stride)
        const vatData = instancedArray(vatDataArr, vatStructure);
        return { vatData }
    }, [count]);

    useEffect(() => {
        if (!lodBuffers.length || !uniforms) return;

        // Compute Shaders - one reset per LOD, shared spawn/update
        const resetCountComputes = lodBuffers.map((lodBuffer, index) => {
            return createResetCountCompute(lodBuffer.drawStorage, lodBuffer.vertexCount).setName(`RoseReset_LOD${index}`)
        })

        const spawnCompute = createSpawnCompute(vatData, spawnStorage, spawnUniforms, BATCH_SIZE, count).setName('RoseSpawn')
        const resetInstanceCompute = createResetInstanceCompute(vatData, count).setName('RoseResetInstance')
        const updateCompute = createUpdateCompute(lodBuffers, vatData, count, uniforms).setName('RoseUpdate')

        computeRefs.current = { resetCount: resetCountComputes, resetInstance: resetInstanceCompute, spawn: spawnCompute, update: updateCompute }

        return () => {
            computeRefs.current = null
        }
    }, [lodBuffers, uniforms, vatData, spawnStorage, spawnUniforms, count])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'x') {
                const renderer = gl as unknown as WebGPURenderer
                if (!computeRefs.current) return
                renderer.compute(computeRefs.current.resetInstance)
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [computeRefs.current])

    const spawn = useCallback((pos: THREE.Vector3, amount: number = 1, radius: number = 0.5) => {
        spawnUniforms.uSpawnPos.value.copy(pos);
        spawnUniforms.uSpawnCount.value = Math.min(amount, BATCH_SIZE);
        spawnUniforms.uSpawnRadius.value = radius;
    }, [spawnUniforms]);

    useFrame(() => {
        const renderer = gl as unknown as WebGPURenderer
        if (!computeRefs.current) return

        uniforms.uViewProjectionMatrix.value.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        )
        uniforms.uCameraPosition.value.copy(camera.position)

        // Reset all LOD buffers
        computeRefs.current.resetCount.forEach(resetCountCompute => {
            renderer.compute(resetCountCompute)
        })

        renderer.compute(computeRefs.current.spawn)
        renderer.compute(computeRefs.current.update)

        spawnUniforms.uSpawnCount.value = 0
    })

    return {
        vatData,
        spawn,
    }
}