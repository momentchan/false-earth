import { useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three/webgpu";
import { useTexture } from "@react-three/drei";
import { folder, useControls } from "leva";
import { storage, uniform, vec2, vec3, instancedArray, struct } from "three/tsl";
import { useVATPreloader, extractGeometryFromScene, setupVATGeometry } from "./core";
import { createVATMaterial } from "./core/vatMaterial";
import { drawIndirectStructure } from "../grass/core/constants";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGPURenderer } from 'three/webgpu'
import { vatStructure } from "./core/types";
import { createUpdateCompute, createResetCompute, createSpawnCompute, createVisibleIndicesBuffer } from "./core/vatCompute";
import { useGameStore } from "../../store/gameStore";

// Define API exposed to parent component
export type RoseHandle = {
    spawn: (pos: THREE.Vector3, count?: number, radius?: number, facingAngle?: number, fanSpread?: number) => void
}

const Rose = forwardRef<RoseHandle, { count: number }>(({ count }, ref) => {
    const gl = useThree((state) => state.gl)
    const { scene, posTex, nrmTex, meta, isLoaded } = useVATPreloader('/vat/Rose_meta.json')
    const groupRef = useRef<THREE.Group>(null)
    const matRef = useRef<THREE.MeshStandardNodeMaterial>(null)

    const [config] = useControls('Rose', () => ({
        Render: folder({
            green: { value: '#325825' },
            green2: { value: '#699555' },
            scaleMin: { value: 5, min: 0, max: 20, step: 0.1 },
            scaleMax: { value: 10, min: 0, max: 20, step: 0.1 },
            normalScale: { value: 0, min: 0, max: 10, step: 0.1 },
            hueShift: { value: 0, min: 0, max: 1, step: 0.01 },
            noiseScale: { value: { x: 1, y: 100 }, min: 0, max: 100, step: 0.1 },
            metalness: { value: 1, min: 0, max: 1, step: 0.01 },
            roughness: { value: 0.7, min: 0, max: 1, step: 0.01 },
            emissiveColor: { value: '#ffcc99' },
            emissiveIntensity: { value: 1, min: 0, max: 2, step: 0.1 },
            fresnelPower: { value: 2.0, min: 0.5, max: 5, step: 0.1 },
        }, { collapsed: true }),
        Lifecycle: folder({
            delayMin: { value: 0, min: 0, max: 10, step: 0.1 },
            delayMax: { value: 0, min: 0, max: 10, step: 0.1 },
            growMin: { value: 2, min: 0, max: 10, step: 0.1 },
            growMax: { value: 5, min: 0, max: 10, step: 0.1 },
            keepMin: { value: 2, min: 0, max: 10, step: 0.1 },
            keepMax: { value: 5, min: 0, max: 10, step: 0.1 },
            dieMin: { value: 2, min: 0, max: 10, step: 0.1 },
            dieMax: { value: 5, min: 0, max: 10, step: 0.1 },
        }, { collapsed: true }),
    }), { collapsed: true })

    const terrainUniforms = useGameStore((state) => state.terrainUniforms)
    const windUniforms = useGameStore((state) => state.windUniforms)

    const matUniforms = useMemo(() => ({
        uGreen: uniform(vec3(0.6, 0.9, 0.6)),
        uGreen2: uniform(vec3(0.6, 0.9, 0.6)),
        uScaleMin: uniform(0.5),
        uScaleMax: uniform(2.0),
        uNormalScale: uniform(1.0),
        uHueShift: uniform(0.0),
        uNoiseScale: uniform(vec2(1, 1)),
        uEmissiveColor: uniform(vec3(1.0, 0.8, 0.6)),
        uEmissiveIntensity: uniform(0.5),
        uFresnelPower: uniform(2.0),
        uPetalDelay: uniform(0.0),
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
    const normalMapTex = useTexture('/textures/Rose/Rose_Petal_Normal.png')
    normalMapTex.repeat.set(0.8, 1)
    normalMapTex.offset.set(0.1, 0)

    const spawnUniforms = useMemo(() => ({
        uSpawnPos: uniform(vec3(0)),
        uSpawnCount: uniform(0),    // Number of instances to spawn (0-64)
        uSpawnRadius: uniform(0.5), // Scatter radius around spawn position
        uFacingAngle: uniform(0.0),  // Center angle of the fan (in radians)
        uFanSpread: uniform(Math.PI), // Half-angle spread of the fan (in radians, default PI = full circle)
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
        spawn: (pos: THREE.Vector3, amount: number = 1, radius: number = 0.5, facingAngle: number = 0, fanSpread: number = Math.PI) => {
            // Directly write to uniform, bypassing React State
            spawnUniforms.uSpawnPos.value.copy(pos);
            spawnUniforms.uSpawnCount.value = Math.min(amount, 64); // Clamp to max batch size
            spawnUniforms.uSpawnRadius.value = radius;
            spawnUniforms.uFacingAngle.value = facingAngle;
            spawnUniforms.uFanSpread.value = fanSpread;
        }
    }), [spawnUniforms])


    // Initialize data buffer
    const vatData = useMemo(() => {
        // position(vec3=3) + isActive + frame + startTime + seed + progress = 8 floats per instance
        const stride = 8
        const data = new Float32Array(count * stride)

        for (let i = 0; i < count; i++) {
            const base = i * stride
            // Position (x, y, z)
            data[base + 0] = 0
            data[base + 1] = 0
            data[base + 2] = 0
            // isActive
            data[base + 3] = 0
            // Frame
            data[base + 4] = 0
            // Start Time
            data[base + 5] = 0.0
            // Seed
            data[base + 6] = 0.0
            // Progress
            data[base + 7] = 0.0
        }
        return instancedArray(data, vatStructure)
    }, [count])

    const computeRefs = useRef<{ reset: THREE.ComputeNode, spawn: THREE.ComputeNode, update: THREE.ComputeNode } | null>(null)

    useEffect(() => {
        if (!groupRef.current || !scene || !meta || !isLoaded || !vatData || !spawnStorage || !terrainUniforms || !windUniforms) return

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
            matUniforms,
            petalTex,
            outlineTex,
            normalMapTex,
            terrainUniforms || undefined,
            windUniforms || undefined,
        )
        matRef.current = mat

        const mesh = new THREE.Mesh(geometry, mat)
        mesh.count = count
        mesh.frustumCulled = false
        mesh.castShadow = true
        groupRef.current.add(mesh)

        return () => {
            groupRef.current?.remove(mesh)
            geometry.dispose()
            mat.dispose()
        }
    }, [scene, meta, isLoaded, posTex, nrmTex, vatData, terrainUniforms, windUniforms])

    useEffect(() => {
        const baseColor = new THREE.Color(config.green)
        matUniforms.uGreen.value.set(baseColor.r, baseColor.g, baseColor.b)

        const baseColor2 = new THREE.Color(config.green2)
        matUniforms.uGreen2.value.set(baseColor2.r, baseColor2.g, baseColor2.b)

        matUniforms.uScaleMin.value = config.scaleMin
        matUniforms.uScaleMax.value = config.scaleMax
        matUniforms.uNormalScale.value = config.normalScale
        matUniforms.uHueShift.value = config.hueShift
        matUniforms.uNoiseScale.value.set(config.noiseScale.x, config.noiseScale.y)
        
        const emissiveColor = new THREE.Color(config.emissiveColor)
        matUniforms.uEmissiveColor.value.set(emissiveColor.r, emissiveColor.g, emissiveColor.b)
        matUniforms.uEmissiveIntensity.value = config.emissiveIntensity
        matUniforms.uFresnelPower.value = config.fresnelPower
    }, [config, matUniforms])

    // Update compute uniforms when config changes
    useEffect(() => {
        computeUniforms.uDelayMin.value = config.delayMin
        computeUniforms.uDelayMax.value = config.delayMax
        computeUniforms.uGrowMin.value = config.growMin
        computeUniforms.uGrowMax.value = config.growMax
        computeUniforms.uKeepMin.value = config.keepMin
        computeUniforms.uKeepMax.value = config.keepMax
        computeUniforms.uDieMin.value = config.dieMin
        computeUniforms.uDieMax.value = config.dieMax
    }, [config, computeUniforms])


    useEffect(() => {
        if (!matRef.current) return
        matRef.current.metalness = config.metalness
        matRef.current.roughness = config.roughness
    }, [config.metalness, config.roughness])


    useFrame(() => {
        const renderer = gl as unknown as WebGPURenderer
        if (!computeRefs.current) return

        renderer.compute(computeRefs.current.reset)
        renderer.compute(computeRefs.current.spawn)
        renderer.compute(computeRefs.current.update)

        // Reset spawn count each frame (important, keep this)
        spawnUniforms.uSpawnCount.value = 0
    })

    return <group ref={groupRef}>
        {/* <mesh rotation={[-Math.PI / 2, 0, 0]} scale={10} receiveShadow>
            <planeGeometry />
            <meshStandardMaterial color="white" />
        </mesh> */}
    </group>
})

Rose.displayName = 'Rose'

export default Rose
