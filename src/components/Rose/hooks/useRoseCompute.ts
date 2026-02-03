import { instancedArray, storage, struct, vec3, uniform } from "three/tsl";
import * as THREE from "three/webgpu";
import { vatStructure } from "../core/config";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createResetCompute, createSpawnCompute, createUpdateCompute, createVisibleIndicesBuffer } from "../core/vatCompute";
import { drawIndirectStructure } from "../../grass/core/config";
import { useFrame } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import { useThree } from "@react-three/fiber";

const BATCH_SIZE = 1024;

export function useRoseCompute(
    count: number,
    geometry: THREE.BufferGeometry | null,
    uniforms: Record<string, any>
) {
    const { gl, camera } = useThree()
    const computeRefs = useRef<{ reset: THREE.ComputeNode, spawn: THREE.ComputeNode, update: THREE.ComputeNode } | null>(null)

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

    const { vatData, visibleIndices } = useMemo(() => {
        // VAT Instance Data
        const vatDataArr = new Float32Array(count * 8); // 8 floats per instance (stride)
        const vatData = instancedArray(vatDataArr, vatStructure);
        const visibleIndices = createVisibleIndicesBuffer(count);
        return { vatData, visibleIndices }
    }, [count]);

    useEffect(() => {
        if (!geometry || !uniforms) return;

        // Indirect Draw Setup
        const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count
        const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(5), 5)
        const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
        geometry.setIndirect(drawBuffer)

        // Compute Shaders
        const resetCompute = createResetCompute(drawStorage, indexCount).setName('RoseReset')
        const spawnCompute = createSpawnCompute(vatData, spawnStorage, spawnUniforms, BATCH_SIZE, count).setName('RoseSpawn')
        const updateCompute = createUpdateCompute(drawStorage, visibleIndices, vatData, count, uniforms).setName('RoseUpdate')

        computeRefs.current = { reset: resetCompute, spawn: spawnCompute, update: updateCompute }
    }, [geometry, uniforms])

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

        renderer.compute(computeRefs.current.reset)
        renderer.compute(computeRefs.current.spawn)
        renderer.compute(computeRefs.current.update)

        spawnUniforms.uSpawnCount.value = 0
    })

    return {
        vatData,
        visibleIndices,
        spawn,
    }
}