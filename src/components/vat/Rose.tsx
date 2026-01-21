import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { storage, uniform, vec3, instancedArray, struct } from "three/tsl";
import { useVATPreloader } from "./VATPreloader";
import { extractGeometryFromScene, setupVATGeometry } from "./utils";
import { createVATMaterial } from "./materials/vatNodeMaterial";
import { drawIndirectStructure } from "../grass/core/constants";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGPURenderer } from 'three/webgpu'
import { vatStructure } from "./constant";
import { createUpdateCompute, createResetCompute, createSpawnCompute, createVisibleIndicesBuffer } from "./roseCompute";

// Define API exposed to parent component
export type RoseHandle = {
    spawn: (pos: THREE.Vector3) => void
}

const Rose = forwardRef<RoseHandle, { count: number }>(({ count }, ref) => {
    const gl = useThree((state) => state.gl)
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')
    const groupRef = useRef<THREE.Group>(null)

    const [config] = useControls('Rose', () => ({
        Render: folder({
            Green: { value: '#325825' },
        }),
        Lifecycle: folder({
            DelayMin: { value: 0, min: 0, max: 10, step: 0.1 },
            DelayMax: { value: 0, min: 0, max: 10, step: 0.1 },
            GrowMin: { value: 2, min: 0, max: 10, step: 0.1 },
            GrowMax: { value: 3, min: 0, max: 10, step: 0.1 },
            KeepMin: { value: 2, min: 0, max: 10, step: 0.1 },
            KeepMax: { value: 2, min: 0, max: 10, step: 0.1 },
            DieMin: { value: 2, min: 0, max: 10, step: 0.1 },
            DieMax: { value: 3, min: 0, max: 10, step: 0.1 },
        }),
    }))

    const uniforms = useMemo(() => ({
        uGreen: uniform(vec3(0.6, 0.9, 0.6)),
    }), [])

    // Compute uniforms (can have more settings in the future)
    const computeUniforms = useMemo(() => ({
        uDelayMin: uniform(0.1),
        uDelayMax: uniform(0.3),
        uGrowMin: uniform(0.3),
        uGrowMax: uniform(0.8),
        uKeepMin: uniform(1.0),
        uKeepMax: uniform(2.0),
        uDieMin: uniform(0.2),
        uDieMax: uniform(0.5),
    }), [])

    const petalTex = useTexture('/textures/Rose/Rose_Petal_Diff.png')
    petalTex.colorSpace = THREE.SRGBColorSpace
    const outlineTex = useTexture('/textures/Rose/Rose_Outline.png')
   
    const spawnUniforms = useMemo(() => ({
        uSpawnPos: uniform(vec3(0)),
        uDoSpawn: uniform(0), // 0=no spawn, 1=spawn
    }), [])

    const spawnStorage = useMemo(() => {
        const spawnStateStruct = struct({
            index: { type: 'uint', atomic: true }
        })
        const buffer = new THREE.StorageBufferAttribute(new Uint32Array([0]), 1)
        return storage(buffer, spawnStateStruct, 1)
    }, [])

    // Expose spawn method to parent component
    useImperativeHandle(ref, () => ({
        spawn: (pos: THREE.Vector3) => {
            // Directly write to uniform, bypassing React State
            spawnUniforms.uSpawnPos.value.copy(pos)
            spawnUniforms.uDoSpawn.value = 1
        }
    }), [spawnUniforms])


    // Initialize data buffer
    const vatData = useMemo(() => {
        // Calculate total size: position(vec3=3) + isActive(1) + frame(1) + startTime(1) + seed(1) = 7 floats per instance
        const data = new Float32Array(count * 7)

        for (let i = 0; i < count; i++) {
            const stride = 7
            // Position (x, y, z)
            data[i * stride + 0] = 0  
            data[i * stride + 1] = 0
            data[i * stride + 2] = 0
            // isActive
            data[i * stride + 3] = 0
            // Frame
            data[i * stride + 4] = 0
            // Start Time
            data[i * stride + 5] = 0.0
            // Seed
            data[i * stride + 6] = 0.0
        }
        return instancedArray(data, vatStructure)
    }, [count])

    const computeRefs = useRef<{ reset: THREE.ComputeNode, spawn: THREE.ComputeNode, update: THREE.ComputeNode } | null>(null)

    useEffect(() => {
        if (!groupRef.current || !scene || !meta || !isLoaded || !vatData || !spawnStorage) return

        const geometry = extractGeometryFromScene(scene)
        if (!geometry) {
            console.warn('VAT geometry not found in scene')
            return
        }

        // Indirect Draw Setup
        const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count
        const drawBuffer = new THREE.IndirectStorageBufferAttribute(new Uint32Array(indexCount), indexCount)
        const drawStorage = storage(drawBuffer, drawIndirectStructure, 1)
        geometry.setIndirect(drawBuffer)

        const visibleIndicesBuffer = createVisibleIndicesBuffer(count)

        // Compute Shaders
        const resetCompute = createResetCompute(drawStorage, indexCount)
        const spawnCompute = createSpawnCompute(vatData, spawnStorage, spawnUniforms, count)
        const updateCompute = createUpdateCompute(drawStorage, visibleIndicesBuffer, vatData, count, computeUniforms)

        computeRefs.current = { reset: resetCompute, spawn: spawnCompute, update: updateCompute }

        setupVATGeometry(geometry as any, meta as any)

        const mat = createVATMaterial(
            posTex as THREE.Texture,
            nrmTex as THREE.Texture,
            vatData,
            visibleIndicesBuffer,
            meta as any,
            uniforms,
            petalTex,
            outlineTex,
        )
        const mesh = new THREE.Mesh(geometry, mat)
        mesh.count = count
        mesh.frustumCulled = false
        groupRef.current.add(mesh)

        return () => {
            groupRef.current?.remove(mesh)
            geometry.dispose()
            mat.dispose()
        }
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData])

    useEffect(() => {
        const baseColor = new THREE.Color(config.Green)
        uniforms.uGreen.value.set(baseColor.r, baseColor.g, baseColor.b)
    }, [config, uniforms])

    // Update compute uniforms when config changes
    useEffect(() => {
        const life = (config as any).Lifecycle
        if (life) {
            computeUniforms.uDelayMin.value = life.DelayMin
            computeUniforms.uDelayMax.value = life.DelayMax
            computeUniforms.uGrowMin.value = life.GrowMin
            computeUniforms.uGrowMax.value = life.GrowMax
            computeUniforms.uKeepMin.value = life.KeepMin
            computeUniforms.uKeepMax.value = life.KeepMax
            computeUniforms.uDieMin.value = life.DieMin
            computeUniforms.uDieMax.value = life.DieMax
        }
    }, [config, computeUniforms])

    useFrame(() => {
        const renderer = gl as unknown as WebGPURenderer
        if (!computeRefs.current) return

        renderer.compute(computeRefs.current.reset)
        renderer.compute(computeRefs.current.spawn)
        renderer.compute(computeRefs.current.update)

        // Reset spawn flag each frame (important, keep this)
        spawnUniforms.uDoSpawn.value = 0
    })

    return <group ref={groupRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={10}>
            <planeGeometry />
            <meshBasicMaterial color="white" />
        </mesh>
    </group>
})

Rose.displayName = 'Rose'

export default Rose
